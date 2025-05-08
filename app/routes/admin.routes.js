const admin = require("../controllers/admin.controller.js");
const { verifyUserToken, verifyAdminToken } = require("../middlewares/authMiddleware.js");

module.exports = (router) => {
	router.post("/admin/sendOtp", admin.sendOtp);
	router.post("/admin/register", admin.signUp);
	router.post("/admin/login", admin.login);
	router.post("/admin/verify-otp-login", admin.verifyLoginOtp);
	router.get("/admin/fetch-generated-certificates", verifyAdminToken, admin.generatedCertificates);
	router.get("/admin/fetch-issuers", verifyAdminToken, admin.fetchIssuers);

	//active , de-active issuer
	router.put("/issuer/active-deActive/:issuerId", verifyAdminToken, admin.activeDeActiveIssuer);
	router.get("/admin/getReport", verifyAdminToken, admin.getAnalytics);
	router.get("/admin/getMonthlyData", verifyAdminToken, admin.getMonthlyData);
};
