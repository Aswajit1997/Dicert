// Function to get file extension
function getFileExtension(fileName) {
	if (!fileName) {
		throw new Error("File name is required");
	}

	const extension = fileName.split(".").pop();

	// Check if there's an extension and it's valid
	if (!extension || extension === fileName) {
		throw new Error("Invalid file name");
	}

	return extension;
}

module.exports = getFileExtension;
