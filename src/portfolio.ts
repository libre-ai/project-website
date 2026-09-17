import { escapeHtml } from "./security";

type Language = "fr" | "en";
type Group = "products" | "components" | "project";
interface LocalizedText {
  readonly fr: string;
  readonly en: string;
}
interface SourceReadme {
  readonly path: string;
  readonly sha256: string;
}
export interface PortfolioItem {
  readonly repository: string;
  readonly repositoryId: string;
  readonly group: Group;
  readonly name: LocalizedText;
  readonly role: LocalizedText;
  readonly status: "code_integration_local";
  readonly sourceReadmes: { readonly fr: SourceReadme; readonly en: SourceReadme };
}
export interface Portfolio {
  readonly schemaVersion: "libre-ai.portfolio.v1";
  readonly sourcePublicationSha256: string;
  readonly items: readonly PortfolioItem[];
}

const repositories: Readonly<Record<Group, readonly string[]>> = {
  products: [
    "ai-work-supervision",
    "ai-model-policy",
    "ai-practice-workbench",
    "learning-session-facilitation",
    "personal-knowledge-notebook",
    "information-feed-filter",
    "travel-itinerary-planner",
    "public-vote-comparison",
  ],
  components: [
    "application-development-toolkit",
    "schemas-and-contracts",
    "collaborative-data-sync",
    "execution-continuity-evaluator",
    "execution-sandbox",
    "capability-authorization",
    "organization-data-lifecycle",
    "database-policy-inspector",
    "artifact-verification",
  ],
  project: [".github", "project-website", "project-governance"],
};
const groups: readonly Group[] = ["products", "components", "project"];

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("portfolio.object_invalid");
  const result = value as Record<string, unknown>;
  if (Object.keys(result).length !== keys.length || keys.some((key) => !Object.hasOwn(result, key)))
    throw new Error("portfolio.keys_invalid");
  return result;
}
function text(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > 2000)
    throw new Error("portfolio.text_invalid");
  return value;
}
function digest(value: unknown): string {
  const result = text(value);
  if (!/^[a-f0-9]{64}$/.test(result)) throw new Error("portfolio.digest_invalid");
  return result;
}
function localized(value: unknown): LocalizedText {
  const result = object(value, ["fr", "en"]);
  return { fr: text(result.fr), en: text(result.en) };
}

export function parsePortfolio(value: unknown): Portfolio {
  const input = object(value, ["schemaVersion", "sourcePublicationSha256", "items"]);
  if (
    input.schemaVersion !== "libre-ai.portfolio.v1" ||
    !Array.isArray(input.items) ||
    input.items.length !== 20
  )
    throw new Error("portfolio.scope_invalid");
  const seen = new Set<string>();
  const identities = new Set<string>();
  const items = input.items.map((value): PortfolioItem => {
    const row = object(value, [
      "repository",
      "repositoryId",
      "group",
      "name",
      "role",
      "status",
      "sourceReadmes",
    ]);
    const repository = text(row.repository);
    const repositoryId = text(row.repositoryId);
    const group = text(row.group);
    if (
      !groups.includes(group as Group) ||
      !repositories[group as Group].includes(repository) ||
      seen.has(repository) ||
      !/^[1-9][0-9]*$/.test(repositoryId) ||
      identities.has(repositoryId)
    )
      throw new Error("portfolio.identity_invalid");
    if (row.status !== "code_integration_local") throw new Error("portfolio.status_invalid");
    const sources = object(row.sourceReadmes, ["fr", "en"]);
    function source(language: Language): SourceReadme {
      const result = object(sources[language], ["path", "sha256"]);
      const expectedPath = `${repository === ".github" ? "profile/" : ""}README${language === "fr" ? ".fr" : ""}.md`;
      if (result.path !== expectedPath) throw new Error("portfolio.source_invalid");
      return { path: expectedPath, sha256: digest(result.sha256) };
    }
    seen.add(repository);
    identities.add(repositoryId);
    return {
      repository,
      repositoryId,
      group: group as Group,
      name: localized(row.name),
      role: localized(row.role),
      status: "code_integration_local",
      sourceReadmes: { fr: source("fr"), en: source("en") },
    };
  });
  return {
    schemaVersion: "libre-ai.portfolio.v1",
    sourcePublicationSha256: digest(input.sourcePublicationSha256),
    items,
  };
}

export function renderPortfolio(portfolio: Portfolio, language: Language): string {
  const fr = language === "fr";
  const labels = fr
    ? ["Produits", "Composants et outils", "Le projet"]
    : ["Products", "Components and tools", "The project"];
  const sections = groups
    .map(
      (group, index) =>
        `<section class="section lai-page" id="${group}"><h2>${labels[index]}</h2><div class="card-grid">${portfolio.items
          .filter((item) => item.group === group)
          .map(
            (item) =>
              `<article class="product-card lai-open-frame"><h3><a href="https://github.com/libre-ai/${item.repository}">${escapeHtml(item.name[language])}</a></h3><p>${escapeHtml(item.role[language])}</p></article>`,
          )
          .join("")}</div></section>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; base-uri 'none'; connect-src 'none'; form-action 'none'; object-src 'none'; script-src 'none'; style-src 'self'; img-src 'self'"><title>Libre AI — ${fr ? "Les projets" : "The projects"}</title><link rel="stylesheet" href="./assets/styles.css"></head>
<body><a class="lai-skip-link" href="#contenu">${fr ? "Aller au contenu" : "Skip to content"}</a><header class="site-header lai-page"><a class="wordmark" href="./index.html">Libre AI</a><nav aria-label="${fr ? "Navigation principale" : "Main navigation"}"><a href="#products">${labels[0]}</a> <a href="#components">${labels[1]}</a> <a href="#project">${labels[2]}</a> <a href="${fr ? "index.en.html" : "index.html"}" lang="${fr ? "en" : "fr"}">${fr ? "English" : "Français"}</a></nav></header><main id="contenu"><section class="hero lai-page"><h1>${fr ? "Travailler et apprendre avec l’IA" : "Work and learn with AI"}</h1><p class="lede">${fr ? "Des projets pour garder la main sur vos sources, vos outils et vos décisions." : "Projects that keep you in control of your sources, tools and decisions."}</p><p class="availability">${fr ? "Le code récupéré est en cours d’intégration et de test local. Ce catalogue ne désigne pas des services déployés ni des paquets publiés. Le projet Voyage dispose de données et de contrôles, mais pas encore d’une application de planification." : "Recovered code is being integrated and tested locally. This catalogue does not list deployed services or published packages. The Travel project has data and checks, but no itinerary application yet."}</p></section>${sections}</main><footer class="site-footer lai-page"><a href="https://github.com/libre-ai/.github/blob/main/CONTRIBUTING.md">${fr ? "Contribuer" : "Contribute"}</a> · <a href="https://github.com/libre-ai/.github/blob/main/SECURITY.md">${fr ? "Signaler une vulnérabilité" : "Report a vulnerability"}</a></footer></body></html>`;
}
