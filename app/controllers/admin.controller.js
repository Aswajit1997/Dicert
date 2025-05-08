const Admin = require("../models/admin.model");
const Issuer = require("../models/issuer.model");
const User = require("../models/user.model");
const Certificate = require("../models/certificates.model");
const OTP = require("../models/otp.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Admin Controller
const admin = {};

// Send OTP
admin.sendOtp = async (req, res) => {
	try {
		const { email, userType } = req.body;

		const existingAdmin = await Admin.findOne({ email });
		if (existingAdmin) {
			return res.status(400).json({ status: false, message: "Admin already exists" });
		}

		const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
		let otpEntry = await OTP.findOne({ email, userType });

		if (otpEntry) {
			otpEntry.otpCode = otpCode;
			otpEntry.expiresAt = new Date(Date.now() + 3 * 60 * 1000);
			await otpEntry.save();
		} else {
			otpEntry = new OTP({ email, otpCode, userType });
			await otpEntry.save();
		}

		console.log(`OTP for ${email}: ${otpCode}`);
		return res.status(200).json({ status: true, message: "OTP sent to email", data: otpCode });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

// Sign Up
admin.signUp = async (req, res) => {
	try {
		const { name, email, password, phoneNumber, countryCode, otpCode } = req.body;

		const otpEntry = await OTP.findOne({ email, otpCode });
		if (!otpEntry) {
			return res.status(400).json({ status: false, message: "Invalid OTP" });
		}

		if (otpEntry.expiresAt < Date.now()) {
			return res.status(400).json({ status: false, message: "OTP expired" });
		}

		const newAdmin = new Admin({
			name,
			email,
			password,
			phoneNumber,
			countryCode,
		});
		await newAdmin.save();
		await OTP.deleteOne({ _id: otpEntry._id });

		return res.status(201).json({ status: true, message: "Signup successful. You can now log in." });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

// Login
admin.login = async (req, res) => {
	try {
		const { email, password } = req.body;

		const admin = await Admin.findOne({ email });
		if (!admin) {
			return res.status(400).json({ status: false, message: "Admin not found" });
		}

		const isMatch = await bcrypt.compare(password, admin.password);
		if (!isMatch) {
			return res.status(400).json({ status: false, message: "Invalid credentials" });
		}

		// Generate OTP for login verification
		const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
		let otpEntry = await OTP.findOne({ email, userType: "Admin" });

		if (otpEntry) {
			otpEntry.otpCode = otpCode;
			otpEntry.expiresAt = new Date(Date.now() + 3 * 60 * 1000); // OTP valid for 3 minutes
			await otpEntry.save();
		} else {
			otpEntry = new OTP({ email, otpCode, userType: "Admin" });
			await otpEntry.save();
		}
		return res.status(200).json({ status: true, message: "OTP sent for login verification", otp: otpCode });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

// Login - Step 2: Verify OTP and complete login
admin.verifyLoginOtp = async (req, res) => {
	try {
		const { email, otpCode } = req.body;

		const otpEntry = await OTP.findOne({ email, otpCode, userType: "Admin" });
		if (!otpEntry) {
			return res.status(400).json({ status: false, message: "Invalid OTP" });
		}

		if (otpEntry.expiresAt < Date.now()) {
			return res.status(400).json({ status: false, message: "OTP expired" });
		}

		const admin = await Admin.findOne({ email });
		if (!admin) {
			return res.status(400).json({ status: false, message: "Admin not found" });
		}

		const token = jwt.sign({ adminId: admin._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

		// Delete OTP after successful login
		await OTP.deleteOne({ _id: otpEntry._id });

		return res.status(200).json({ status: true, message: "Login successful", data: { token, admin } });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

//get all generated certificates
// admin.generatedCertificates = async (req, res) => {
// 	try {
// 		const { page = 1, limit = 10, search = "" } = req.query;

// 		const pageNumber = Math.max(parseInt(page, 10), 1);
// 		const limitNumber = Math.max(parseInt(limit, 10), 1);
// 		const skip = (pageNumber - 1) * limitNumber;

// 		const searchRegex = new RegExp(search.trim(), "i");

// 		const pipeline = [
// 			{
// 				$match: {
// 					issuedBy: { $ne: null },
// 				},
// 			},
// 			{
// 				$lookup: {
// 					from: "issuers", //
// 					localField: "issuedBy",
// 					foreignField: "_id",
// 					as: "issuedBy",
// 				},
// 			},
// 			{ $unwind: "$issuedBy" },
// 			{
// 				$match: {
// 					$or: [{ name: { $regex: searchRegex } }, { "issuedBy.organizationName": { $regex: searchRegex } }],
// 				},
// 			},
// 			{
// 				$project: {
// 					name: 1,
// 					format: 1,
// 					filePath: 1,
// 					createdAt: 1,
// 					issuedTemplateHTML: 1,
// 					user: 1,
// 					issuedBy: {
// 						_id: "$issuedBy._id",
// 						organizationName: "$issuedBy.organizationName",
// 						email: "$issuedBy.email",
// 					},
// 				},
// 			},
// 			{ $sort: { createdAt: -1 } },
// 			{
// 				$facet: {
// 					data: [{ $skip: skip }, { $limit: limitNumber }],
// 					totalCount: [{ $count: "count" }],
// 				},
// 			},
// 		];

// 		const result = await Certificate.aggregate(pipeline);

// 		const certificates = result[0].data;
// 		const total = result[0].totalCount[0]?.count || 0;

// 		res.status(200).json({
// 			status: true,
// 			message: "Generated certificates fetched successfully.",
// 			data: certificates,
// 			pagination: {
// 				total,
// 				page: pageNumber,
// 				limit: limitNumber,
// 				totalPages: Math.ceil(total / limitNumber),
// 			},
// 		});
// 	} catch (error) {
// 		console.error("Error fetching generated certificates:", error);
// 		res.status(500).json({ status: false, message: error.message });
// 	}
// };
admin.generatedCertificates = async (req, res) => {
	try {
		const { page = 1, limit = 10, search = "", startDate, endDate } = req.query;

		const pageNumber = Math.max(parseInt(page, 10), 1);
		const limitNumber = Math.max(parseInt(limit, 10), 1);
		const skip = (pageNumber - 1) * limitNumber;
		const searchRegex = new RegExp(search.trim(), "i");

		// Build the createdAt date filter
		const dateFilter = {};
		if (startDate) dateFilter.$gte = new Date(startDate);
		if (endDate) dateFilter.$lte = new Date(endDate);

		const pipeline = [
			{
				$match: {
					issuedBy: { $ne: null },
					...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
				},
			},
			{
				$lookup: {
					from: "issuers",
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
					format: 1,
					filePath: 1,
					createdAt: 1,
					issuedTemplateHTML: 1,
					user: 1,
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

		const result = await Certificate.aggregate(pipeline);

		const certificates = result[0].data;
		const total = result[0].totalCount[0]?.count || 0;

		res.status(200).json({
			status: true,
			message: "Generated certificates fetched successfully.",
			data: certificates,
			pagination: {
				total,
				page: pageNumber,
				limit: limitNumber,
				totalPages: Math.ceil(total / limitNumber),
			},
		});
	} catch (error) {
		console.error("Error fetching generated certificates:", error);
		res.status(500).json({ status: false, message: error.message });
	}
};

// Get all issuers with optional status filter

admin.fetchIssuers = async (req, res) => {
	try {
		const { page = 1, limit = 10, status, search } = req.query;

		const pageNumber = Math.max(parseInt(page, 10), 1);
		const limitNumber = Math.max(parseInt(limit, 10), 1);
		const skip = (pageNumber - 1) * limitNumber;

		// Base query
		const query = {};

		// Handle status filter
		if (status !== undefined) {
			query.active = status === "inActive" ? false : true;
		}

		// Handle search by name or email
		if (search && search.trim() !== "") {
			const searchRegex = new RegExp(search.trim(), "i"); // case-insensitive
			query.$or = [{ organizationName: { $regex: searchRegex } }, { email: { $regex: searchRegex } }];
		}

		// Fetch data and total count concurrently
		const [issuers, total] = await Promise.all([
			Issuer.find(query).skip(skip).limit(limitNumber).select("-updatedAt -password -__v").lean().sort({ createdAt: -1 }),
			Issuer.countDocuments(query),
		]);

		return res.status(200).json({
			status: true,
			message: "Issuer's data fetched successfully.",
			data: issuers,
			pagination: {
				total,
				page: pageNumber,
				limit: limitNumber,
				totalPages: Math.ceil(total / limitNumber),
			},
		});
	} catch (error) {
		console.error("Error fetching issuer's data:", error);
		res.status(500).json({ status: false, message: error.message });
	}
};

// toggle  issuer / active-deActive
admin.activeDeActiveIssuer = async (req, res) => {
	try {
		const { issuerId } = req.params;
		const { status } = req.body;

		// Check if status is a boolean
		if (typeof status !== "boolean") {
			return res.status(400).json({
				success: false,
				message: "Invalid 'status' value. Must be a boolean (true or false).",
			});
		}

		// Find issuer by ID
		const issuer = await Issuer.findById(issuerId);
		if (!issuer) {
			return res.status(404).json({ success: false, message: "Issuer not found" });
		}

		// Update status
		issuer.active = status;
		await issuer.save();

		const stateText = status ? "activated" : "deactivated";
		res.status(200).json({
			success: true,
			message: `Issuer ${stateText} successfully`,
			issuer,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Server Error",
			error: error.message,
		});
	}
};

// get Analytics
// admin.getAnalytics = async (req, res) => {
// 	try {
// 		const { startDate, endDate } = req.query;

// 		let filter = {};
// 		if (startDate && endDate) {
// 			filter = {
// 				createdAt: {
// 					$gte: new Date(startDate),
// 					$lte: new Date(endDate),
// 				},
// 			};
// 		}

// 		// Total users
// 		const totalUsers = await User.countDocuments(filter);

// 		// Total issuers
// 		const totalIssuers = await Issuer.countDocuments(filter);

// 		// Total certificates where issuedBy is NOT null (i.e., created by issuer)
// 		const totalCertificatesGenerated = await Certificate.countDocuments({
// 			issuedBy: { $ne: null },
// 			...(startDate && endDate && filter),
// 		});

// 		const data = {
// 			totalUsers,
// 			totalIssuers,
// 			totalCertificatesGenerated,
// 		};

// 		res.status(200).json({
// 			success: true,
// 			message: `Report fetched successfully`,
// 			data,
// 		});
// 	} catch (error) {
// 		res.status(500).json({
// 			success: false,
// 			message: "Server Error",
// 			error: error.message,
// 		});
// 	}
// };
admin.getAnalytics = async (req, res) => {
	try {
		const { startDate, endDate } = req.query;

		let filter = {};
		if (startDate && endDate) {
			const start = new Date(startDate);
			const end = new Date(endDate);
			end.setDate(end.getDate() + 1); // include full endDate

			filter = {
				createdAt: {
					$gte: start,
					$lt: end,
				},
			};
		}

		// Total users
		const totalUsers = await User.countDocuments(filter);

		// Total issuers
		const totalIssuers = await Issuer.countDocuments(filter);

		// Total certificates where issuedBy is NOT null
		const certificateFilter = {
			issuedBy: { $ne: null },
			...(startDate && endDate ? { createdAt: filter.createdAt } : {}),
		};
		const totalCertificatesGenerated = await Certificate.countDocuments(certificateFilter);

		const data = {
			totalUsers,
			totalIssuers,
			totalCertificatesGenerated,
		};

		res.status(200).json({
			success: true,
			message: "Report fetched successfully",
			data,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Server Error",
			error: error.message,
		});
	}
};

//get monthly data
admin.getMonthlyData = async (req, res) => {
	try {
		const { month } = req.query; // Format: "YYYY-MM"
		if (!month) {
			return res.status(400).json({ success: false, message: "Month is required in 'YYYY-MM' format" });
		}

		const [year, monthIndex] = month.split("-");
		const yearInt = parseInt(year);
		const monthInt = parseInt(monthIndex) - 1;

		const startDate = new Date(yearInt, monthInt, 1);
		const endDate = new Date(yearInt, monthInt + 1, 1); // first day of next month (exclusive upper bound)

		const daysInMonth = new Date(yearInt, monthInt + 1, 0).getDate();

		const userCounts = Array(daysInMonth).fill(0);
		const issuerCounts = Array(daysInMonth).fill(0);

		const users = await User.find({
			createdAt: {
				$gte: startDate,
				$lt: endDate,
			},
		});

		const issuers = await Issuer.find({
			createdAt: {
				$gte: startDate,
				$lt: endDate,
			},
		});

		users.forEach((user) => {
			const day = new Date(user.createdAt).getDate();
			userCounts[day - 1]++;
		});

		issuers.forEach((issuer) => {
			const day = new Date(issuer.createdAt).getDate();
			issuerCounts[day - 1]++;
		});

		const data = [
			{ name: "Issuers", data: issuerCounts },
			{ name: "Users", data: userCounts },
		];

		res.status(200).json({
			success: true,
			message: "Monthly data fetched successfully",
			data,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Server Error",
			error: error.message,
		});
	}
};

module.exports = admin;
