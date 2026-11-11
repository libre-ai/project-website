import { describe, expect, test } from "bun:test";

import { signalerBody } from "./pages/signaler";
import { h } from "./web/html";
import { layout } from "./web/layout";
import { libreRoutes } from "./web/routes";

const body = signalerBody();
const forge = {
  bricks: [],
  proofs: "<h1>Preuves</h1>",
  licences: "<h1>Licences</h1>",
  deploy: "<h1>Déployer</h1>",
  signal: body,
  corrections: "<h1>Journal des corrections</h1>",
};

describe("/signaler (S3.5, FR-15)", () => {
  test("is a forge route of the site", () => {
    expect(
      libreRoutes(forge).some((entry) => entry.path === "/signaler/" && entry.kind === "forge"),
    ).toBe(true);
  });

  test("points to the public forge issues of this site, as an external link", () => {
    expect(body).toContain(
      '<a href="https://github.com/libre-ai/project-website/issues" rel="noopener noreferrer">',
    );
  });

  test("collects nothing: no form, no field, no script in its body", () => {
    for (const tag of ["<form", "<input", "<textarea", "<select", "<button", "<script"]) {
      expect(body).not.toContain(tag);
    }
  });

  test("names the correction journal as where a handled report is recorded", () => {
    expect(body).toContain('<a href="/corrections">');
  });

  test("is reachable from every page by the footer, next to the corrections journal (FR-05)", () => {
    const page = layout({ title: "x", description: "x", path: "/", main: h("h1", {}, "x") });
    const footer = page.slice(page.indexOf('<footer class="site-pied">'));
    expect(footer).toContain('<a href="/signaler/">Signaler une erreur</a>');
    expect(footer).toContain('<a href="/corrections/">Corrections</a>');
  });
});
