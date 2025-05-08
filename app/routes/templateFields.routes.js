const templateFields = require("../controllers/templateFields.controller.js");
const { verifyAdminToken } = require("../middlewares/authMiddleware.js");
const upload = require("../middlewares/multer.middleware.js");

module.exports = (router) => {
	router.post("/admin/templateFields", verifyAdminToken, upload.single("image"), templateFields.addField);
	router.put("/admin/templateFields", verifyAdminToken, upload.single("image"), templateFields.updateField);
	router.get("/templateFields", templateFields.getFields);
	router.delete("/admin/templateField", verifyAdminToken, templateFields.softDeleteField);
	router.delete("/admin/templateField/permanent", verifyAdminToken, templateFields.deleteFieldPermanently);
};
