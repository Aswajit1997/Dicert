const mongoose = require("mongoose");

const eLockerSchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, 
		certificates: [{ type: mongoose.Schema.Types.ObjectId, ref: "Certificate" }], // Certificates not in folders
		folders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Folder" }], // Folders that contain certificates
	},
	{ timestamps: true }
);

module.exports = mongoose.model("ELocker", eLockerSchema);
