/**
 * Guided tour, « suivre une demande » (ADR 0007 §7). Without script it is an ordered list of all
 * steps. With script it shows one step at a time with previous and next buttons, and announces the
 * position politely to screen readers.
 */
import { clampStep } from "../logic";

export function setupTour(root: Document): void {
  for (const tour of root.querySelectorAll<HTMLElement>("[data-visite]")) {
    const steps = [...tour.querySelectorAll<HTMLElement>("[data-etape]")];
    if (steps.length === 0) continue;
    const controls = root.createElement("div");
    controls.className = "visite-commandes";
    const previous = root.createElement("button");
    previous.type = "button";
    previous.textContent = "Étape précédente";
    const status = root.createElement("p");
    status.className = "visite-position";
    status.setAttribute("aria-live", "polite");
    const next = root.createElement("button");
    next.type = "button";
    next.textContent = "Étape suivante";
    controls.append(previous, status, next);
    tour.append(controls);
    tour.dataset.visiteActive = "";

    let current = 0;
    const show = (index: number): void => {
      current = clampStep(index, steps.length);
      steps.forEach((step, i) => {
        step.hidden = i !== current;
      });
      previous.disabled = current === 0;
      next.disabled = current === steps.length - 1;
      status.textContent = `Étape ${current + 1} sur ${steps.length}`;
    };
    previous.addEventListener("click", () => show(current - 1));
    next.addEventListener("click", () => show(current + 1));
    show(0);
  }
}
