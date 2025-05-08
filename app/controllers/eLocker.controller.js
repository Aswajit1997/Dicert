const mongoose = require("mongoose");
const ELocker = require("../models/eLocker.model");
const Folder = require("../models/folder.model");
const Certificate = require("../models/certificates.model");
const imageUpload = require("../middlewares/storageUtil");
const getFileExtension = require("../utils/getFileExtension");
const generateUniqueId = require("../utils/generateUniqueId");
const path = require("path");
const crypto = require("crypto");
// ELocker Controller
const eLocker = {};

// 🟢 Create Folder
eLocker.createFolder = async (req, res) => {
	try {
		const userId = req.authId;
		const { folderName } = req.body;

		// Check if eLocker exists; if not, create one
		let elocker = await ELocker.findOne({ user: userId });
		if (!elocker) {
			elocker = await ELocker.create({ user: userId });
		}

		// Check if folder with the same name exists
		const existingFolder = await Folder.findOne({ user: userId, name: folderName });
		if (existingFolder) {
			return res.status(400).json({ status: false, message: "Folder with the same name already exists" });
		}

		// Create new folder and add it to eLocker
		const newFolder = await Folder.create({ user: userId, name: folderName });
		elocker.folders.push(newFolder._id);
		await elocker.save();

		return res.status(200).json({ status: true, message: "Folder created successfully", data: newFolder });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

// 🟢 Upload Certificate
eLocker.uploadCertificate = async (req, res) => {
	try {
		const userId = req.authId;

		// Check if eLocker exists, if not create one
		let elocker = await ELocker.findOne({ user: userId });
		if (!elocker) {
			elocker = await ELocker.create({ user: userId });
		}

		if (!req.files || !req.files["certificate"] || req.files["certificate"].length === 0) {
			return res.status(400).json({ status: false, message: "No certificate file provided." });
		}

		const file = req.files["certificate"][0].buffer;
		const originalName = req.files["certificate"][0].originalname;
		const ext = path.extname(originalName);
		const randomString = crypto.randomBytes(6).toString("hex");
		const newFileName = `${path.basename(originalName, ext)}_${randomString}${ext}`;

		const fileUrl = await imageUpload(file, newFileName, `Recipient/Certificates/${userId}`);

		const fileDocument = {
			name: originalName,
			format: getFileExtension(originalName),
			filePath: fileUrl,
			size: req.files["certificate"][0].size,
			uniqueId: generateUniqueId(),
		};

		// Save certificate to DB
		const newCertificate = await Certificate.create({
			...fileDocument,
			user: userId,
		});

		elocker.certificates.push(newCertificate._id);
		await elocker.save();

		return res.status(200).json({
			status: true,
			message: "Certificate uploaded successfully",
			data: newCertificate,
		});
	} catch (error) {
		console.error("Upload Certificate Error:", error);
		return res.status(500).json({ status: false, message: "Server error", error: error.message });
	}
};

// 🟢 Add Certificate to Folder (Create folder if not exists)
eLocker.addCertificateToFolder = async (req, res) => {
	try {
		const userId = req.authId;
		const { certificateId, folderName } = req.body;

		// Check if certificate exists
		const certificate = await Certificate.findOne({ _id: certificateId, user: userId });
		if (!certificate) {
			return res.status(404).json({ status: false, message: "Certificate not found" });
		}

		// Check if folder exists, if not, create it
		let folder = await Folder.findOne({ user: userId, name: folderName });
		if (!folder) {
			folder = await Folder.create({ user: userId, name: folderName });
		}

		// Add certificate to folder
		certificate.folder = folder._id;
		await certificate.save();
		folder.certificates.push(certificate._id);
		await folder.save();

		return res.status(200).json({ status: true, message: "Certificate added to folder successfully", data: certificate });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

// 🟢 Move Certificate Between Folders
eLocker.moveCertificateFolder = async (req, res) => {
	try {
		const userId = req.authId;
		const { certificateId, targetFolderName } = req.body;

		// Find the user's eLocker
		const userELocker = await ELocker.findOne({ user: userId });
		if (!userELocker) {
			return res.status(404).json({ status: false, message: "eLocker not found" });
		}

		// Find the certificate
		const certificate = await Certificate.findOne({ _id: certificateId, user: userId });
		if (!certificate) {
			return res.status(404).json({ status: false, message: "Certificate not found" });
		}

		// Check if target folder exists
		const targetFolder = await Folder.findOne({ user: userId, name: targetFolderName });
		if (!targetFolder) {
			return res.status(404).json({ status: false, message: "Target folder not found" });
		}

		// Remove certificate from current folder if it exists
		if (certificate.folder) {
			const currentFolder = await Folder.findById(certificate.folder);
			if (currentFolder) {
				currentFolder.certificates = currentFolder.certificates.filter((id) => id.toString() !== certificateId);
				await currentFolder.save();
			}
		} else {
			// Certificate was not in any folder, so remove it from the eLocker's certificates array
			userELocker.certificates = userELocker.certificates.filter((id) => id.toString() !== certificateId);
		}

		// Move certificate to the target folder
		certificate.folder = targetFolder._id;
		await certificate.save();
		targetFolder.certificates.push(certificate._id);
		await targetFolder.save();
		await userELocker.save();

		return res.status(200).json({ status: true, message: "Certificate moved successfully", data: certificate });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

eLocker.getELockerData = async (req, res) => {
	try {
		const userId = req.authId;

		// Find the user's eLocker
		const userELocker = await ELocker.findOne({ user: userId })
			.populate({
				path: "folders",
				populate: {
					path: "certificates",
					model: "Certificate",
				},
			})
			.populate("certificates")
			.lean();

		if (!userELocker) {
			return res.status(404).json({ status: false, message: "eLocker not found" });
		}

		// Format certificates function
		const formatCertificate = (certificate) => ({
			name: certificate.name,
			accessibility: certificate.accessibility,
			dateModified: certificate.updatedAt.toLocaleDateString("en-US", {
				weekday: "short",
				day: "2-digit",
				month: "long",
				year: "numeric",
			}),
			size: certificate.size, // Assuming size is in bytes
			isAddedToFavorite: certificate.isAddedToFavorite,
			issuedTemplateHTML: certificate.issuedTemplateHTML,
			uniqueId: certificate.uniqueId,
			filePath: certificate?.filePath,
			_id: certificate._id,
		});

		// Format folders with certificates
		const formattedFolders = userELocker.folders.map((folder) => ({
			name: folder.name,
			certificates: folder.certificates.map(formatCertificate),
		}));

		// Format certificates not in folders
		const formattedCertificates = userELocker.certificates.map(formatCertificate);

		// Final response
		const responseData = {
			folders: formattedFolders,
			certificates: formattedCertificates,
		};

		return res.status(200).json({ status: true, data: responseData });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

//add certificate to favorite
eLocker.addToFavorite = async (req, res) => {
	try {
		const { certificateId } = req.body;
		const userId = req.authId;

		const certificate = await Certificate.findOne({ _id: certificateId, user: userId });
		if (!certificate) {
			return res.status(404).json({ status: false, message: "Certificate not found" });
		}

		if (certificate.isAddedToFavorite) {
			return res.status(400).json({ status: false, message: "Already added to favorites" });
		}

		certificate.isAddedToFavorite = true;
		await certificate.save();

		return res.status(200).json({ status: true, message: "Added to favorites", data: certificate });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

eLocker.removeFromFavorite = async (req, res) => {
	try {
		const { certificateId } = req.body;
		const userId = req.authId;

		const certificate = await Certificate.findOne({ _id: certificateId, user: userId });
		if (!certificate) {
			return res.status(404).json({ status: false, message: "Certificate not found" });
		}

		if (!certificate.isAddedToFavorite) {
			return res.status(400).json({ status: false, message: "Certificate is not in favorites" });
		}

		certificate.isAddedToFavorite = false;
		await certificate.save();

		return res.status(200).json({ status: true, message: "Removed from favorites", data: certificate });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

eLocker.toggleFavorite = async (req, res) => {
	try {
		const { certificateId } = req.body;
		const userId = req.authId;

		const certificate = await Certificate.findOne({ _id: certificateId, user: userId });
		if (!certificate) {
			return res.status(404).json({ status: false, message: "Certificate not found" });
		}

		// Toggle the favorite status
		certificate.isAddedToFavorite = !certificate.isAddedToFavorite;
		await certificate.save();

		const message = certificate.isAddedToFavorite ? "Added to favorites" : "Removed from favorites";

		return res.status(200).json({
			status: true,
			message,
			data: certificate,
		});
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

//get favorite list
eLocker.getFavorites = async (req, res) => {
	try {
		const userId = req.authId;
		const { page = 1, limit = 10, search = "" } = req.query;

		const pageNumber = Math.max(parseInt(page, 10), 1);
		const limitNumber = Math.max(parseInt(limit, 10), 1);
		const skip = (pageNumber - 1) * limitNumber;

		const searchRegex = new RegExp(search, "i"); // case-insensitive

		const matchStage = {
			user: mongoose.Types.ObjectId(userId),
			isAddedToFavorite: true,
		};

		const pipeline = [
			{ $match: matchStage },
			{
				$lookup: {
					from: "folders",
					localField: "folder",
					foreignField: "_id",
					as: "folder",
				},
			},
			{ $unwind: { path: "$folder", preserveNullAndEmptyArrays: true } },
			{
				$match: {
					$or: [{ name: { $regex: searchRegex } }, { "folder.name": { $regex: searchRegex } }],
				},
			},
			{
				$project: {
					name: 1,
					format: 1,
					filePath: 1,
					isAddedToFavorite: 1,
					accessibility: 1,
					size: 1,
					createdAt: 1,
					"folder._id": 1,
					"folder.name": 1,
				},
			},
			{ $sort: { createdAt: -1 } },
			{ $skip: skip },
			{ $limit: limitNumber },
		];

		const countPipeline = [...pipeline.slice(0, -2), { $count: "total" }];

		const [favorites, totalResult] = await Promise.all([
			Certificate.aggregate(pipeline),
			Certificate.aggregate(countPipeline),
		]);

		const totalFavorites = totalResult.length > 0 ? totalResult[0].total : 0;

		return res.status(200).json({
			status: true,
			message: "Favorites fetched successfully",
			data: favorites,
			pagination: {
				total: totalFavorites,
				page: pageNumber,
				limit: limitNumber,
				totalPages: Math.ceil(totalFavorites / limitNumber),
			},
		});
	} catch (error) {
		console.error("Error fetching favorites:", error);
		res.status(500).json({ status: false, message: error.message });
	}
};

module.exports = eLocker;
