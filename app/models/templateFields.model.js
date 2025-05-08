const mongoose = require("mongoose");

const templateFieldsSchema = new mongoose.Schema(
	{
		fieldName: { type: String },
		htmlPlaceholder: { type: String },
		placeHolder: { type: String },
		inputFrom: { type: String, enum: ["custom", "csv"] },
		fieldType: { enum: ["text", "file"], type: String },
		isDeleted: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

module.exports = mongoose.model("TemplateFields", templateFieldsSchema);
