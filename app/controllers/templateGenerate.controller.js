const mongoose = require("mongoose");
const path = require("path");
const Template = require("../models/template.model");
const QRCode = require("qrcode");
const Certificate = require("../models/certificates.model");
const RevokedCertificate = require("../models/revokedCertificate.model");
const User = require("../models/user.model");
const ELocker = require("../models/eLocker.model");
const crypto = require("crypto");
const imageUpload = require("../middlewares/storageUtil"); // Assuming you have this utility
const { Parser } = require("json2csv");
const Folder = require("../models/folder.model");
const csvParser = require("csv-parser");
const generateUniqueId = require("../utils/generateUniqueId");
const streamifier = require("streamifier");

const sharp = require("sharp");
const jsQR = require("jsqr");
const convertHTMLToFile = require("../utils/ConvertHtmlToFile");

function getCertificateNameValue(arr) {
	const match = arr.find((obj) => obj.fieldName === "certificateName");
	return match ? match.placeHolder : null;
}

const templateGenerateController = {};

templateGenerateController.downloadCSVTemplate = async (req, res) => {
	try {
		const { templateId } = req.params;

		// Get template
		const template = await Template.findById(templateId);
		if (!template) return res.status(404).json({ success: false, message: "Template not found" });

		// Extract csvFields and ensure 'email' is included
		let csvFields = template.csvFields.map((field) => field.fieldName);
		if (!csvFields.includes("email")) {
			csvFields.unshift("email");
		}

		// Convert to CSV format
		const json2csvParser = new Parser({ fields: csvFields });
		const csv = json2csvParser.parse([]);

		// Set response headers for file download
		res.header("Content-Type", "text/csv");
		res.attachment("template.csv");
		res.send(csv);
	} catch (error) {
		res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

//generate certificates
templateGenerateController.generateCertificatesFromCSV = async (req, res) => {
	try {
		const { templateId, format, customFields } = req.body;
		if (!templateId) return res.status(400).json({ success: false, message: "Template ID is required" });

		// Parse customFields if it's a string
		const parsedCustomFields = typeof customFields === "string" ? JSON.parse(customFields) : customFields;

		// Get template
		const template = await Template.findById(templateId);
		if (!template) return res.status(404).json({ success: false, message: "Template not found" });

		// Ensure file is uploaded
		if (!req.files || !req.files["csv"]) return res.status(400).json({ success: false, message: "CSV file is required" });

		const file = req.files["csv"][0];

		// Convert buffer to a readable stream
		const csvStream = streamifier.createReadStream(file.buffer);
		const csvData = [];

		// Read and parse CSV
		csvStream
			.pipe(csvParser())
			.on("data", (row) => {
				csvData.push(row);
			})
			.on("end", async () => {
				const generatedCertificates = [];

				for (const row of csvData) {
					const { email, recipientName } = row;

					// Ensure email exists
					if (!email) {
						console.warn(`Skipping row due to missing email:`, row);
						continue;
					}

					// Find user by email or create new user
					let user = await User.findOne({ email });
					if (!user) {
						user = await User.create({ email, name: recipientName || "Unnamed User", password: "user@123" });
					}

					// Check if eLocker exists, if not create one
					let elocker = await ELocker.findOne({ user: user._id });
					if (!elocker) {
						elocker = await ELocker.create({ user: user._id });
					}

					const folderName = "Issued on DiCert";
					let folder = await Folder.findOne({ user: user._id, name: folderName });
					if (!folder) {
						folder = await Folder.create({ user: user._id, name: folderName });
						elocker.folders.push(folder._id);
						await elocker.save();
					}

					const fieldsToUse =
						parsedCustomFields && parsedCustomFields.length > 0 ? parsedCustomFields : template.customFields;

					let certificateHTML = generateCertificateHTML(template.templateHTML, row, fieldsToUse);
					const uniqueId = generateUniqueId();
					const uniqueIdRegex = new RegExp(`{{\\s*uniqueId\\s*}}`, "g");
					certificateHTML = certificateHTML.replace(uniqueIdRegex, uniqueId);

					//get the certificate name from the custom fields
					const certificateName = getCertificateNameValue(fieldsToUse);

					//qrCode gen

					const certificateId = new mongoose.Types.ObjectId(); // Pre-generate _id for QR and DB
					const qrData = JSON.stringify({
						user: user._id,
						issuedBy: req.authId,
						certificateName: certificateName || `${uniqueId} Certificate`,
						certificateId: certificateId,
					});

					// Generate QR code buffer
					const qrBuffer = await QRCode.toBuffer(qrData, { type: "png" });

					// Upload QR image and get URL (same logic as your imageUpload)
					const qrImageUrl = await imageUpload(qrBuffer, `${uniqueId}_qr.png`, "Issuer/UsersCertificate/QRCode");
					console.log(qrImageUrl);

					// Replace {{ qrCode }} placeholder in HTML
					const qrRegex = new RegExp(`<img\\s+[^>]*src=\\s*{{\\s*qrCode\\s*}}`, "g");
					certificateHTML = certificateHTML.replace(qrRegex, `<img src="${qrImageUrl}"`);
					console.log(certificateHTML);

					// filepath/url  for certificate
					const { url: fileUrl, size: fileSize } = await convertHTMLToFile(
						certificateHTML,
						`Issuer/GeneratedCertificates/${req?.authId}`,
						format || "png"
					);

					const newCertificate = await Certificate.create({
						_id: certificateId,
						name: certificateName || `${uniqueId} Certificate.png`,
						format: format || "png",
						filePath: fileUrl,
						size: fileSize,
						user: user._id,
						issuedBy: req.authId,
						folder: folder._id,
						issuedTemplateHTML: certificateHTML,
						templateId: template._id,
						uniqueId,
					});
					generatedCertificates.push(newCertificate);

					folder.certificates.push(newCertificate._id);
					await folder.save();
				}

				res.status(200).json({ success: true, message: "Certificates generated", certificates: generatedCertificates });
			})
			.on("error", (error) => {
				console.error(error);
				res.status(500).json({ success: false, message: "Error processing CSV", error: error.message });
			});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

// verify certificate
templateGenerateController.verifyCertificate = async (req, res) => {
	try {
		const authID = req.authId;
		let certificate;

		// If QR file is provided
		if (req.files && req.files["qrImage"]) {
			const file = req.files["qrImage"][0];

			// Decode QR from image
			const { data, info } = await sharp(file.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
			const result = jsQR(data, info.width, info.height);

			if (!result) {
				return res.status(400).json({ success: false, message: "No QR code found in image." });
			}

			let qrData = result.data;
			try {
				qrData = JSON.parse(result.data);
			} catch (e) {
				return res.status(400).json({ success: false, message: "QR code does not contain valid JSON." });
			}

			const { certificateId, user, issuedBy } = qrData;

			// Find certificate using certificateId
			certificate = await Certificate.findById(certificateId);
			if (!certificate) return res.status(404).json({ success: false, message: "Certificate not found." });

			// Check if issuer matches
			if (certificate.issuedBy?.toString() !== authID && certificate.user?.toString() !== user) {
				return res.status(403).json({
					success: false,
					message,
				});
			}

			return res.status(200).json({
				success: true,
				message: "Certificate verified via QR successfully.",
				certificate,
			});
		}

		// If no QR, fall back to uniqueId verification
		const { uniqueId } = req.body;
		if (!uniqueId) return res.status(400).json({ success: false, message: "uniqueId is required." });

		certificate = await Certificate.findOne({ uniqueId });
		if (!certificate) return res.status(404).json({ success: false, message: "Certificate not found." });

		if (certificate.issuedBy?.toString() !== authID) {
			return res.status(403).json({ success: false, message: "Certificate not issued by you." });
		}

		return res.status(200).json({
			success: true,
			message: "Certificate verified via uniqueId successfully.",
			certificate,
		});
	} catch (error) {
		console.error("verifyCertificate Error:", error);
		return res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

//verify qrCode
// templateGenerateController.decodeQrCode = async (req, res) => {
// 	try {
// 		if (!req.files || !req.files["qrImage"]) {
// 			return res.status(400).json({ success: false, message: "QR image is required" });
// 		}

// 		const file = req.files["qrImage"][0];

// 		if (!file) {
// 			return res.status(400).json({ success: false, message: "File not provided" });
// 		}
// 		console.log(file)

// 		const image = await Jimp.read(file);

// 		const qr = new QrCode();

// 		const result = await new Promise((resolve, reject) => {
// 			qr.callback = (err, value) => {
// 				if (err) return reject(err);
// 				resolve(value);
// 			};
// 			qr.decode(image.bitmap);
// 		});

// 		const qrData = JSON.parse(result.result);

// 		res.status(200).json({ success: true, data: qrData });
// 	} catch (error) {
// 		console.error("QR Decode Error:", error);
// 		res.status(500).json({ success: false, message: "Failed to decode QR", error: error.message });
// 	}
// };

//will be removed
templateGenerateController.decodeQrCode = async (req, res) => {
	try {
		if (!req.files || !req.files["qrImage"]) {
			return res.status(400).json({ success: false, message: "QR image is required" });
		}

		const file = req.files["qrImage"][0];

		// Convert the image to raw pixel data (RGBA)
		const { data, info } = await sharp(file.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

		// Use jsQR to decode
		const result = jsQR(data, info.width, info.height);

		if (!result) {
			return res.status(400).json({ success: false, message: "No QR code found in image." });
		}

		// Optional: parse as JSON
		let qrData = result.data;
		try {
			qrData = JSON.parse(result.data);
		} catch (e) {
			// leave as raw string if not JSON
		}

		res.status(200).json({ success: true, data: qrData });
	} catch (error) {
		console.error("QR Decode Error:", error);
		res.status(500).json({ success: false, message: "Failed to decode QR", error: error.message });
	}
};

//revoke generated certificate
templateGenerateController.revokeCertificate = async (req, res) => {
	try {
		const { certificateID } = req.body;
		const authID = req.authId;

		const certificate = await Certificate.findById(certificateID);
		if (!certificate) return res.status(404).json({ success: false, message: "Certificate not found." });

		if (certificate.issuedBy.toString() !== authID) {
			return res.status(403).json({ success: false, message: "Unauthorized action." });
		}

		const revokedCertificate = new RevokedCertificate({
			...certificate.toObject(),
			revokedFrom: "issuer",
		});
		await revokedCertificate.save();

		await Certificate.deleteOne({ _id: certificateID });

		res.status(200).json({
			success: true,
			message: "Certificate revoked and deleted successfully.",
			certificate: revokedCertificate,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

//bulk revoke certificates
templateGenerateController.revokeCertificatesBulk = async (req, res) => {
	try {
		const { ids } = req.body;
		const authID = req.authId;

		if (!Array.isArray(ids) || ids.length === 0) {
			return res.status(400).json({ success: false, message: "No certificate IDs provided." });
		}

		const certificates = await Certificate.find({ _id: { $in: ids } });

		// Filter out unauthorized certificates
		const unauthorized = certificates.filter((cert) => cert.issuedBy.toString() !== authID);
		if (unauthorized.length > 0) {
			return res.status(403).json({
				success: false,
				message: "Some certificates are not issued by you.",
				unauthorizedIds: unauthorized.map((c) => c._id),
			});
		}

		// Prepare revoked copies
		const revokedDocs = certificates.map((cert) => {
			const data = cert.toObject();
			delete data._id;
			return {
				...data,
				revokedFrom: "issuer",
			};
		});

		await RevokedCertificate.insertMany(revokedDocs);
		await Certificate.deleteMany({ _id: { $in: ids } });

		res.status(200).json({
			success: true,
			message: "Certificates revoked and deleted successfully.",
			revokedCount: revokedDocs.length,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

//issued certificates
templateGenerateController.issuedCertificates = async (req, res) => {
	try {
		const authID = new mongoose.Types.ObjectId(req.authId);
		const { page = 1, limit = 10, search = "" } = req.query;

		const pageNumber = Math.max(parseInt(page), 1);
		const limitNumber = Math.max(parseInt(limit), 1);
		const skip = (pageNumber - 1) * limitNumber;
		const searchRegex = new RegExp(search.trim(), "i");

		// Aggregation pipeline
		const pipeline = [
			{ $match: { issuedBy: authID } },
			{
				$lookup: {
					from: "users", // collection name (not model)
					localField: "user",
					foreignField: "_id",
					as: "user",
				},
			},
			{ $unwind: "$user" },
			{
				$match: {
					$or: [{ name: { $regex: searchRegex } }, { "user.name": { $regex: searchRegex } }],
				},
			},
			{
				$project: {
					name: 1,
					format: 1,
					filePath: 1,
					issuedBy: 1,
					createdAt: 1,
					issuedTemplateHTML: 1,
					user: {
						_id: "$user._id",
						name: "$user.name",
						email: "$user.email",
						profileImage: "$user.profileImage",
					},
				},
			},
			{ $sort: { createdAt: -1 } },
			{
				$facet: {
					data: [{ $skip: skip }, { $limit: limitNumber }],
					totalCount: [{ $count: "count" }],
				},
			},
		];

		const result = await Certificate.aggregate(pipeline);

		const certificates = result[0].data;
		const total = result[0].totalCount[0]?.count || 0;

		return res.status(200).json({
			success: true,
			message: "Certificates fetched successfully.",
			certificates,
			pagination: {
				total,
				page: pageNumber,
				limit: limitNumber,
				totalPages: Math.ceil(total / limitNumber),
			},
		});
	} catch (error) {
		console.error("Aggregation error:", error);
		res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

// templateGenerateController.issuedCertificates = async (req, res) => {
// 	try {
// 		const authID = req.authId;
// 		const { page = 1, limit = 10 } = req.query;

// 		// Pagination logic
// 		const pageNumber = Math.max(parseInt(page, 10), 1);
// 		const limitNumber = Math.max(parseInt(limit, 10), 1);
// 		const skip = (pageNumber - 1) * limitNumber;

// 		// Fetch data and total count concurrently
// 		const [certificates, totalCertificates] = await Promise.all([
// 			Certificate.find({ issuedBy: authID })
// 				.skip(skip)
// 				.limit(limitNumber)
// 				.lean()
// 				.select("-__v -csvFields -customFields -updatedAt")
// 				.populate({
// 					path: "user",
// 					select: "name email profileImage", // Select fields you need
// 				})
// 				.sort({ createdAt: -1 }),
// 			Certificate.countDocuments({ issuedBy: authID }),
// 		]);

// 		if (!certificates.length) {
// 			return res.status(404).json({ success: false, message: "No Certificates issued by You.." });
// 		}

// 		res.status(200).json({
// 			success: true,
// 			message: "Certificates fetched successfully..",
// 			pagination: {
// 				total: totalCertificates,
// 				page: pageNumber,
// 				limit: limitNumber,
// 				totalPages: Math.ceil(totalCertificates / limitNumber),
// 			},
// 			certificates,
// 		});
// 	} catch (error) {
// 		console.error(error);
// 		res.status(500).json({ success: false, message: "Server Error", error: error.message });
// 	}
// };

templateGenerateController.getImageUrl = async (req, res) => {
	try {
		const { folderName } = req.body;
		let fileUrl;

		if (req.file) {
			const bufferData = req.file.buffer;
			const originalName = req.file.originalname;
			const folder = folderName || "Uploads";

			// Extract name and extension
			const ext = path.extname(originalName);
			const baseName = path.basename(originalName, ext);

			// Generate a random string
			const randomString = crypto.randomBytes(6).toString("hex"); // e.g., "4f3c2d"

			// Construct new file name
			const fileName = `${baseName}_${randomString}${ext}`;

			fileUrl = await imageUpload(bufferData, fileName, folder);
		}

		return res.status(200).json({
			success: true,
			url: fileUrl,
		});
	} catch (error) {
		console.error("upload error:", error);
		res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

module.exports = templateGenerateController;

// Function to replace placeholders in template HTML
function generateCertificateHTML(templateHTML, csvData, customFields) {
	let certificateHTML = templateHTML;

	// Replace CSV field placeholders (similar to allFields logic)
	Object.entries(csvData).forEach(([key, value]) => {
		const placeholderRegex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
		certificateHTML = certificateHTML.replace(placeholderRegex, value);
	});

	// Replace custom fields
	customFields.forEach(({ fieldName, fieldType, placeHolder }) => {
		if (fieldType === "file" && fieldName === "qrCode") {
			return;
		} else if (fieldType === "file" && fieldName !== "backgroundUrl") {
			// Replace like <img src={{ signature }}>
			const imgPlaceholderRegex = new RegExp(`<img\\s+[^>]*src=\\s*{{\\s*${fieldName}\\s*}}`, "g");
			certificateHTML = certificateHTML.replace(imgPlaceholderRegex, `<img src="${placeHolder}"`);
		} else if (fieldType === "file" && fieldName === "backgroundUrl") {
			// Replace background URL
			certificateHTML = certificateHTML.replace(/url\(["']\s*{{\s*backgroundUrl\s*}}\s*["']\)/g, `url("${placeHolder}")`);
		} else {
			// Replace general text placeholders
			const placeholderRegex = new RegExp(`{{\\s*${fieldName}\\s*}}`, "g");
			certificateHTML = certificateHTML.replace(placeholderRegex, placeHolder);
		}
	});
	return certificateHTML;
}
