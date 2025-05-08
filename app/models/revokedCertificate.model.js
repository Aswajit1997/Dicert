const mongoose = require("mongoose");

const revokedCertificateSchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		format: { type: String, enum: ["png", "jpeg", "jpg", "pdf"], required: true },
		filePath: { type: String, required: true },
		size: { type: Number },
		accessibility: { type: String, enum: ["Shared", "Not Shared"], default: "Not Shared" },
		accessPeopleList: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
		isAddedToFavorite: { type: Boolean, default: false },
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		folder: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", default: null },
		issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Issuer", default: null },
		issuedTemplateHTML: { type: String },
		templateId: { type: mongoose.Schema.Types.ObjectId, ref: "Template", default: null },
		customFields: [
			{
				fieldName: { type: String },
				placeHolder: { type: String },
				fieldType: { enum: ["text", "number", "date", "file"], type: String },
			},
		],
		csvFields: [
			{
				fieldName: { type: String },
				placeHolder: { type: String },
				fieldType: { enum: ["text", "number", "date"], type: String },
			},
		],
		uniqueId: { type: String, required: true },
		revokedFrom: { type: String, enum: ["issuer", "error_report"], default: "error_report" }, //default from error report and issued if issuer revoked by themselves by seeing the certificate
	},
	{ timestamps: true }
);

module.exports = mongoose.model("RevokedCertificate", revokedCertificateSchema);
