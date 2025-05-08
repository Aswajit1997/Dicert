const socketIo = require("socket.io");

module.exports = (io) => {
	io.on("connection", (socket) => {
		console.log("Connected Socket Id => ", socket.id);

        socket.on("joinRoom", async (conversationId) => {
			socket.join(conversationId);

			socket.emit("conversationId", conversationId);
		});

		// Handle disconnection
		socket.on("disconnect", () => {
            console.log("Disconnected !!");
		});
	});
};
