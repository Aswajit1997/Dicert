const mongoose = require("mongoose");
const ErrorReport = require("../models/errorReport.model");
const Certificate = require("../models/certificates.model");
const RevokedCertificate = require("../models/revokedCertificate.model");
const imageUpload = require("../middlewares/storageUtil");
const crypto = require("crypto");
const path = require("path");
const reportIssue = {};

// Create an error report and revoke the certificate
reportIssue.makeReport = async (req, res) => {
	try {
		const { certificateId, errorMessage } = req.body;
		const reportedBy = req.authId;

		const certificate = await Certificate.findById(certificateId);
		if (!certificate) {
			return res.status(404).json({ status: false, message: "Certificate not found" });
		}

		// Check if the certificate is already reported
		const existingReport = await ErrorReport.findOne({
			certificateRef: certificateId,
			certificateModel: "Certificate",
			status: { $in: ["pending", "revoked"] },
		});
		if (existingReport) {
			return res.status(400).json({ status: false, message: "This certificate has already been reported." });
		}

		let fileUrl = "";
		if (req.file) {
			const bufferData = req.file.buffer;
			const originalName = req.file.originalname;

			// Extract name and extension
			const ext = path.extname(originalName);
			// Generate a random string
			const randomString = crypto.randomBytes(6).toString("hex"); // e.g., "4f3c2d"

			// Construct new file name
			const fileName = `${originalName}_${randomString}${ext}`;

			fileUrl = await imageUpload(bufferData, fileName, "Recipient/ErrorReport");
		}

		const errorReport = new ErrorReport({
			certificateRef: certificateId,
			certificateModel: "Certificate",
			reportedBy,
			issuedBy: certificate.issuedBy,
			errorMessage,
			attachments: fileUrl,
			status: "pending",
		});
		await errorReport.save();

		return res.status(200).json({ status: true, message: "Error report created successfully.", data: errorReport });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};
//revert report confirm valid
reportIssue.confirmValid = async (req, res) => {
	try {
		const { reportId } = req.body;
		const issuerId = req.authId;

		const errorReport = await ErrorReport.findById(reportId);
		if (!errorReport) {
			return res.status(404).json({ status: false, message: "Please provide a correct report ID" });
		}

		// Check if already revoked
		if (errorReport.status !== "pending") {
			return res.status(400).json({ status: false, message: "This report has already been revoked or resolved." });
		}

		const certificate = await Certificate.findById(errorReport.certificateRef);
		if (!certificate) {
			return res.status(404).json({ status: false, message: "Certificate not found" });
		}

		// 🔐 Check if issuerId matches certificate.issuedBy
		if (certificate.issuedBy.toString() !== issuerId) {
			return res.status(403).json({
				status: false,
				message: "You are not authorized to revoke this certificate.",
			});
		}

		errorReport.status = "confirmed_valid";
		await errorReport.save();

		return res.status(200).json({
			status: true,
			message: "Certificate confirmed_valid and error report reverted.",
			data: errorReport,
		});
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};
//revoke report
reportIssue.revokeReport = async (req, res) => {
	try {
		const { reportId } = req.body;
		const issuerId = req.authId;

		const errorReport = await ErrorReport.findById(reportId);
		if (!errorReport) {
			return res.status(404).json({ status: false, message: "Please provide a correct report ID" });
		}

		// Check if already revoked
		if (errorReport.status === "revoked") {
			return res.status(400).json({ status: false, message: "This report has already been revoked." });
		}

		const certificate = await Certificate.findById(errorReport.certificateRef);
		if (!certificate) {
			return res.status(404).json({ status: false, message: "Certificate not found" });
		}

		// 🔐 Check if issuerId matches certificate.issuedBy
		if (certificate.issuedBy.toString() !== issuerId) {
			return res.status(403).json({
				status: false,
				message: "You are not authorized to revoke this certificate.",
			});
		}

		const revokedCertificate = new RevokedCertificate({
			...certificate.toObject(),
		});
		await revokedCertificate.save();

		await Certificate.deleteOne({ _id: certificate._id });

		errorReport.status = "revoked";
		errorReport.certificateRef = revokedCertificate._id;
		errorReport.certificateModel = "RevokedCertificate";
		await errorReport.save();

		return res.status(200).json({
			status: true,
			message: "Certificate revoked and error report updated.",
			data: errorReport,
		});
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

// Get all error reports
// reportIssue.getErrorReport = async (req, res) => {
// 	try {
// 		const reportedBy = req.authId;
// 		const { page = 1, limit = 10 } = req.query;

// 		const pageNumber = parseInt(page, 10);
// 		const limitNumber = parseInt(limit, 10);
// 		const skip = (pageNumber - 1) * limitNumber;

// 		// Filter directly in the DB using the issuedBy field you added to the model
// 		const total = await ErrorReport.countDocuments({ reportedBy });

// 		const reports = await ErrorReport.find({ reportedBy })
// 			.populate({
// 				path: "reportedBy",
// 				select: "name email",
// 			})
// 			.populate({
// 				path: "certificateRef",
// 				select: "name uniqueId issuedBy",
// 			})
// 			.sort({ createdAt: -1 })
// 			.skip(skip)
// 			.limit(limitNumber)
// 			.lean();

// 		return res.status(200).json({
// 			status: true,
// 			message: "Filtered error reports fetched successfully.",
// 			pagination: {
// 				total,
// 				page: pageNumber,
// 				limit: limitNumber,
// 				totalPages: Math.ceil(total / limitNumber),
// 			},
// 			data: reports,
// 		});
// 	} catch (error) {
// 		console.error("Error fetching error reports:", error);
// 		return res.status(500).json({ status: false, message: error.message });
// 	}
// };
reportIssue.getErrorReport = async (req, res) => {
	try {
		const reportedBy = req.authId;
		const { page = 1, limit = 10, search = "" } = req.query;

		const pageNumber = parseInt(page, 10);
		const limitNumber = parseInt(limit, 10);
		const skip = (pageNumber - 1) * limitNumber;
		const searchRegex = new RegExp(search, "i");

		const pipeline = [
			{ $match: { reportedBy: mongoose.Types.ObjectId(reportedBy) } },

			// Lookup reportedBy user
			{
				$lookup: {
					from: "users",
					localField: "reportedBy",
					foreignField: "_id",
					as: "reportedBy",
				},
			},
			{ $unwind: "$reportedBy" },

			// Lookup issuedBy issuer
			{
				$lookup: {
					from: "certificates",
					localField: "certificateRef",
					foreignField: "_id",
					as: "certDataCert",
				},
			},
			{
				$lookup: {
					from: "revokedcertificates",
					localField: "certificateRef",
					foreignField: "_id",
					as: "certDataRevoked",
				},
			},
			{
				$addFields: {
					certificateRef: {
						$cond: [
							{ $eq: ["$certificateModel", "Certificate"] },
							{ $arrayElemAt: ["$certDataCert", 0] },
							{ $arrayElemAt: ["$certDataRevoked", 0] },
						],
					},
				},
			},
			{
				$project: {
					certDataCert: 0,
					certDataRevoked: 0,
				},
			},
			{ $unwind: "$certificateRef" },

			// Apply search filter if search term is given
			...(search
				? [
						{
							$match: {
								$or: [
									{ "certificateRef.name": { $regex: searchRegex } },
									{ errorMessage: { $regex: searchRegex } },
									{ "issuedBy.name": { $regex: searchRegex } },
								],
							},
						},
				  ]
				: []),

			// Sort and paginate
			{ $sort: { createdAt: -1 } },
			{ $skip: skip },
			{ $limit: limitNumber },

			// Project only required fields
			{
				$project: {
					errorMessage: 1,
					status: 1,
					attachments: 1,
					createdAt: 1,
					"reportedBy.name": 1,
					"reportedBy.email": 1,
					"issuedBy.name": 1,
					"certificateRef.name": 1,
					"certificateRef.filePath": 1,
					"certificateRef.uniqueId": 1,
				},
			},
		];

		const data = await ErrorReport.aggregate(pipeline);

		// Count total (with optional search)
		const countPipeline = pipeline.filter((stage) => !["$skip", "$limit", "$project"].includes(Object.keys(stage)[0]));

		countPipeline.push({ $count: "total" });

		const countResult = await ErrorReport.aggregate(countPipeline);
		const total = countResult[0]?.total || 0;

		return res.status(200).json({
			status: true,
			message: "Filtered error reports fetched successfully.",
			pagination: {
				total,
				page: pageNumber,
				limit: limitNumber,
				totalPages: Math.ceil(total / limitNumber),
			},
			data,
		});
	} catch (error) {
		console.error("Error fetching error reports:", error);
		return res.status(500).json({ status: false, message: error.message });
	}
};

// Get all error reports issuer side
// reportIssue.getErrorReportIssuer = async (req, res) => {
// 	try {
// 		const issuedBy = req.authId;
// 		const { page = 1, limit = 10, search = "" } = req.query;

// 		const pageNumber = parseInt(page, 10);
// 		const limitNumber = parseInt(limit, 10);
// 		const skip = (pageNumber - 1) * limitNumber;
// 		const searchRegex = new RegExp(search, "i");

// 		const baseMatch = { issuedBy: new mongoose.Types.ObjectId(issuedBy) };

// 		const pipeline = [
// 			{ $match: baseMatch },

// 			{
// 				$lookup: {
// 					from: "users",
// 					localField: "reportedBy",
// 					foreignField: "_id",
// 					as: "reportedBy",
// 				},
// 			},
// 			{ $unwind: "$reportedBy" },

// 			{
// 				$lookup: {
// 					from: "certificates",
// 					let: { certId: "$certificateRef", certModel: "$certificateModel" },
// 					pipeline: [
// 						{
// 							$match: {
// 								$expr: {
// 									$and: [{ $eq: ["$$certModel", "Certificate"] }, { $eq: ["$_id", "$$certId"] }],
// 								},
// 							},
// 						},
// 						{ $project: { name: 1, issuedBy: 1, uniqueId: 1 } },
// 					],
// 					as: "certificateData1",
// 				},
// 			},

// 			{
// 				$lookup: {
// 					from: "revokedcertificates",
// 					let: { certId: "$certificateRef", certModel: "$certificateModel" },
// 					pipeline: [
// 						{
// 							$match: {
// 								$expr: {
// 									$and: [{ $eq: ["$$certModel", "RevokedCertificate"] }, { $eq: ["$_id", "$$certId"] }],
// 								},
// 							},
// 						},
// 						{ $project: { name: 1, issuedBy: 1, uniqueId: 1 } },
// 					],
// 					as: "certificateData2",
// 				},
// 			},

// 			{
// 				$addFields: {
// 					certificateRef: {
// 						$cond: {
// 							if: { $eq: ["$certificateModel", "Certificate"] },
// 							then: { $arrayElemAt: ["$certificateData1", 0] },
// 							else: { $arrayElemAt: ["$certificateData2", 0] },
// 						},
// 					},
// 				},
// 			},

// 			// 🔍 Search Match Stage
// 			{
// 				$match: {
// 					$or: [
// 						{ "certificateRef.name": { $regex: searchRegex } },
// 						{ "certificateRef.uniqueId": { $regex: searchRegex } },
// 						{ "reportedBy.name": { $regex: searchRegex } },
// 						{ "reportedBy.email": { $regex: searchRegex } },
// 					],
// 				},
// 			},

// 			{ $sort: { createdAt: -1 } },
// 			{ $skip: skip },
// 			{ $limit: limitNumber },

// 			{
// 				$project: {
// 					certificateData1: 0,
// 					certificateData2: 0,
// 				},
// 			},
// 		];

// 		const reports = await ErrorReport.aggregate(pipeline);

// 		// Count pipeline with same stages up to search
// 		const countPipeline = [
// 			{ $match: baseMatch },
// 			...pipeline.slice(
// 				1,
// 				pipeline.findIndex((stage) => stage.$match?.$or)
// 			), // Apply lookups up to search
// 			pipeline.find((stage) => stage.$match?.$or), // Apply search match
// 			{ $count: "total" },
// 		];

// 		const countResult = await ErrorReport.aggregate(countPipeline);
// 		const total = countResult[0]?.total || 0;

// 		return res.status(200).json({
// 			status: true,
// 			message: "Issuer error reports fetched successfully.",
// 			pagination: {
// 				total,
// 				page: pageNumber,
// 				limit: limitNumber,
// 				totalPages: Math.ceil(total / limitNumber),
// 			},
// 			data: reports,
// 		});
// 	} catch (error) {
// 		console.error("Error fetching issuer reports:", error);
// 		return res.status(500).json({ status: false, message: error.message });
// 	}
// };
reportIssue.getErrorReportIssuer = async (req, res) => {
	try {
		const issuedBy = req.authId;
		const { page = 1, limit = 10, search = "", startDate, endDate } = req.query;

		const pageNumber = parseInt(page, 10);
		const limitNumber = parseInt(limit, 10);
		const skip = (pageNumber - 1) * limitNumber;
		const searchRegex = new RegExp(search, "i");

		const baseMatch = { issuedBy: new mongoose.Types.ObjectId(issuedBy) };

		// Add date range filter if provided
		if (startDate || endDate) {
			baseMatch.createdAt = {};
			if (startDate) baseMatch.createdAt.$gte = new Date(startDate);
			if (endDate) {
				const end = new Date(endDate);
				end.setHours(23, 59, 59, 999); // include full day
				baseMatch.createdAt.$lte = end;
			}
		}

		const pipeline = [
			{ $match: baseMatch },

			{
				$lookup: {
					from: "users",
					localField: "reportedBy",
					foreignField: "_id",
					as: "reportedBy",
				},
			},
			{ $unwind: "$reportedBy" },

			{
				$lookup: {
					from: "certificates",
					let: { certId: "$certificateRef", certModel: "$certificateModel" },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [{ $eq: ["$$certModel", "Certificate"] }, { $eq: ["$_id", "$$certId"] }],
								},
							},
						},
						{ $project: { name: 1, issuedBy: 1, uniqueId: 1 } },
					],
					as: "certificateData1",
				},
			},

			{
				$lookup: {
					from: "revokedcertificates",
					let: { certId: "$certificateRef", certModel: "$certificateModel" },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [{ $eq: ["$$certModel", "RevokedCertificate"] }, { $eq: ["$_id", "$$certId"] }],
								},
							},
						},
						{ $project: { name: 1, issuedBy: 1, uniqueId: 1 } },
					],
					as: "certificateData2",
				},
			},

			{
				$addFields: {
					certificateRef: {
						$cond: {
							if: { $eq: ["$certificateModel", "Certificate"] },
							then: { $arrayElemAt: ["$certificateData1", 0] },
							else: { $arrayElemAt: ["$certificateData2", 0] },
						},
					},
				},
			},

			{
				$match: {
					$or: [
						{ "certificateRef.name": { $regex: searchRegex } },
						{ "certificateRef.uniqueId": { $regex: searchRegex } },
						{ "reportedBy.name": { $regex: searchRegex } },
						{ "reportedBy.email": { $regex: searchRegex } },
					],
				},
			},

			{ $sort: { createdAt: -1 } },
			{ $skip: skip },
			{ $limit: limitNumber },

			{
				$project: {
					certificateData1: 0,
					certificateData2: 0,
				},
			},
		];

		// Count pipeline (same date + base match + search)
		const countPipeline = [
			{ $match: baseMatch },
			...pipeline.slice(
				1,
				pipeline.findIndex((stage) => stage.$match?.$or)
			),
			pipeline.find((stage) => stage.$match?.$or),
			{ $count: "total" },
		];

		const reports = await ErrorReport.aggregate(pipeline);
		const countResult = await ErrorReport.aggregate(countPipeline);
		const total = countResult[0]?.total || 0;

		return res.status(200).json({
			status: true,
			message: "Issuer error reports fetched successfully.",
			pagination: {
				total,
				page: pageNumber,
				limit: limitNumber,
				totalPages: Math.ceil(total / limitNumber),
			},
			data: reports,
		});
	} catch (error) {
		console.error("Error fetching issuer reports:", error);
		return res.status(500).json({ status: false, message: error.message });
	}
};

