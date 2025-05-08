const user = require("../controllers/user.controller.js");
const upload = require("../middlewares/multer.middleware.js");

module.exports = (router) => {
	router.post("/user/sendOtp", user.sendOtp);
	router.post("/user/register", user.signUp);
	router.post("/user/login", user.login);
	router.post("/user/verify-otp-login", user.verifyLoginOtp);
};
