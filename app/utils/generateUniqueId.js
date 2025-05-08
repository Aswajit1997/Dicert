const { v4: uuidv4 } = require("uuid");

function generateUniqueId() {
	return uuidv4().replace(/-/g, "").slice(0, 16);
}

module.exports = generateUniqueId;
