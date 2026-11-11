/**
 * An in-memory PostgreSQL for tests and the local demo (ADR 0006 §8): PGlite exposed on the
 * PostgreSQL wire protocol on a free local port, so the code under test talks to it through
 * `Bun.sql` exactly as it would to a real server. Nothing is written to disk.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

export interface TestDatabase {
  readonly url: string;
  stop(): Promise<void>;
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await server.start();
  return {
    url: `postgres://postgres@${server.getServerConn()}/postgres`,
    async stop() {
      await server.stop();
      await db.close();
    },
  };
}
