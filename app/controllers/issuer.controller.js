const Issuer = require("../models/issuer.model");
const OTP = require("../models/otp.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Issuer Controller
const issuer = {};

// Send OTP for Signup
issuer.sendOtp = async (req, res) => {
	try {
		const { email, userType } = req.body;

		const existingIssuer = await Issuer.findOne({ email });
		if (existingIssuer) {
			return res.status(400).json({ status: false, message: "Issuer already exists" });
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
issuer.signUp = async (req, res) => {
	try {
		const { organizationName, organizationAddress, email, password, cacNumber, phoneNumber, countryCode } = req.body;

		// Check if issuer already exists
		let existingIssuer = await Issuer.findOne({ email });

		if (!existingIssuer) {
			// Create a new issuer (without OTP verification)
			const hashedPassword = await bcrypt.hash(password, 10);
			existingIssuer = new Issuer({
				organizationName,
				organizationAddress,
				cacNumber,
				email,
				password: hashedPassword,
				phoneNumber,
				countryCode,
			});
			await existingIssuer.save();
		}

		// Generate OTP (4-digit)
		const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

		// Check if OTP already exists for this email
		let otpEntry = await OTP.findOne({ email, userType: "Issuer" });
		if (otpEntry) {
			otpEntry.otpCode = otpCode;
			otpEntry.expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3-minute expiry
			await otpEntry.save();
		} else {
			otpEntry = new OTP({ email, otpCode, userType: "Issuer" });
			await otpEntry.save();
		}

		// Send OTP to email (replace with email sending logic)
		console.log(`Signup OTP for ${email}: ${otpCode}`);

		return res.status(200).json({ status: true, message: "OTP sent for verification", otp: otpCode });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};


// Login with Email and Password (with OTP verification)
issuer.login = async (req, res) => {
	try {
		const { email, password } = req.body;

		const issuer = await Issuer.findOne({ email });
		if (!issuer) {
			return res.status(400).json({ status: false, message: "Issuer not found" });
		}

		const isMatch = await bcrypt.compare(password, issuer.password);
		if (!isMatch) {
			return res.status(400).json({ status: false, message: "Invalid credentials" });
		}

		// Generate OTP for login verification
		const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
		let otpEntry = await OTP.findOne({ email, userType: "Issuer" });

		if (otpEntry) {
			otpEntry.otpCode = otpCode;
			otpEntry.expiresAt = new Date(Date.now() + 3 * 60 * 1000); // OTP valid for 3 minutes
			await otpEntry.save();
		} else {
			otpEntry = new OTP({ email, otpCode, userType: "Issuer" });
			await otpEntry.save();
		}

		console.log(`Login OTP for ${email}: ${otpCode}`);
		return res.status(200).json({ status: true, message: "OTP sent for login verification", otp: otpCode });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

// Verify OTP and Complete Login
issuer.verifyLoginOtp = async (req, res) => {
	try {
		const { email, otpCode } = req.body;

		const otpEntry = await OTP.findOne({ email, otpCode, userType: "Issuer" });
		if (!otpEntry) {
			return res.status(400).json({ status: false, message: "Invalid OTP" });
		}

		if (otpEntry.expiresAt < Date.now()) {
			return res.status(400).json({ status: false, message: "OTP expired" });
		}

		const issuer = await Issuer.findOne({ email });
		if (!issuer) {
			return res.status(400).json({ status: false, message: "Issuer not found" });
		}

		const token = jwt.sign({ issuerId: issuer._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

		// Delete OTP after successful login
		await OTP.deleteOne({ _id: otpEntry._id });

		return res.status(200).json({ status: true, message: "Login successful", data: { token, issuer } });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

module.exports = issuer;
