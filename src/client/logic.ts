/**
 * Pure logic of the client module (ADR 0005), kept apart from the DOM code so it is unit-tested.
 */

export type Theme = "clair" | "sombre";

export const THEME_STORAGE_KEY = "libre-ia-theme";

/** A saved choice wins only if it is one of the two themes; otherwise the system decides. */
export function resolveTheme(saved: string | null, prefersDark: boolean): Theme {
  if (saved === "clair" || saved === "sombre") return saved;
  return prefersDark ? "sombre" : "clair";
}

/** Keyboard navigation of a horizontal tab list (WAI-ARIA tabs pattern), wrapping at the ends. */
export function nextTabIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

export function clampStep(index: number, count: number): number {
  return Math.min(Math.max(index, 0), count - 1);
}
