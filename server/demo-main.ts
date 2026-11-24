/**
 * Command-line entry of the local demo, kept apart from server/demo.ts so the logic stays
 * importable and tested without starting a server. The end-to-end suite launches it as its web
 * server (playwright.config.ts). The binary is built first (`bun run demo`, `bun run test:e2e`).
 * Usage: `bun server/demo-main.ts [--port 8080] [--site dist] [--outbox .demo/outbox]`.
 */
import { parseDemoArguments, startDemo } from "./demo";

const demo = await startDemo(parseDemoArguments(Bun.argv.slice(2)));
console.log(`Démo locale : ${demo.url} (messages dans la boîte d'envoi)`);
// The binary stops with its parent's signal: forward it, then let the database close.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void demo.stop().then(() => process.exit(0));
  });
}
