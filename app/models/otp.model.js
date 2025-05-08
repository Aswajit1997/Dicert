const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
	{
		email: { type: String, required: true },
		otpCode: { type: String, required: true },
		userType: {
			type: String,
			enum: ["User", "Issuer", "Admin"],
			required: true,
		},
		expiresAt: {
			type: Date,
			required: true,
			default: () => new Date(Date.now() + 3 * 60 * 1000), // Expires in 3 minutes
		},
	},
	{ timestamps: true }
);

// Automatically remove expired OTPs after 'expiresAt'
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("OTP", otpSchema);
