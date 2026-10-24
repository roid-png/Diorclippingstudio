import "./load-env";
import { createApp } from "./app";
import { env } from "./config/env";
import { checkDatabase, pool } from "./db";
import { logger } from "./lib/logger";

const app = createApp();

const server = app.listen(env.PORT, env.HOST, async (error) => {
  if (error) {
    logger.fatal(
      { err: error },
      (error as NodeJS.ErrnoException).code === "EADDRINUSE"
        ? `Port ${env.PORT} is already in use. Stop the other process or set PORT.`
        : "The API could not start.",
    );
    process.exit(1);
  }
  let database = "reachable";
  try {
    await checkDatabase();
  } catch {
    database = "unreachable (run pnpm db:up, then pnpm run doctor)";
  }
  logger.info(
    { port: env.PORT, webOrigin: env.WEB_URL, database },
    `API listening on ${env.BETTER_AUTH_URL}`,
  );
  try {
    const { startAutoCleanupScheduler } = await import("./services/cleanup.service");
    startAutoCleanupScheduler();
  } catch {}
});

// Configure 30-minute server timeouts for long-running 50+ min video uploads and rendering
server.setTimeout(1800000);
server.keepAliveTimeout = 1800000;
server.headersTimeout = 1805000;
server.requestTimeout = 1800000;

// Graceful shutdown. `pnpm dev` (tsx watch) restarts on every file change;
// closing the server and the pool here frees the port and the PostgreSQL
// connections immediately, so reloads never hit EADDRINUSE or leak sessions.
let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "Shutting down");
  const force = setTimeout(() => {
    logger.warn("Forcing exit after 5s");
    process.exit(1);
  }, 5000);
  force.unref();
  server.closeIdleConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end().catch(() => {});
  logger.flush();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  if (env.isProduction) {
    logger.fatal({ err: reason }, "Unhandled promise rejection");
    logger.flush();
    process.exit(1);
  } else {
    logger.error({ err: reason }, "Unhandled promise rejection (kept alive in dev mode)");
  }
});
process.on("uncaughtException", (err) => {
  if (env.isProduction) {
    logger.fatal({ err }, "Uncaught exception");
    logger.flush();
    process.exit(1);
  } else {
    logger.error({ err }, "Uncaught exception (kept alive in dev mode)");
  }
});
