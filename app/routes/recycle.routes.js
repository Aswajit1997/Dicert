const recycleController = require("../controllers/recycle.controller.js");
const { verifyUserToken } = require("../middlewares/authMiddleware.js");

module.exports = (router) => {
	// Add Certificate to recycle bin
	router.post("/user/recycle-certificate", verifyUserToken, recycleController.addToRecycleBin);

	// Recover Certificate from recycle bin
	router.post("/user/recover-certificate", verifyUserToken, recycleController.recoverCertificate);

	// get Certificate from recycle bin
	router.get("/user/recycle-bin", verifyUserToken, recycleController.getRecycleCertificates);
};
