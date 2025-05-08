module.exports = async () => {
	try {
        schedule.scheduleJob("*/1 * * * *", async () => {
			console.log("-----------------schedulerJob Min------------------");
			schedulerArray = await fetchScheduler();
		});
    } catch (error) {
		console.log("Scheduler=> ", error);
	}
};
