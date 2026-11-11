/**
 * Runs before the stylesheet (layout.ts) so a saved theme paints on the first frame, without a
 * flash of the other theme. Storage may be unavailable (private window, blocked site data): the
 * system preference then decides, which is also what the page does without any script.
 */
import { resolveTheme, THEME_STORAGE_KEY } from "../logic";

let saved: string | null = null;
try {
  saved = window.localStorage.getItem(THEME_STORAGE_KEY);
} catch {
  saved = null;
}
document.documentElement.dataset.theme = resolveTheme(
  saved,
  window.matchMedia("(prefers-color-scheme: dark)").matches,
);
