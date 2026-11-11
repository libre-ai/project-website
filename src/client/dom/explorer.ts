/**
 * Layer explorer (ADR 0007 §7). Without script, each layer is a native `<details>` of one
 * exclusive group. With script, opening a layer lights up the layers it is related to
 * (`data-relie`, space-separated ids), through a class the CSS styles.
 */

export function setupExplorer(root: Document): void {
  for (const explorer of root.querySelectorAll<HTMLElement>("[data-couches]")) {
    const layers = [...explorer.querySelectorAll<HTMLDetailsElement>("details[data-couche]")];
    const light = (): void => {
      const open = layers.find((layer) => layer.open);
      const related = new Set((open?.dataset.relie ?? "").split(" ").filter((id) => id !== ""));
      for (const layer of layers) {
        layer.classList.toggle("est-reliee", related.has(layer.dataset.couche ?? ""));
      }
    };
    for (const layer of layers) layer.addEventListener("toggle", light);
    light();
  }
}
