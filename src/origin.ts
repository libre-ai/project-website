/**
 * The canonical origin of the site (ADR 0006 §1) and the path of a forge brick, shared by the
 * route table, the sitemap and the citations so they can never disagree.
 */

export const SITE_ORIGIN = "https://libre-ia.fr";

export const brickPath = (project: string): string => `/fabrique/briques/${project}/`;

/** The public forge: each repository's state is read there, never on the site (ADR 0007 §3). */
export const FORGE_URL = "https://github.com/libre-ai";
