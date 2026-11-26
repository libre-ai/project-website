export function setupPaperMotion(root: Document): void {
  const paper = [...root.querySelectorAll<HTMLElement>("[data-papier]")];
  if (paper.length === 0) return;

  for (const facet of root.querySelectorAll<SVGElement>("[data-charniere]")) {
    const [originX, originY, axis] = (facet.dataset.charniere ?? "").split(" ");
    if (originX === undefined || originY === undefined || axis === undefined) continue;
    facet.style.setProperty("--pli-origine", `${originX} ${originY}`);
    facet.style.setProperty("--pli-axe", axis);
  }
  if (typeof IntersectionObserver !== "undefined") {
    const entering = new IntersectionObserver((entries) => {
      for (const { isIntersecting, target } of entries) {
        if (!isIntersecting || !(target instanceof HTMLElement) || target.closest("[hidden]"))
          continue;
        target.dataset.papierActif = "";
        entering.unobserve(target);
      }
    });
    const switching = new MutationObserver((changes) => {
      for (const { target } of changes) {
        if (!(target instanceof HTMLElement)) continue;
        for (const part of target.querySelectorAll<HTMLElement>("[data-papier]")) {
          if (target.hidden) {
            delete part.dataset.papierActif;
            entering.unobserve(part);
          } else {
            entering.observe(part);
          }
        }
      }
    });
    for (const part of paper) if (!part.closest("[hidden]")) entering.observe(part);
    for (const sheet of root.querySelectorAll(".ordre-feuille"))
      switching.observe(sheet, { attributeFilter: ["hidden"] });
  }

  const delivery = root.querySelector<HTMLElement>(".livraison-plan");
  const icon = delivery?.querySelector<HTMLElement>(".livraison-tuile");
  const button = delivery?.querySelector<HTMLButtonElement>("[data-ranger]");
  if (delivery === null || icon == null || button == null) return;
  const pieces = [...delivery.querySelectorAll<HTMLElement>(".livraison-piece")];
  const motion = matchMedia("(prefers-reduced-motion: no-preference)");
  const sync = (): void => {
    button.hidden = !motion.matches;
  };
  sync();
  motion.addEventListener("change", sync);
  button.addEventListener("click", async () => {
    if (!motion.matches || delivery.hasAttribute("data-rangement")) return;
    const origin = icon.getBoundingClientRect();
    const boxes = pieces.map((piece) => piece.getBoundingClientRect());
    pieces.forEach((piece, index) => {
      const box = boxes[index];
      if (box === undefined) return;
      piece.style.setProperty(
        "--rangement-x",
        `${origin.left + origin.width / 2 - box.left - box.width / 2}px`,
      );
      piece.style.setProperty(
        "--rangement-y",
        `${origin.top + origin.height / 2 - box.top - box.height / 2}px`,
      );
    });
    delivery.dataset.rangement = "";
    const animations = pieces.flatMap((piece) => piece.getAnimations());
    await Promise.allSettled(animations.map((animation) => animation.finished));
    delete delivery.dataset.rangement;
  });
}
