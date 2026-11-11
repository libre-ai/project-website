/**
 * The site's one client module (ADR 0005), bundled at build time into /assets/main.js. It only
 * enhances: every page is complete without it. Contract with the pages (plan, Task 7):
 * - `[data-theme-toggle]` — the sun/moon button;
 * - `[data-onglets]` holding `[data-onglets-liste]` links to the universe sections;
 * - `[data-seul-ensemble]` holding the radios `name="avancer"` (`seul`, `ensemble`);
 * - `[data-visite]` holding the steps `[data-etape]`;
 * - `[data-couches]` holding `details[data-couche][data-relie]`.
 * A module script runs after parsing, so the DOM is ready here.
 */
import { setupExplorer } from "./explorer";
import { setupSoloTogether } from "./solo-together";
import { setupTabs } from "./tabs";
import { setupThemeToggle } from "./theme";
import { setupTour } from "./tour";

setupThemeToggle(document);
setupTabs(document);
setupSoloTogether(document);
setupTour(document);
setupExplorer(document);
