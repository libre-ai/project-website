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

  setupDeliveryExamples(root);
}

async function movePieces(figure: HTMLElement, direction: "entrer" | "sortir"): Promise<void> {
  const icon = figure.querySelector<HTMLElement>(".livraison-tuile");
  if (icon === null || typeof icon.getAnimations !== "function") return;
  const pieces = [...figure.querySelectorAll<HTMLElement>(".livraison-piece")];
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
  figure.dataset.rangement = direction;
  const animations = pieces.flatMap((piece) => piece.getAnimations());
  await Promise.allSettled(animations.map((animation) => animation.finished));
  delete figure.dataset.rangement;
}

function setupDeliveryExamples(root: Document): void {
  const button = root.querySelector<HTMLButtonElement>("[data-changer-exemple]");
  const status = root.querySelector<HTMLElement>("[data-exemple-actif]");
  const figures = [...root.querySelectorAll<HTMLElement>("[data-livraison-exemple]")];
  if (button === null || status === null || figures.length < 2) return;
  const motion = matchMedia("(prefers-reduced-motion: no-preference)");
  let currentIndex = 0;
  let switching = false;
  const nextIndex = (): number => (currentIndex + 1) % figures.length;
  for (const figure of figures.slice(1)) figure.hidden = true;
  button.textContent = figures[nextIndex()]?.dataset.livraisonLibelle ?? "";
  button.hidden = false;
  button.addEventListener("click", async () => {
    if (switching) return;
    const current = figures[currentIndex];
    const destination = nextIndex();
    const next = figures[destination];
    if (current === undefined || next === undefined) return;
    switching = true;
    try {
      if (motion.matches) await movePieces(current, "entrer");
      current.hidden = true;
      next.hidden = false;
      currentIndex = destination;
      if (motion.matches) await movePieces(next, "sortir");
      status.textContent = `Exemple affiché : ${next.dataset.livraisonExemple}`;
      button.textContent = figures[nextIndex()]?.dataset.livraisonLibelle ?? "";
    } finally {
      switching = false;
    }
  });
}
