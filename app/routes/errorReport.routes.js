const errorReport = require("../controllers/errorReport.controller.js");
const { verifyAdminToken, verifyUserToken, verifyIssuerToken } = require("../middlewares/authMiddleware.js");
const upload = require("../middlewares/multer.middleware.js");

module.exports = (router) => {
	router.post("/errorReport", verifyUserToken, upload.single("attachment"), errorReport.makeReport);
	router.get("/errorReport", verifyUserToken, errorReport.getErrorReport);
	router.get("/issuer/errorReport", verifyIssuerToken, errorReport.getErrorReportIssuer);
	router.get("/admin/errorReport", verifyAdminToken, errorReport.getErrorReportAdminSide);
	router.put("/errorReport/revoke", verifyIssuerToken, errorReport.revokeReport);
	router.put("/errorReport/confirm_valid", verifyIssuerToken, errorReport.confirmValid);
	router.put("/errorReport/resolve", verifyIssuerToken, errorReport.resolveErrorReport);
};
