const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const Issuer = require("../models/issuer.model");
const Admin = require("../models/admin.model");

// Generic token verification
async function verifyToken(req, res) {
	const token = req.header("Authorization");
	if (!token) {
		return res.status(401).json({ data: null, status: false, message: "Access Denied: No token provided" });
	}

	try {
		// Verify token and extract authId
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.authId = decoded.userId || decoded.issuerId || decoded.adminId;
		if (!req.authId) {
			return res.status(401).json({ data: null, status: false, message: "Invalid Token" });
		}
		return true;
	} catch (error) {
		return res.status(401).json({ data: null, status: false, message: "Invalid Token" });
	}
}

// Fetch User, Issuer, or Admin based on authId
async function verifyUserToken(req, res, next) {
	if (!(await verifyToken(req, res))) return;
	try {
		const user = await User.findById(req.authId);
		if (!user) {
			return res.status(404).json({ data: null, status: false, message: "User not found" });
		}
		req.auth = user;
		next();
	} catch (error) {
		return res.status(500).json({ data: null, status: false, message: "Server Error" });
	}
}

async function verifyIssuerToken(req, res, next) {
	if (!(await verifyToken(req, res))) return;
	try {
		const issuer = await Issuer.findById(req.authId);
		if (!issuer) {
			return res.status(404).json({ data: null, status: false, message: "Issuer not found" });
		}
		req.auth = issuer;
		next();
	} catch (error) {
		return res.status(500).json({ data: null, status: false, message: "Server Error" });
	}
}
async function verifyIssuerTokenActiveCheck(req, res, next) {
	if (!(await verifyToken(req, res))) return;
	try {
		const issuer = await Issuer.findById(req.authId);
		if (!issuer) {
			return res.status(404).json({ data: null, status: false, message: "Issuer not found" });
		}
		if (!issuer?.active) {
			return res
				.status(403)
				.json({ data: null, status: false, message: "Your Account is not active plz contact support team.." });
		}
		req.auth = issuer;
		next();
	} catch (error) {
		return res.status(500).json({ data: null, status: false, message: "Server Error" });
	}
}

async function verifyAdminToken(req, res, next) {
	if (!(await verifyToken(req, res))) return;
	try {
		const admin = await Admin.findById(req.authId);
		if (!admin) {
			return res.status(404).json({ data: null, status: false, message: "Admin not found" });
		}
		req.auth = admin;
		next();
	} catch (error) {
		return res.status(500).json({ data: null, status: false, message: "Server Error" });
	}
}

async function verifyIssuerOrAdmin(req, res, next) {
	if (!(await verifyToken(req, res))) return;
	try {
		// Check if it's an Admin
		const admin = await Admin.findById(req.authId);
		if (admin) {
			req.auth = admin;
			return next();
		}

		// If not an Admin, check if it's an Issuer
		const issuer = await Issuer.findById(req.authId);
		if (!issuer) {
			return res.status(404).json({ data: null, status: false, message: "Invalid token 🥹" });
		}
		req.auth = issuer;
		next();
	} catch (error) {
		return res.status(500).json({ data: null, status: false, message: "Server Error" });
	}
}

module.exports = { verifyUserToken, verifyIssuerToken, verifyIssuerTokenActiveCheck, verifyAdminToken, verifyIssuerOrAdmin };
