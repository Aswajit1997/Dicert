const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
// Common password handling logic
const SALT_ROUNDS = 10;
const adminSchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		email: { type: String, required: true, unique: true },
		password: { type: String, required: true },
		countryCode: { type: String },
		phoneNumber: { type: String, required: true },
		profileImage: { type: String, default: "https://picsum.photos/200/300" },
	},
	{ timestamps: true }
);

adminSchema.pre("save", async function (next) {
	if (!this.isModified("password")) return next();
	this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
	next();
});

adminSchema.methods.comparePassword = async function (candidatePassword) {
	return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("Admin", adminSchema);