//error report admin side
// reportIssue.getErrorReportAdminSide = async (req, res) => {
// 	try {
// 		const { page = 1, limit = 10, search = "" } = req.query;

// 		const pageNumber = parseInt(page);
// 		const limitNumber = parseInt(limit);
// 		const skip = (pageNumber - 1) * limitNumber;
// 		const searchRegex = new RegExp(search.trim(), "i");

// 		const aggregationPipeline = [
// 			// Lookup User (reportedBy)
// 			{
// 				$lookup: {
// 					from: "users",
// 					localField: "reportedBy",
// 					foreignField: "_id",
// 					as: "reportedBy",
// 				},
// 			},
// 			{ $unwind: "$reportedBy" },

// 			// Lookup Certificate if model is "Certificate"
// 			{
// 				$lookup: {
// 					from: "certificates",
// 					let: { certId: "$certificateRef", certModel: "$certificateModel" },
// 					pipeline: [
// 						{
// 							$match: {
// 								$expr: {
// 									$and: [{ $eq: ["$$certModel", "Certificate"] }, { $eq: ["$_id", "$$certId"] }],
// 								},
// 							},
// 						},
// 						{ $project: { name: 1, issuedBy: 1, uniqueId: 1 } },
// 					],
// 					as: "certificateData1",
// 				},
// 			},

