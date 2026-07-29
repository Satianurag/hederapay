import cron from "node-cron";
import { config } from "./config.js";
import { runYieldDistribution } from "./handlers/yieldDistribution.js";
import { startEventHandlers } from "./handlers/eventHandlers.js";

async function main() {
  console.log("HederaPay Hedera Automation");
  console.log("  RPC:", config.HEDERA_RPC_URL);
  console.log("  Pool:", config.POOL_ADDRESS);
  console.log("  Yield cron:", config.YIELD_CRON);

  await startEventHandlers();

  cron.schedule(config.YIELD_CRON, async () => {
    try {
      const result = await runYieldDistribution();
      console.log("Yield cycle result:", result);
    } catch (err: any) {
      console.error("Yield cycle failed:", err.message);
    }
  });

  console.log("Automation service running.");
}

main().catch(console.error);
