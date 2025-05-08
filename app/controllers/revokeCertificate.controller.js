const RevokedCertificate = require("../models/revokedCertificate.model");
const revokedCertificateController = {};
const mongoose = require("mongoose");

// 🗑️ Add Certificate to Recycle Bin
// revokedCertificateController.getRevokedCertificate = async (req, res) => {
// 	try {
// 		const { page = 1, limit = 10 } = req.query;

// 		// Parse and sanitize page/limit
// 		const pageNumber = Math.max(parseInt(page, 10), 1);
// 		const limitNumber = Math.max(parseInt(limit, 10), 1);
// 		const skip = (pageNumber - 1) * limitNumber;

// 		// Fetch revoked certificates and total count in parallel
// 		const [revokedCertificate, totalRevoked] = await Promise.all([
// 			RevokedCertificate.find({})
// 				.skip(skip)
// 				.limit(limitNumber)
// 				.populate("issuedBy", "organizationName email")
// 				.lean()
// 				.sort({ createdAt: -1 }), // Optional: sort by latest
// 			RevokedCertificate.countDocuments(),
// 		]);

// 		return res.status(200).json({
// 			success: true,
// 			data: revokedCertificate,
// 			message: "Revoked Certificates fetched successfully.",
// 			pagination: {
// 				total: totalRevoked,
// 				page: pageNumber,
// 				limit: limitNumber,
// 				totalPages: Math.ceil(totalRevoked / limitNumber),
// 			},
// 		});
// 	} catch (error) {
// 		console.error("Error fetching revoked certificates:", error);
// 		return res.status(500).json({ success: false, message: "Server error." });
// 	}
// };

// revokedCertificateController.getRevokedCertificate = async (req, res) => {
// 	try {
// 		const { page = 1, limit = 10, search } = req.query;

// 		// Parse and sanitize page/limit
// 		const pageNumber = Math.max(parseInt(page, 10), 1);
// 		const limitNumber = Math.max(parseInt(limit, 10), 1);
// 		const skip = (pageNumber - 1) * limitNumber;

// 		let revokedCertificates = await RevokedCertificate.find({})
// 			.populate("issuedBy", "organizationName email")
// 			.lean()
// 			.sort({ createdAt: -1 });

// 		// Apply search filter if provided
// 		if (search && search.trim() !== "") {
// 			const searchRegex = new RegExp(search.trim(), "i"); // case-insensitive

// 			revokedCertificates = revokedCertificates.filter((cert) => {
// 				const nameMatch = cert.name && searchRegex.test(cert.name);
// 				const orgMatch = cert.issuedBy?.organizationName && searchRegex.test(cert.issuedBy.organizationName);
// 				return nameMatch || orgMatch;
// 			});
// 		}

// 		const total = revokedCertificates.length;
// 		const paginatedCertificates = revokedCertificates.slice(skip, skip + limitNumber);

// 		return res.status(200).json({
// 			success: true,
// 			data: paginatedCertificates,
// 			message: "Revoked Certificates fetched successfully.",
// 			pagination: {
// 				total,
// 				page: pageNumber,
// 				limit: limitNumber,
// 				totalPages: Math.ceil(total / limitNumber),
// 			},
// 		});
// 	} catch (error) {
// 		console.error("Error fetching revoked certificates:", error);
// 		return res.status(500).json({ success: false, message: "Server error." });
// 	}
// };

revokedCertificateController.getRevokedCertificate = async (req, res) => {
	try {
		const { page = 1, limit = 10, search = "" } = req.query;

		const pageNumber = Math.max(parseInt(page, 10), 1);
		const limitNumber = Math.max(parseInt(limit, 10), 1);
		const skip = (pageNumber - 1) * limitNumber;
		const searchRegex = new RegExp(search.trim(), "i");

		// Aggregation pipeline
		const pipeline = [
			{
				$lookup: {
					from: "issuers", // adjust to your actual collection name if different
					localField: "issuedBy",
					foreignField: "_id",
					as: "issuedBy",
				},
			},
			{ $unwind: "$issuedBy" },
			{
				$match: {
					$or: [{ name: { $regex: searchRegex } }, { "issuedBy.organizationName": { $regex: searchRegex } }],
				},
			},
			{
				$project: {
					name: 1,
					filePath: 1,
					format: 1,
					reason: 1,
					createdAt: 1,
					issuedBy: {
						_id: "$issuedBy._id",
						organizationName: "$issuedBy.organizationName",
						email: "$issuedBy.email",
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

		const result = await RevokedCertificate.aggregate(pipeline);

		const revokedCertificates = result[0].data;
		const total = result[0].totalCount[0]?.count || 0;

		return res.status(200).json({
			success: true,
			data: revokedCertificates,
			message: "Revoked Certificates fetched successfully.",
			pagination: {
				total,
				page: pageNumber,
				limit: limitNumber,
				totalPages: Math.ceil(total / limitNumber),
			},
		});
	} catch (error) {
		console.error("Error fetching revoked certificates:", error);
		return res.status(500).json({ success: false, message: "Server error." });
	}
};

module.exports = revokedCertificateController;