// 			// Lookup RevokedCertificate if model is "RevokedCertificate"
// 			{
// 				$lookup: {
// 					from: "revokedcertificates",
// 					let: { certId: "$certificateRef", certModel: "$certificateModel" },
// 					pipeline: [
// 						{
// 							$match: {
// 								$expr: {
// 									$and: [{ $eq: ["$$certModel", "RevokedCertificate"] }, { $eq: ["$_id", "$$certId"] }],
// 								},
// 							},
// 						},
// 						{ $project: { name: 1, issuedBy: 1, uniqueId: 1 } },
// 					],
// 					as: "certificateData2",
// 				},
// 			},

// 			// Merge the correct certificateData
// 			{
// 				$addFields: {
// 					certificateRef: {
// 						$cond: {
// 							if: { $eq: ["$certificateModel", "Certificate"] },
// 							then: { $arrayElemAt: ["$certificateData1", 0] },
// 							else: { $arrayElemAt: ["$certificateData2", 0] },
// 						},
// 					},
// 				},
// 			},

// 			// Search filter
// 			{
// 				$match: {
// 					$or: [
// 						{ errorMessage: { $regex: searchRegex } },
// 						{ "reportedBy.name": { $regex: searchRegex } },
// 						{ "certificateRef.name": { $regex: searchRegex } },
// 					],
// 				},
// 			},

