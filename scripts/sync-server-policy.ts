/**
 * Writes `crates/site-server/policy.json` from its TypeScript sources (server/server-policy.ts).
 */
import { renderServerPolicy, SERVER_POLICY_PATH } from "../server/server-policy";

await Bun.write(SERVER_POLICY_PATH, renderServerPolicy());
console.log(`Wrote ${SERVER_POLICY_PATH}.`);
