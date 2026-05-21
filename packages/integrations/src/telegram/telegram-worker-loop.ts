import { runTelegramWorkerLoopFromEnv } from "./telegram-worker";

runTelegramWorkerLoopFromEnv()
  .then((result) => {
    console.log(`Telegram worker loop stopped after ${result.iterations} iterations, processed ${result.processed}, ignored ${result.ignored}`);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
