/**
 * The site's single stylesheet (`/assets/site.css`): self-hosted font faces, the Aube tokens,
 * then the static sheets in cascade order. Only `effects.css` animates, and only without a
 * reduced-motion preference (ADR 0005 §6).
 */
import { readFile } from "node:fs/promises";

import { renderFontFaces } from "../font";
import { renderTokens } from "./tokens";

const SHEETS = ["base.css", "layout.css", "components.css", "demos.css", "effects.css"] as const;

export interface StaticSheet {
  readonly name: (typeof SHEETS)[number];
  readonly text: string;
}

export async function readStaticSheets(): Promise<readonly StaticSheet[]> {
  return Promise.all(
    SHEETS.map(async (name) => ({
      name,
      text: await readFile(new URL(`./css/${name}`, import.meta.url), "utf8"),
    })),
  );
}

export async function renderStylesheet(): Promise<string> {
  const sheets = await readStaticSheets();
  return [renderFontFaces(), renderTokens(), ...sheets.map((sheet) => sheet.text.trim()), ""].join(
    "\n",
  );
}
