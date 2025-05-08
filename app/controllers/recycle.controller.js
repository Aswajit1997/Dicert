const mongoose = require("mongoose");
const RecycleBin = require("../models/recycle.model");
const Certificate = require("../models/certificates.model");
const ELocker = require("../models/eLocker.model");
const Folder = require("../models/folder.model");

const recycle = {};

// 🗑️ Add Certificate to Recycle Bin
recycle.addToRecycleBin = async (req, res) => {
	const { certificateId } = req.body;
	const userId = req.authId;

	try {
		const certificate = await Certificate.findOne({ _id: certificateId, user: userId }).lean();
		if (!certificate) return res.status(404).json({ success: false, message: "Certificate not found." });

		const alreadyInBin = await RecycleBin.findOne({ "certificateData._id": certificateId });
		if (alreadyInBin) return res.status(400).json({ success: false, message: "Already in recycle bin." });

		// Add to recycle bin with full certificate data
		await RecycleBin.create({
			user: userId,
			certificateData: certificate,
			originalFolder: certificate.folder || null,
		});

		// Remove certificate from folder or eLocker
		if (certificate.folder) {
			await Folder.findByIdAndUpdate(certificate.folder, { $pull: { certificates: certificateId } });
		} else {
			await ELocker.findOneAndUpdate({ user: userId }, { $pull: { certificates: certificateId } });
		}

		// Delete from Certificate collection
		await Certificate.findByIdAndDelete(certificateId);

		return res.status(200).json({ success: true, message: "Certificate moved to recycle bin." });
	} catch (error) {
		console.error("Error adding to recycle bin:", error);
		return res.status(500).json({ success: false, message: "Server error." });
	}
};

// ♻️ Recover Certificate from Recycle Bin
recycle.recoverCertificate = async (req, res) => {
	const { certificateId } = req.body;
	const userId = req.authId;

	try {
		const recycleEntry = await RecycleBin.findOne({
			user: userId,
			"certificateData._id": new mongoose.Types.ObjectId(certificateId), // 👈 fix here
		});

		if (!recycleEntry) {
			return res.status(404).json({ success: false, message: "Not found in recycle bin." });
		}

		const restoredCertificate = recycleEntry.certificateData;

		// Re-insert into Certificate collection
		await Certificate.create(restoredCertificate);

		// Restore to folder or ELocker
		if (recycleEntry.originalFolder) {
			await Folder.findByIdAndUpdate(recycleEntry.originalFolder, {
				$addToSet: { certificates: certificateId },
			});
		} else {
			await ELocker.findOneAndUpdate({ user: userId }, { $addToSet: { certificates: certificateId } });
		}

		// Remove from recycle bin
		await RecycleBin.findByIdAndDelete(recycleEntry._id);

		return res.status(200).json({ success: true, message: "Certificate recovered successfully." });
	} catch (error) {
		console.error("Error recovering certificate:", error);
		return res.status(500).json({ success: false, message: "Server error." });
	}
};

// 🗑️ Get Recycled Certificates with Pagination
// recycle.getRecycleCertificates = async (req, res) => {
// 	const userId = req.authId;
// 	const { page = 1, limit = 100 } = req.query;

// 	try {
// 		// Convert page and limit to numbers
// 		const pageNumber = parseInt(page, 10);
// 		const limitNumber = parseInt(limit, 10);
// 		const skip = (pageNumber - 1) * limitNumber;

// 		// Fetch total count
// 		const totalCertificates = await RecycleBin.countDocuments({ user: userId });

// 		// Fetch paginated certificates with populated data
// 		const recycleCertificates = await RecycleBin.find({ user: userId })
// 			.populate({
// 				path: "originalFolder",
// 				select: "name", // To get the original folder's name
// 			})
// 			.sort({ deletedAt: -1 })
// 			.skip(skip)
// 			.limit(limitNumber)
// 			.lean();

// 		return res.status(200).json({
// 			success: true,
// 			message: "Recycled certificates fetched successfully.",
// 			data: recycleCertificates,
// 			pagination: {
// 				total: totalCertificates,
// 				page: pageNumber,
// 				limit: limitNumber,
// 				totalPages: Math.ceil(totalCertificates / limitNumber),
// 			},
// 		});
// 	} catch (error) {
// 		console.error("Error fetching recycled certificates:", error);
// 		return res.status(500).json({ success: false, message: "Error fetching recycled certificates." });
// 	}
// };

recycle.getRecycleCertificates = async (req, res) => {
	const userId = req.authId;
	const { page = 1, limit = 100, search = "" } = req.query;

	try {
		const pageNumber = parseInt(page, 10);
		const limitNumber = parseInt(limit, 10);
		const skip = (pageNumber - 1) * limitNumber;

		const searchRegex = new RegExp(search, "i");

		// Build base query
		const baseQuery = {
			user: userId,
			$or: [
				{ "certificateData.name": { $regex: searchRegex } }, // certificate name
			],
		};

		// If there's a search string, we'll filter after populating the folder name
		const recycleCertificates = await RecycleBin.find({ user: userId })
			.populate({
				path: "originalFolder",
				select: "name",
			})
			.sort({ deletedAt: -1 })
			.lean();

		// Filter manually by certificateData.name and originalFolder.name
		const filtered = recycleCertificates.filter((item) => {
			const certNameMatch = item.certificateData?.name?.match(searchRegex);
			const folderNameMatch = item.originalFolder?.name?.match(searchRegex);
			return certNameMatch || folderNameMatch;
		});

		// Paginate filtered results
		const paginated = filtered.slice(skip, skip + limitNumber);

		return res.status(200).json({
			success: true,
			message: "Recycled certificates fetched successfully.",
			data: paginated,
			pagination: {
				total: filtered.length,
				page: pageNumber,
				limit: limitNumber,
				totalPages: Math.ceil(filtered.length / limitNumber),
			},
		});
	} catch (error) {
		console.error("Error fetching recycled certificates:", error);
		return res.status(500).json({
			success: false,
			message: "Error fetching recycled certificates.",
		});
	}
};

module.exports = recycle;
