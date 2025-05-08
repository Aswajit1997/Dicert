const User = require("../models/user.model");
const OTP = require("../models/otp.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// User Controller
const user = {};

// Send OTP
user.sendOtp = async (req, res) => {
	// #swagger.tags = ['Regular User']
	try {
		const { email, userType } = req.body;

		// Check if user already exists
		const existingUser = await User.findOne({ email });
		if (existingUser) {
			return res.status(400).json({ status: false, message: "User already exists" });
		}

		// Generate OTP (4-digit)
		const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

		// Check if an OTP already exists for this email
		let otpEntry = await OTP.findOne({ email, userType });
		if (otpEntry) {
			// Update existing OTP and expiration time
			otpEntry.otpCode = otpCode;
			otpEntry.expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes
			await otpEntry.save();
		} else {
			// Create a new OTP entry
			otpEntry = new OTP({ email, otpCode, userType });
			await otpEntry.save();
		}

		// Send OTP to email (Add your email logic here)
		console.log(`OTP for ${email}: ${otpCode}`);

		return res.status(200).json({ status: true, message: "OTP sent to email", data: otpCode });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

// Sign Up
user.signUp = async (req, res) => {
	// #swagger.tags = ['Regular User']
	try {
		const { name, email, password, phoneNumber, countryCode } = req.body;

		// Check if user already exists
		let existingUser = await User.findOne({ email });

		if (!existingUser) {
			existingUser = new User({
				name,
				email,
				password,
				phoneNumber,
				countryCode,
			});
			await existingUser.save();
		} else {
			// User exists, check password conditions
			const isDefaultPassword = await bcrypt.compare("user@123", existingUser.password);
			if (isDefaultPassword) {
				// Update password if it's the default one
				existingUser.password = password;
				existingUser.phoneNumber = phoneNumber;
				existingUser.name = name;
				existingUser.countryCode = countryCode;
				await existingUser.save();
			} else {
				// If password is different from default, reject signup
				return res.status(400).json({ status: false, message: "User already exists, please log in." });
			}
		}

		// Generate OTP (4-digit)
		const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

		// Check if OTP already exists for this user
		let otpEntry = await OTP.findOne({ email, userType: "User" });
		if (otpEntry) {
			otpEntry.otpCode = otpCode;
			otpEntry.expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3-minute expiry
			await otpEntry.save();
		} else {
			otpEntry = new OTP({ email, otpCode, userType: "User" });
			await otpEntry.save();
		}

		return res.status(200).json({ status: true, message: "OTP sent for verification", otp: otpCode });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

// Login (Step 1) - Send OTP for login
user.login = async (req, res) => {
	// #swagger.tags = ['Regular User']
	try {
		const { email, password } = req.body;

		// Check if user exists
		const existingUser = await User.findOne({ email });
		if (!existingUser) {
			return res.status(400).json({ status: false, message: "User not found" });
		}

		// Verify password
		const isMatch = await bcrypt.compare(password, existingUser.password);
		if (!isMatch) {
			return res.status(400).json({ status: false, message: "Invalid credentials" });
		}

		// Generate OTP for login verification
		const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
		let otpEntry = await OTP.findOne({ email, userType: "User" });

		if (otpEntry) {
			otpEntry.otpCode = otpCode;
			otpEntry.expiresAt = new Date(Date.now() + 3 * 60 * 1000); // OTP valid for 3 minutes
			await otpEntry.save();
		} else {
			otpEntry = new OTP({ email, otpCode, userType: "User" });
			await otpEntry.save();
		}

		console.log(`Login OTP for ${email}: ${otpCode}`);
		return res.status(200).json({ status: true, message: "OTP sent for login verification", otp: otpCode });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

// Login - Step 2: Verify OTP and complete login
user.verifyLoginOtp = async (req, res) => {
	// #swagger.tags = ['Regular User']
	try {
		const { email, otpCode } = req.body;

		const otpEntry = await OTP.findOne({ email, otpCode, userType: "User" });
		if (!otpEntry) {
			return res.status(400).json({ status: false, message: "Invalid OTP" });
		}

		if (otpEntry.expiresAt < Date.now()) {
			return res.status(400).json({ status: false, message: "OTP expired" });
		}

		const existingUser = await User.findOne({ email });
		if (!existingUser) {
			return res.status(400).json({ status: false, message: "User not found" });
		}

		const token = jwt.sign({ userId: existingUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

		// Delete OTP after successful login
		await OTP.deleteOne({ _id: otpEntry._id });

		return res.status(200).json({ status: true, message: "Login successful", data: { token, user: existingUser } });
	} catch (error) {
		res.status(500).json({ status: false, message: error.message });
	}
};

module.exports = user;
