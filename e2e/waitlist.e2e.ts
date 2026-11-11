import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { OUTBOX } from "../playwright.config";

// The whole waitlist journey (ADR 0006): subscribe from the join page, confirm from the link of
// the message written to the demo outbox, then leave the list from the link of the same message.
// One address per project, so the four projects never share a row.

async function findMessageTo(address: string): Promise<string | null> {
  const names = (await readdir(OUTBOX).catch(() => [])).sort().reverse();
  for (const name of names) {
    const raw = await readFile(join(OUTBOX, name), "utf8");
    if (raw.includes(`To: ${address}\r\n`)) return raw;
  }
  return null;
}

// The server answers before the message is written (ADR 0006 §4), so the reader waits for it.
async function latestMessageTo(address: string): Promise<string> {
  await expect.poll(() => findMessageTo(address)).not.toBeNull();
  const raw = await findMessageTo(address);
  if (raw === null) throw new Error(`no message to ${address}`);
  return raw;
}

const link = (raw: string, path: string): string => {
  const match = new RegExp(`http://localhost:8080${path}\\?jeton=[A-Za-z0-9_-]+`).exec(raw);
  if (match === null) throw new Error(`no ${path} link`);
  return match[0];
};

test("subscribe, confirm from the message, then unsubscribe", async ({ page }, testInfo) => {
  const address = `e2e.${testInfo.project.name}@example.org`;
  await page.goto("/rejoindre/");
  await page.getByLabel("Votre adresse e-mail").fill(address);
  await page.getByRole("button", { name: "Rejoindre la liste" }).click();
  await expect(page).toHaveURL(/\/inscription\/merci\/$/);

  const message = await latestMessageTo(address);
  expect(message).toContain("List-Unsubscribe-Post: List-Unsubscribe=One-Click");

  await page.goto(link(message, "/confirmer"));
  await expect(page).toHaveURL(/\/inscription\/confirmee\/$/);
  await page.goto(link(message, "/confirmer"));
  await expect(page).toHaveURL(/\/inscription\/lien-invalide\/$/);

  await page.goto(link(message, "/desinscrire"));
  await page.getByRole("button", { name: "Me désinscrire" }).click();
  await expect(page).toHaveURL(/\/inscription\/desinscrit\/$/);
});
