const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Common password handling logic
const SALT_ROUNDS = 10;
const issuerSchema = new mongoose.Schema(
	{
		organizationName: { type: String, required: true },
		organizationAddress: { type: String, required: true },
		email: { type: String, required: true, unique: true },
		cacNumber: { type: String, required: true },
		password: { type: String, required: true },
		countryCode: { type: String },
		phoneNumber: { type: String, required: true },
		image: { type: String, default: "https://picsum.photos/200/300" },
		active: { type: Boolean, default: true },
	},
	{ timestamps: true }
);

issuerSchema.pre("save", async function (next) {
	if (!this.isModified("password")) return next();
	this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
	next();
});

issuerSchema.methods.comparePassword = async function (candidatePassword) {
	return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("Issuer", issuerSchema);
