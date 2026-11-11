/**
 * « Chacun seul / Ensemble », the first screen (ADR 0005 §5). Without script, two radio buttons
 * drive the scene through `:has()`. With script, the container takes `data-etat`, which the CSS
 * follows instead, so the change can run inside a view transition: the silos turn into Libre
 * cards. Without the View Transitions API, or under reduced motion, the state changes at once.
 */

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

export function setupSoloTogether(root: Document): void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const container of root.querySelectorAll<HTMLElement>("[data-seul-ensemble]")) {
    const radios = [...container.querySelectorAll<HTMLInputElement>('input[name="avancer"]')];
    const apply = (value: string): void => {
      container.dataset.etat = value;
    };
    apply(radios.find((radio) => radio.checked)?.value ?? "seul");
    container.dataset.js = "";
    for (const radio of radios) {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        const transition = (root as ViewTransitionDocument).startViewTransition;
        if (transition === undefined || reduced) apply(radio.value);
        else transition.call(root, () => apply(radio.value));
      });
    }
  }
}
