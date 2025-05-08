const puppeteer = require("puppeteer"); // NOT puppeteer-core
const crypto = require("crypto");
const imageUpload = require("../middlewares/storageUtil");

async function convertHTMLToFile(html, filePath, format) {
	console.log("Chromium launch processed!");
	const browser = await puppeteer.launch({
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox"], // required in some environments (e.g. Docker, some CI/CD)
	});
	const page = await browser.newPage();
	await page.setContent(html);

	const uniqueId = crypto.randomBytes(16).toString("hex");
	const fileName = `${uniqueId}.${format}`;
	const uploadPath = filePath || "uploads/temp";

	let buffer;

	if (format === "pdf") {
		buffer = await page.pdf({ format: "A4" });
	} else {
		buffer = await page.screenshot({ type: format, fullPage: true });
	}

	await browser.close();

	const fileSizeInBytes = buffer.length;

	const fileUrl = await imageUpload(buffer, fileName, uploadPath);

	return {
		url: fileUrl,
		size: fileSizeInBytes,
	};
}

module.exports = convertHTMLToFile;

// const puppeteer = require("puppeteer");
// const crypto = require("crypto");
// const imageUpload = require("../middlewares/storageUtil");
// async function convertHTMLToFile(html, filePath, format) {
// 	const browser = await puppeteer.launch({ headless: true });
// 	const page = await browser.newPage();
// 	await page.setContent(html);

// 	const uniqueId = crypto.randomBytes(16).toString("hex");
// 	const fileName = `${uniqueId}.${format}`;
// 	const uploadPath = filePath || "uploads/temp";

// 	let buffer;

// 	if (format === "pdf") {
// 		buffer = await page.pdf({ format: "A4" });
// 	} else {
// 		buffer = await page.screenshot({ type: format, fullPage: true });
// 	}

// 	await browser.close();

// 	const fileSizeInBytes = buffer.length;
// 	// const fileSizeInKB = (fileSizeInBytes / 1024).toFixed(2); // optional, for KB

// 	// Upload the file
// 	const fileUrl = await imageUpload(buffer, fileName, uploadPath);

// 	return {
// 		url: fileUrl,
// 		size: fileSizeInBytes, // or fileSizeInKB if you prefer
// 	};
// }

// module.exports = convertHTMLToFile;
