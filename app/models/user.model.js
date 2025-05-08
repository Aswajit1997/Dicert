const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
// Common password handling logic
const SALT_ROUNDS = 10;

const userSchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		email: { type: String, required: true, unique: true },
		password: { type: String, required: true },
		countryCode: { type: String },
		phoneNumber: { type: String},
		profileImage: { type: String, default: "https://picsum.photos/100/100" },
	},
	{ timestamps: true }
);

// Encrypt password before saving
userSchema.pre("save", async function (next) {
	if (!this.isModified("password")) return next();
	this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
	next();
});

// Compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
	return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
