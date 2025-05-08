const mongoose = require("mongoose");

const errorReport = new mongoose.Schema(
	{
		certificateRef: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
			refPath: "certificateModel", // this determines which model to use
		},
		certificateModel: {
			type: String,
			required: true,
			enum: ["Certificate", "RevokedCertificate"], // allowed models
		},
		reportedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		issuedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Issuer",
			required: true,
		},
		errorMessage: {
			type: String,
			required: true,
		},
		attachments: {
			type: String,
		},
		status: {
			type: String,
			default: "pending",
			enum: ["pending", "revoked", "resolved", "confirmed_valid"],
		},
	},
	{ timestamps: true }
);

// Optional: Middleware to auto-set the correct model type based on status
errorReport.pre("validate", function (next) {
	if (this.status === "pending" || this.status === "confirmed_valid") {
		this.certificateModel = "Certificate";
	} else {
		this.certificateModel = "RevokedCertificate";
	}
	next();
});

module.exports = mongoose.model("errorReport", errorReport);
