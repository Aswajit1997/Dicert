const templateController = require("../controllers/template.controller.js");
const { verifyAdminToken, verifyIssuerOrAdmin } = require("../middlewares/authMiddleware.js");

module.exports = (router) => {
	// Add Certificate to recycle bin
	router.post("/admin/template", verifyAdminToken, templateController.createTemplate);
	router.put("/admin/template", verifyAdminToken, templateController.editTemplate);

	//delete tem[late]
	router.delete("/admin/template/:id", verifyAdminToken, templateController.deleteTemplate);

	// get all templates
	router.get("/templates", verifyIssuerOrAdmin, templateController.getAllTemplates);

	// get template by id
	router.get("/template/:id", verifyIssuerOrAdmin, templateController.getTemplateById);
};
