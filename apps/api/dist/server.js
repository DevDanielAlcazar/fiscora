import { buildApp } from "./app.js";
import { env } from "./config/env.js";
const start = async () => {
    try {
        const app = await buildApp();
        const port = env.API_PORT;
        const host = "0.0.0.0"; // Bind to all interfaces to support containerized/proxied setups
        await app.listen({ port, host });
        console.log(`🚀 Fiscora API Server running at http://localhost:${port}`);
    }
    catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=server.js.map