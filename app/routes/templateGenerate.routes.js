const templateGenerateController = require("../controllers/templateGenerate.controller.js");
const { verifyIssuerToken, verifyIssuerTokenActiveCheck } = require("../middlewares/authMiddleware.js");
const upload = require("../middlewares/multer");

module.exports = (router) => {
	// Add Certificate to recycle bin
	// router.post("/issuer/generate-template", verifyIssuerToken, templateGenerateController.generateCertificate);
	router.get("/issuer/download-csv/:templateId", verifyIssuerTokenActiveCheck, templateGenerateController.downloadCSVTemplate);

	router.post(
		"/verify-certificate",
		verifyIssuerToken,
		upload.fields([{ name: "qrImage", maxCount: 1 }]),
		templateGenerateController.verifyCertificate
	);
	router.get("/issued-certificates", verifyIssuerToken, templateGenerateController.issuedCertificates);
	router.post("/issuer/revoke-certificate", verifyIssuerToken, templateGenerateController.revokeCertificate);
	router.post("/issuer/revoke-certificate-inBulk", verifyIssuerToken, templateGenerateController.revokeCertificatesBulk);
	router.post(
		"/issuer/generate-certificate",
		verifyIssuerToken,
		upload.fields([{ name: "csv", maxCount: 1 }]),
		templateGenerateController.generateCertificatesFromCSV
	);
	router.post("/getImageUrl", upload.single("image"), templateGenerateController.getImageUrl);

	//decode qrCode
	router.post("/decode-qr", upload.fields([{ name: "qrImage", maxCount: 1 }]), templateGenerateController.decodeQrCode);
};
