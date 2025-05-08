const express = require("express");
const app = express();
const config = require("./app/config/config");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const server = require("http").createServer(app);
const router = express.Router();
const connectDB = require("./app/config/connectDB");
const socketIo = require("socket.io");

const io = socketIo(server, {
	cors: {
		origin: "*",
	},
}).of("/socket_connection");
require("./app/utils/socket")(io);

// Connect to MongoDB
connectDB()
	.then(() => {
		// require("./app/util/SchedulingJobs")(io);
		// console.log("MongoDB Connected");
	})
	.catch((error) => {
		console.log("❌ Mongo error ❌ => ", error);
		process.exit(1);
	});

// Swagger
const swaggerAutogen = require("swagger-autogen")({ openapi: "3.0.0" });
const swaggerUi = require("swagger-ui-express");
const doc = {
	info: {
		title: "DiCert API Document",
		description: "Description",
	},
	servers: [
		{
			url: "http://localhost:8555/api",
			description: "Local",
		},
		{
			url: "https://demo.com/api",
			description: "Live",
		},
	],
	tags: [{ name: "DiCert", description: "DiCert-related endpoints" }],
	securityDefinitions: {
		apiKeyAuth: {
			type: "apiKey",
			in: "header", // can be 'header', 'query' or 'cookie'
			name: "X-API-KEY", // name of the header, query parameter or cookie
			description: "Some description...",
		},
	},
};
const outputFile = "./swagger.json";
const swaggerDocument = fs.existsSync(outputFile) ? require(outputFile) : "";

const routesPath = path.join(__dirname, "app/routes");
const routeFiles = fs.readdirSync(routesPath);
const routes = [];

routeFiles.forEach((routeFile) => {
	if (routeFile !== "index.js" && routeFile.endsWith(".js")) {
		routes.push("app/routes/" + routeFile);
		const routeModule = require(path.join(routesPath, routeFile));
		routeModule(router, io);
	}
});

const corsOptions = {
	origin: "*",
	optionsSuccessStatus: 200,
};

app.set("trust proxy", true);
app.use(cors(corsOptions));
app.use(express.json());
app.use(helmet());
app.use(morgan("common"));
app.use("/api", router);
app.use("/api/swagger/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/api/swagger", async (req, res) => {
	await swaggerAutogen(outputFile, routes, doc);
	res.redirect("/api/swagger/docs");
});

app.get("/api/health", async (req, res) => {
	const clientIp = req.ip;
	res.send({ msg: "Backend Server is Running !!", clientIp });
});

app.get("/", async (req, res) => {
	const clientIp = req.ip;
	res.send({ msg: "Backend Server is Running !!", clientIp });
});

server.listen(config.port, () => {
	console.log(`✅ Server is running on port ${config.port}`);
});
