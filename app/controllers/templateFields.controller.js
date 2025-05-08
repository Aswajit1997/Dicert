const TemplateFields = require("../models/templateFields.model");
const imageUpload = require("../middlewares/storageUtil");

const templateFieldsController = {};

// Add Field
templateFieldsController.addField = async (req, res) => {
	try {
		const { fieldName, htmlPlaceholder, placeholder, inputFrom, fieldType } = req.body;

		// If fieldType is 'file', ensure file is uploaded
		if (fieldType === "file" && !req.file) {
			return res.status(400).json({ success: false, message: "File is required for file type field" });
		}

		let fileUrl;
		if (req.file) {
			const bufferData = req.file.buffer;
			const fileName = req.file.originalname;
			fileUrl = await imageUpload(bufferData, fileName, "Admin/Template/TemplateFields");
		}

		const newField = await TemplateFields.create({
			fieldName,
			htmlPlaceholder,
			placeHolder: fieldType === "file" ? fileUrl : placeholder,
			inputFrom,
			fieldType,
		});

		return res.status(200).json({ status: true, message: "Template Field Added Successfully", data: newField });
	} catch (error) {
		res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

// Update Field
templateFieldsController.updateField = async (req, res) => {
	try {
		const { id } = req.params;
		const { fieldName, htmlPlaceholder, placeholder, inputFrom, fieldType } = req.body;
		let updateData = { fieldName, htmlPlaceholder, placeholder, inputFrom, fieldType };

		// If fieldType is file, handle file upload
		let fileUrl = "";
		if (fieldType === "file" && req.file) {
			const bufferData = req.file.buffer;
			const fileName = req.file.originalname;
			fileUrl = await imageUpload(bufferData, fileName, "Admin/Template/TemplateFields");
			updateData.placeholder = fileUrl;
		}

		const updatedField = await TemplateFields.findByIdAndUpdate(id, updateData, { new: true });
		return res.status(200).json({ status: true, message: "Template Field Updated Successfully", data: updatedField });
	} catch (error) {
		res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

// Soft Delete (Set isDeleted to true)
templateFieldsController.softDeleteField = async (req, res) => {
	try {
		const { id } = req.params;
		await TemplateFields.findByIdAndUpdate(id, { isDeleted: true });
		return res.status(200).json({ status: true, message: "Field marked as deleted" });
	} catch (error) {
		res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

// Permanent Delete
templateFieldsController.deleteFieldPermanently = async (req, res) => {
	try {
		const { id } = req.params;
		const field = await TemplateFields.findById(id);

		if (!field || !field.isDeleted) {
			return res.status(400).json({ success: false, message: "Field must be soft deleted before permanent deletion" });
		}

		await TemplateFields.findByIdAndDelete(id);
		return res.status(200).json({ status: true, message: "Field permanently deleted" });
	} catch (error) {
		res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

// Get All Fields
templateFieldsController.getFields = async (req, res) => {
	try {
		const fields = await TemplateFields.find({ isDeleted: false }).select("-createdAt -updatedAt -isDeleted -__v").lean();
		return res.status(200).json({ status: true, data: fields });
	} catch (error) {
		res.status(500).json({ success: false, message: "Server Error", error: error.message });
	}
};

module.exports = templateFieldsController;
