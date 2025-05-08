const config = require("./config");
const mongoose = require("mongoose");
mongoose.set("strictQuery", false);

const connectDB = async () => {
	return new Promise((resolve, reject) => {
        if (!config.mongodbUri) {
			console.error("❌ MongoDB connection error: Missing MongoDB URI. Please add it to the .env file.");
			process.exit(1);
		}

		mongoose
			.connect(config.mongodbUri)
			.then(() => {
				console.log("Connected to MongoDB ✅ ");
				resolve(true);
			})
			.catch((err) => {
				console.error("Error connecting to MongoDB ❌ ", err);
				reject(err);
			});
	});
};

module.exports = connectDB;
