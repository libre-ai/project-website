/**
 * Universe tabs (ADR 0005 §5, WAI-ARIA tabs pattern). Without script the container holds a list
 * of in-page links and one titled section per universe; the script turns the links into tabs,
 * shows one panel at a time and moves a sliding indicator through a CSS custom property
 * (`--indicateur-x`, `--indicateur-largeur`), which the CSSOM sets without any inline style.
 */
import { nextTabIndex } from "../logic";

export function setupTabs(root: Document): void {
  for (const container of root.querySelectorAll<HTMLElement>("[data-onglets]")) {
    const list = container.querySelector<HTMLElement>("[data-onglets-liste]");
    if (list === null) continue;
    const links = [...list.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
    const panels = links.map((link) => root.getElementById(link.hash.slice(1)));
    if (links.length === 0 || panels.some((panel) => panel === null)) continue;

    list.setAttribute("role", "tablist");
    // The list items no longer belong to a list once it is a tablist: they become neutral, so
    // each tab is a direct child of the tablist in the accessibility tree (axe, ARIA tabs).
    for (const item of list.children) item.setAttribute("role", "none");
    container.dataset.ongletsActifs = "";
    const select = (index: number, focus: boolean): void => {
      links.forEach((link, i) => {
        const selected = i === index;
        link.setAttribute("aria-selected", selected ? "true" : "false");
        link.tabIndex = selected ? 0 : -1;
        const panel = panels[i];
        if (panel) panel.hidden = !selected;
        if (selected) {
          list.style.setProperty("--indicateur-x", `${link.offsetLeft}px`);
          list.style.setProperty("--indicateur-largeur", `${link.offsetWidth}px`);
          if (focus) link.focus();
        }
      });
    };

    links.forEach((link, i) => {
      const panel = panels[i];
      if (!panel) return;
      link.id ||= `onglet-${panel.id}`;
      link.setAttribute("role", "tab");
      link.setAttribute("aria-controls", panel.id);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", link.id);
      panel.tabIndex = 0;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        select(i, false);
      });
      link.addEventListener("keydown", (event) => {
        const next = nextTabIndex(i, event.key, links.length);
        if (next === null) return;
        event.preventDefault();
        select(next, true);
      });
    });
    const initial = Math.max(
      0,
      links.findIndex((link) => link.hash === root.location.hash),
    );
    select(initial, false);
  }
}
