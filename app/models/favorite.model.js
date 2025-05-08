const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		certificate: { type: mongoose.Schema.Types.ObjectId, ref: "Certificate", required: true },
		addedAt: { type: Date, default: Date.now },
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Favorite", favoriteSchema);
