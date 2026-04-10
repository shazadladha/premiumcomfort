import { getConfig } from "./config/index.js";
import { startScheduler } from "./scheduler/scheduler.js";

const config = getConfig();

console.log("Premium Comfort — TikTok Scheduler Daemon");
console.log("==========================================\n");

startScheduler(config);
console.log("\nPress Ctrl+C to stop.\n");
