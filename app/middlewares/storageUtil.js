const { google } = require("googleapis");
const mime = require("mime-types");
const { Readable } = require("stream");
const FileType = require("file-type");

require("dotenv").config();

// Convert buffer to stream
function bufferToStream(buffer) {
	const stream = new Readable();
	stream.push(buffer);
	stream.push(null);
	return stream;
}

const credentialsJSON = JSON.parse(Buffer.from(process.env.GOOGLE_CLIENT_SECRET_JSON_BASE64, "base64").toString("utf-8"));

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const auth = new google.auth.GoogleAuth({
	credentials: credentialsJSON,
	scopes: SCOPES,
});

const driveService = google.drive({ version: "v3", auth });

const imageUpload = async (fileBuffer, filename, folderName) => {
	try {
		const fileType = await FileType.fromBuffer(fileBuffer);
		const mimeType = fileType?.mime || mime.lookup(filename) || "image/png";

		// Ensure folder exists
		const folderId = await getOrCreateNestedFolder(folderName, process.env.GOOGLE_DRIVE_FOLDER_ID);

		const fileMetadata = {
			name: filename,
			parents: [folderId],
		};

		const media = {
			mimeType,
			body: bufferToStream(fileBuffer),
		};

		// Upload the file
		const file = await driveService.files.create({
			resource: fileMetadata,
			media: media,
			fields: "id", // only need file ID
		});

		// Make file public
		await driveService.permissions.create({
			fileId: file.data.id,
			requestBody: {
				role: "reader",
				type: "anyone",
			},
		});

		// ✅ Construct working public image URL like previous ones
		const publicImageUrl = `https://lh3.googleusercontent.com/d/${file.data.id}`;
		return publicImageUrl;
	} catch (err) {
		console.error("Upload to Google Drive failed:", err);
		throw err;
	}
};

// Utility to get or create a folder
const getOrCreateFolder = async (folderName, parentFolderId) => {
	const parentClause = parentFolderId ? `and '${parentFolderId}' in parents` : "";
	const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false ${parentClause}`;

	const res = await driveService.files.list({
		q: query,
		fields: "files(id, name)",
		spaces: "drive",
	});

	if (res.data.files.length > 0) {
		return res.data.files[0].id;
	}

	const folderMetadata = {
		name: folderName,
		mimeType: "application/vnd.google-apps.folder",
		parents: parentFolderId ? [parentFolderId] : [],
	};

	const folder = await driveService.files.create({
		resource: folderMetadata,
		fields: "id",
	});

	return folder.data.id;
};

// Support nested folder paths like "users/photos/avatars"
const getOrCreateNestedFolder = async (folderPath, rootFolderId) => {
	const folders = folderPath.split("/").filter(Boolean);
	let parentId = rootFolderId;

	for (const folderName of folders) {
		const folderId = await getOrCreateFolder(folderName, parentId);
		parentId = folderId;
	}

	return parentId;
};

module.exports = imageUpload;