// 			// Sort newest first
// 			{ $sort: { createdAt: -1 } },

// 			// Pagination
// 			{ $skip: skip },
// 			{ $limit: limitNumber },

// 			// Optional: remove temp lookup arrays
// 			{
// 				$project: {
// 					certificateData1: 0,
// 					certificateData2: 0,
// 				},
// 			},
// 		];

// 		const errorReports = await ErrorReport.aggregate(aggregationPipeline);

// 		// Count total matching reports (reuse pipeline minus pagination)
// 		const countPipeline = aggregationPipeline.filter(
// 			(stage) => !("$skip" in stage || "$limit" in stage || "$project" in stage)
// 		);
// 		countPipeline.push({ $count: "total" });

// 		const countResult = await ErrorReport.aggregate(countPipeline);
// 		const totalReports = countResult[0]?.total || 0;

// 		return res.status(200).json({
// 			status: true,
// 			message: "Reports fetched successfully.",
// 			pagination: {
// 				totalReports,
// 				page: pageNumber,
// 				limit: limitNumber,
// 				totalPages: Math.ceil(totalReports / limitNumber),
// 			},
// 			data: errorReports,
// 		});
// 	} catch (error) {
// 		console.error("Error fetching error reports:", error);
// 		return res.status(500).json({ status: false, message: error.message });
// 	}
// };

