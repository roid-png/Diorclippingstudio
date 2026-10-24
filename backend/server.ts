import "../apps/api/src/load-env";
import fs from "node:fs";
import path from "node:path";
import { createApp } from "../apps/api/src/app";
import { checkDatabase } from "../apps/api/src/db";
import { logger } from "../apps/api/src/lib/logger";

// Safeguard: Pastikan .env selalu ada dari .env.example
const cwdEnv = path.resolve(process.cwd(), ".env");
const cwdEnvEx = path.resolve(process.cwd(), ".env.example");
if (!fs.existsSync(cwdEnv) && fs.existsSync(cwdEnvEx)) {
  try {
    fs.copyFileSync(cwdEnvEx, cwdEnv);
  } catch {}
}

// Port configuration: Codespaces forwardPorts [3000, 5000]
const PORT = Number(process.env.PORT || 5000);
const HOST = "0.0.0.0";

const app = createApp({ logger });

const server = app.listen(PORT, HOST, async (error) => {
  if (error) {
    logger.fatal(
      { err: error },
      (error as NodeJS.ErrnoException).code === "EADDRINUSE"
        ? `Port ${PORT} is already in use. Stop the other process or set PORT.`
        : "The API could not start.",
    );
    process.exit(1);
  }

  let database = "reachable";
  try {
    await checkDatabase();
  } catch {
    database = "unreachable (local mode / database optional)";
  }

  console.log("\n=======================================================");
  console.log("🎬 DIOR Clipping Studio - Backend API & Media Server");
  console.log(`🚀 Server listening on: http://${HOST}:${PORT}`);
  console.log("🌐 Codespaces Status: Host 0.0.0.0 (Port 5000 Public Forwarded)");
  console.log(`💾 Database status: ${database}`);
  console.log("=======================================================\n");

  try {
    const { startAutoCleanupScheduler } = await import(
      "../apps/api/src/services/cleanup.service"
    );
    startAutoCleanupScheduler();
  } catch {}
});

// Configure 30-minute server timeouts for heavy 50+ min video processing and streaming
server.setTimeout(1800000);
server.keepAliveTimeout = 1800000;
server.headersTimeout = 1805000;
server.requestTimeout = 1800000;

// Graceful shutdown on reload or SIGTERM
let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "Shutting down backend server");
  const force = setTimeout(() => {
    logger.warn("Forcing exit after 5s");
    process.exit(1);
  }, 5000);
  force.unref();

  server.close(async () => {
    try {
      const { pool } = await import("../apps/api/src/db");
      await pool.end();
    } catch {}
    process.exit(0);
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

export default server;

