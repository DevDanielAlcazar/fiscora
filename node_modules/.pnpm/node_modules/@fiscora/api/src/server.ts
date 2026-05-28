import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = buildApp();

const start = async () => {
  try {
    const port = env.API_PORT;
    const host = "0.0.0.0"; // Bind to all interfaces to support containerized/proxied setups

    await app.listen({ port, host });
    console.log(`🚀 Fiscora API Server running at http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
