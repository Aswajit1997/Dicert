const imageUpload = require("../middlewares/storageUtil");
const Template = require("../models/template.model");
const QRCode = require("qrcode");
const convertHTMLToFile = require("../utils/ConvertHtmlToFile");
const templateController = {};

// Create a new template
templateController.createTemplate = async (req, res) => {
	try {
		const { templateHTML, customFields, csvFields, format } = req.body;

		if (!templateHTML) {
			return res.status(400).json({ success: false, message: "Please provide template HTML" });
		}

		const createdBy = req.authId;

		// Generate templatePreview by replacing placeholders
		let templatePreview = templateHTML;

		const allFields = [...customFields, ...csvFields];
		// console.log(allFields);
		// console.log(customFields);
		// console.log(csvFields);

		// Replace other placeholders
		allFields.forEach(({ fieldName, fieldType, placeHolder }) => {
			if (fieldType === "file" && fieldName !== "backgroundFrame") {
				// const imgPlaceholderRegex = new RegExp(`<img\\s+[^>]*src=["']\\s*{{\\s*${fieldName}\\s*}}\\s*["']`, "g");
				// templatePreview = templatePreview.replace(imgPlaceholderRegex, `<img src="${placeHolder}"`);
				const imgPlaceholderRegex = new RegExp(`<img\\s+[^>]*src=\\s*{{\\s*${fieldName}\\s*}}`, "g");
				templatePreview = templatePreview.replace(imgPlaceholderRegex, `<img src="${placeHolder}"`);
			} else if (fieldType === "file" && fieldName === "backgroundFrame") {
				templatePreview = templatePreview.replace(
					/url\(["']\s*{{\s*backgroundFrame\s*}}\s*["']\)/g,
					`url("${placeHolder}")`
				);
			} else {
				// Handle {{ fieldName }} text placeholders
				const placeholderRegex = new RegExp(`{{\\s*${fieldName}\\s*}}`, "g");
				templatePreview = templatePreview.replace(placeholderRegex, placeHolder);
			}
		});

		//  {{ uniqueId }} placeholder
		templatePreview = templatePreview.replace(/{{\s*uniqueId\s*}}/g, "uniqueID");

		const { url: fileUrl, size: fileSize } = await convertHTMLToFile(templatePreview, "Admin/templateImages", "png");

		//adding a certificate name(making mandatory) field in customField
		const updatedCustomFields = [
			...customFields,
			{ fieldName: "certificateName", fieldType: "text", placeHolder: "certificateName" },
		];

		const newTemplate = new Template({
			templateHTML,
			templatePreview,
			templateUrl: fileUrl,
			customFields: updatedCustomFields,
			csvFields,
			createdBy,
		});

		await newTemplate.save();

		res.status(201).json({
			success: true,
			message: "Template created successfully",
			template: newTemplate,
		});
	} catch (error) {
		res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

templateController.editTemplate = async (req, res) => {
	try {
		const { templateId, templateHTML, customFields, csvFields } = req.body;

		if (!templateId) {
			return res.status(400).json({ success: false, message: "Template ID is required" });
		}

		if (!templateHTML) {
			return res.status(400).json({ success: false, message: "Please provide template HTML" });
		}

		// Generate updated templatePreview by replacing placeholders
		let templatePreview = templateHTML;
		const allFields = [...customFields, ...csvFields];

		allFields.forEach(({ fieldName, fieldType, placeHolder }) => {
			if (fieldName === "certificateName") {
				// Skip the certificateName field
				return;
			} else if (fieldType === "file" && fieldName !== "backgroundFrame") {
				const imgPlaceholderRegex = new RegExp(`<img\\s+[^>]*src=\\s*{{\\s*${fieldName}\\s*}}`, "g");
				templatePreview = templatePreview.replace(imgPlaceholderRegex, `<img src="${placeHolder}"`);
			} else if (fieldType === "file" && fieldName === "backgroundFrame") {
				templatePreview = templatePreview.replace(
					/url\(["']\s*{{\s*backgroundFrame\s*}}\s*["']\)/g,
					`url("${placeHolder}")`
				);
			} else {
				const placeholderRegex = new RegExp(`{{\\s*${fieldName}\\s*}}`, "g");
				templatePreview = templatePreview.replace(placeholderRegex, placeHolder);
			}
		});

		// Preserve the {{ uniqueId }} placeholder as "uniqueID"
		templatePreview = templatePreview.replace(/{{\s*uniqueId\s*}}/g, "uniqueID");

		const { url: fileUrl, size: fileSize } = await convertHTMLToFile(templatePreview, "Admin/templateImages", "png");

		//adding a certificate name(making mandatory) field in customField
		const updatedCustomFields = [
			...customFields,
			{ fieldName: "certificateName", fieldType: "text", placeHolder: "certificateName" },
		];

		// Find and update the template
		const updatedTemplate = await Template.findByIdAndUpdate(
			templateId,
			{
				templateHTML,
				templatePreview,
				templateUrl: fileUrl,
				customFields: updatedCustomFields,
				csvFields,
			},
			{ new: true }
		);

		if (!updatedTemplate) {
			return res.status(404).json({ success: false, message: "Template not found" });
		}

		res.status(200).json({
			success: true,
			message: "Template updated successfully",
			template: updatedTemplate,
		});
	} catch (error) {
		res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

templateController.getTemplateAnalytic = async (req, res) => {
	try {
		const templateCertificates= await Certificate.find()
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// Get all templates
templateController.getAllTemplates = async (req, res) => {
	try {
		const { search = "" } = req.query;
		const searchRegex = new RegExp(search, "i"); // case-insensitive regex

		const templates = await Template.find({
			templatePreview: { $regex: searchRegex },
		}).populate("createdBy", "name email");

		res.status(200).json({ success: true, templates });
	} catch (error) {
		res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

// Get a single template by ID
templateController.getTemplateById = async (req, res) => {
	try {
		const { id } = req.params;
		const template = await Template.findById(id);

		if (!template) return res.status(404).json({ success: false, message: "Template not found" });

		res.status(200).json({ success: true, template });
	} catch (error) {
		res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

// Delete a template
templateController.deleteTemplate = async (req, res) => {
	try {
		const { id } = req.params;
		const deletedTemplate = await Template.findByIdAndDelete(id);

		if (!deletedTemplate) return res.status(404).json({ success: false, message: "Template not found" });

		res.status(200).json({ success: true, message: "Template deleted successfully" });
	} catch (error) {
		res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

module.exports = templateController;
