const eLockerController = require("../controllers/eLocker.controller.js");
const { verifyUserToken } = require("../middlewares/authMiddleware.js");
const upload = require("../middlewares/multer");

module.exports = (router) => {
	// Create Folder
	router.post("/user/create-folder", verifyUserToken, eLockerController.createFolder);

	// Upload Certificate
	router.post(
		"/user/upload-certificate",
		verifyUserToken,
		upload.fields([{ name: "certificate", maxCount: 1 }]),
		eLockerController.uploadCertificate
	);

	// Add Certificate to Folder
	router.post("/user/add-certificate-toFolder", verifyUserToken, eLockerController.addCertificateToFolder);

	// Move Certificate Between Folders
	router.post("/user/move-certificate", verifyUserToken, eLockerController.moveCertificateFolder);

	//get certificates
	router.get("/user/eLocker", verifyUserToken, eLockerController.getELockerData);

	//add certificate to favorite
	router.post("/user/add-to-favorite", verifyUserToken, eLockerController.addToFavorite);

	//remove certificate from favorite
	router.post("/user/remove-from-favorite", verifyUserToken, eLockerController.removeFromFavorite);

	//remove certificate from favorite
	router.post("/user/toggle-favorite", verifyUserToken, eLockerController.toggleFavorite);

	//get certificate from favorite
	router.get("/user/favorite", verifyUserToken, eLockerController.getFavorites);
};
