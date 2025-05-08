const mongoose = require("mongoose");

const folderSchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		certificates: [{ type: mongoose.Schema.Types.ObjectId, ref: "Certificate" }],
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Folder", folderSchema);
