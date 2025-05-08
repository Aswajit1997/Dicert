const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		format: { type: String, enum: ["png", "jpeg", "jpg", "pdf"], required: true },
		filePath: { type: String, required: true },
		size: { type: Number },
		accessibility: { type: String, enum: ["Shared", "Not Shared"], default: "Not Shared" },
		accessPeopleList: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
		isAddedToFavorite: { type: Boolean, default: false },
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		folder: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", default: null }, // Can be null if not in a folder
		issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Issuer", default: null }, //null if created/upload by user
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
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Certificate", certificateSchema);
