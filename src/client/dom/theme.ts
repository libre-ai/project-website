/** The iconic sun/moon toggle (ADR 0005 §5): revealed by the script, its state in `aria-pressed`. */
import { THEME_STORAGE_KEY, type Theme } from "../logic";

export function setupThemeToggle(root: Document): void {
  const html = root.documentElement;
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]")) {
    const show = (theme: Theme): void => {
      button.setAttribute("aria-pressed", theme === "sombre" ? "true" : "false");
    };
    show(html.dataset.theme === "sombre" ? "sombre" : "clair");
    button.hidden = false;
    button.addEventListener("click", () => {
      const next: Theme = html.dataset.theme === "sombre" ? "clair" : "sombre";
      html.dataset.theme = next;
      show(next);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Without storage the choice lasts for this page only.
      }
    });
  }
}
