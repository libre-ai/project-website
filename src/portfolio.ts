/**
 * The portfolio of `libre-ai/project-governance` (AGENTS.md, Boundaries): the authority on project
 * names, groups and states. Validated at a fixed count; any other shape refuses the build. Change
 * the count only together with the authority.
 */

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
    "learning-session-facilitation",
    "personal-knowledge-workspace",
    "travel-itinerary-planner",
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
    input.items.length !== 17
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
