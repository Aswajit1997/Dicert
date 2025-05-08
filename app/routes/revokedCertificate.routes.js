const revokedCertificateController = require("../controllers/revokeCertificate.controller.js");
const { verifyAdminToken } = require("../middlewares/authMiddleware.js");

module.exports = (router) => {
	// Get Revoked Certificate
	router.get("/admin/revoked-certificates", verifyAdminToken, revokedCertificateController.getRevokedCertificate);
};
