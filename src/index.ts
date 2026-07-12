import { startServer } from "./server/index.js";

export { startServer } from "./server/index.js";

export async function main(): Promise<void> {
  const runningServer = await startServer();
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    try {
      await runningServer.close();
      process.exitCode = 0;
    } catch (error) {
      process.exitCode = 1;
      process.stderr.write(
        `Failed to stop MCP server after ${signal}: ${String(error)}\n`,
      );
    }
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`Failed to start MCP server: ${String(error)}\n`);
    process.exitCode = 1;
  }
}
