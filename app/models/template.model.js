const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema(
	{
		templateName: { type: String },
		templateHTML: { type: String },
		templatePreview: { type: String },
		templateUrl: { type: String },
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
		downloadCSV: { type: String },
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Template", templateSchema);