reportIssue.getErrorReportAdminSide = async (req, res) => {
	try {
		const { page = 1, limit = 10, search = "", startDate, endDate } = req.query;

		const pageNumber = parseInt(page);
		const limitNumber = parseInt(limit);
		const skip = (pageNumber - 1) * limitNumber;
		const searchRegex = new RegExp(search.trim(), "i");

		// Date filter setup
		const dateFilter = {};
		if (startDate) dateFilter.$gte = new Date(startDate);
		if (endDate) dateFilter.$lte = new Date(endDate);

		const aggregationPipeline = [
			// Optional match for createdAt filtering
			...(Object.keys(dateFilter).length > 0 ? [{ $match: { createdAt: dateFilter } }] : []),

			// Lookup User (reportedBy)
			{
				$lookup: {
					from: "users",
					localField: "reportedBy",
					foreignField: "_id",
					as: "reportedBy",
				},
			},
			{ $unwind: "$reportedBy" },

			// Lookup Certificate if model is "Certificate"
			{
				$lookup: {
					from: "certificates",
					let: { certId: "$certificateRef", certModel: "$certificateModel" },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [{ $eq: ["$$certModel", "Certificate"] }, { $eq: ["$_id", "$$certId"] }],
								},
							},
						},
						{ $project: { name: 1, issuedBy: 1, uniqueId: 1 } },
					],
					as: "certificateData1",
				},
			},

			// Lookup RevokedCertificate if model is "RevokedCertificate"
			{
				$lookup: {
					from: "revokedcertificates",
					let: { certId: "$certificateRef", certModel: "$certificateModel" },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [{ $eq: ["$$certModel", "RevokedCertificate"] }, { $eq: ["$_id", "$$certId"] }],
								},
							},
						},
						{ $project: { name: 1, issuedBy: 1, uniqueId: 1 } },
					],
					as: "certificateData2",
				},
			},

			// Merge the correct certificateData
			{
				$addFields: {
					certificateRef: {
						$cond: {
							if: { $eq: ["$certificateModel", "Certificate"] },
							then: { $arrayElemAt: ["$certificateData1", 0] },
							else: { $arrayElemAt: ["$certificateData2", 0] },
						},
					},
				},
			},

			// Search filter
			{
				$match: {
					$or: [
						{ errorMessage: { $regex: searchRegex } },
						{ "reportedBy.name": { $regex: searchRegex } },
						{ "certificateRef.name": { $regex: searchRegex } },
					],
				},
			},

			// Sort newest first
			{ $sort: { createdAt: -1 } },

			// Pagination
			{ $skip: skip },
			{ $limit: limitNumber },

			// Remove temp arrays
			{
				$project: {
					certificateData1: 0,
					certificateData2: 0,
				},
			},
		];

		const errorReports = await ErrorReport.aggregate(aggregationPipeline);

		// Count total matching reports
		const countPipeline = aggregationPipeline.filter(
			(stage) => !("$skip" in stage || "$limit" in stage || "$project" in stage)
		);
		countPipeline.push({ $count: "total" });

		const countResult = await ErrorReport.aggregate(countPipeline);
		const totalReports = countResult[0]?.total || 0;

		return res.status(200).json({
			status: true,
			message: "Reports fetched successfully.",
			pagination: {
				totalReports,
				page: pageNumber,
				limit: limitNumber,
				totalPages: Math.ceil(totalReports / limitNumber),
			},
			data: errorReports,
		});
	} catch (error) {
		console.error("Error fetching error reports:", error);
		return res.status(500).json({ status: false, message: error.message });
	}
};

// Resolve an error report (only if certificate is revoked)
reportIssue.resolveErrorReport = async (req, res) => {
	try {
		const { reportId } = req.body;

		const errorReport = await ErrorReport.findById(reportId);
		if (!errorReport) {
			return res.status(404).json({ status: false, message: "Error report not found" });
		}

		if (errorReport.certificateModel !== "RevokedCertificate") {
			return res.status(400).json({ status: false, message: "Certificate is not revoked yet." });
		}

		const revokedCertificate = await RevokedCertificate.findById(errorReport.certificateRef);
		// if (!revokedCertificate || !revokedCertificate.revoked) {
		// 	return res.status(400).json({ status: false, message: "Certificate is not revoked yet ." });
		// }
		if (!revokedCertificate) {
			return res.status(400).json({ status: false, message: "Certificate is not revoked yet ." });
		}

		errorReport.status = "resolved";
		await errorReport.save();

		return res.status(200).json({ status: true, message: "Error report resolved successfully." });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

module.exports = reportIssue;
