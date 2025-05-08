const mongoose = require("mongoose");

const recycleBinSchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		certificateData: { type: Object, required: true }, // store full certificate object
		originalFolder: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", default: null },
		deletedAt: { type: Date, default: Date.now },
	},
	{ timestamps: true }
);

recycleBinSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days
module.exports = mongoose.model("RecycleBin", recycleBinSchema);
