const issuer = require("../controllers/issuer.controller.js");
const upload = require("../middlewares/multer.middleware.js");

module.exports = (router) => {
	router.post("/issuer/sendOtp", issuer.sendOtp);
	router.post("/issuer/register", issuer.signUp);
	router.post("/issuer/login", issuer.login);
	router.post("/issuer/verify-otp-login", issuer.verifyLoginOtp);
};
