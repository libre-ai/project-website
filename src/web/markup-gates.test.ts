import { beforeAll, describe, expect, spyOn, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { type ProjectCard, parseProjectCard } from "../project-card";
import { ALLOWED_URL_SCHEMES, checkButtonTypes, checkUrlSchemes, urlScheme } from "./markup-gates";
import { buildLibreSite } from "./site";

type UrlSweep = ReturnType<typeof checkUrlSchemes>;
type ButtonSweep = ReturnType<typeof checkButtonTypes>;

describe("urlScheme", () => {
  test("reads the scheme through case, leading blanks and inner tabs or newlines", () => {
    expect(urlScheme(" \tJaVaScRiPt:alert(1)")).toBe("javascript");
    expect(urlScheme("java\nscript:x")).toBe("javascript");
    expect(urlScheme("vbscript:x")).toBe("vbscript");
    expect(urlScheme("HTTPS://x.test")).toBe("https");
  });

  test("returns null for a relative URL, a fragment and an empty string", () => {
    expect(urlScheme("/chemin?q=a:b")).toBeNull();
    expect(urlScheme("#a:b")).toBeNull();
    expect(urlScheme("")).toBeNull();
    expect(urlScheme("chemin/a:b")).toBeNull();
  });
});

describe("checkUrlSchemes", () => {
  test("the allow-list holds https and nothing else", () => {
    expect([...ALLOWED_URL_SCHEMES]).toEqual(["https"]);
  });

  test("refuses a scheme masked by a character reference, with file and line", () => {
    const apostrophe = new Map([["a.html", '<p>\n<a href="java&#39;script:x">x</a></p>']]);
    expect(checkUrlSchemes(apostrophe)).toEqual({
      examined: 1,
      refused: ["url.scheme_encoded:a.html:2"],
    });
    const hexadecimal = new Map([["b/index.html", '<a href="jav&#x61;script:x">x</a>']]);
    expect(checkUrlSchemes(hexadecimal)).toEqual({
      examined: 1,
      refused: ["url.scheme_encoded:b/index.html:1"],
    });
  });

  test("refuses a scheme outside the allow-list, naming file, line and scheme, never the value", () => {
    const page = [
      '<a href="data:text/html,x">a</a>',
      '<script src="http://x.test/a.js"></script>',
      '<form action="vbscript:x"></form>',
    ].join("\n");
    const { examined, refused } = checkUrlSchemes(new Map([["page.html", page]]));
    expect(examined).toBe(3);
    expect(refused).toEqual([
      "url.scheme_refused:page.html:1:data",
      "url.scheme_refused:page.html:2:http",
      "url.scheme_refused:page.html:3:vbscript",
    ]);
  });

  test("refuses an attribute that is not written between double quotes", () => {
    expect(checkUrlSchemes(new Map([["s.html", "<a href='/a'>a</a>"]])).refused).toEqual([
      "url.attribute_unquoted:s.html:1:href",
    ]);
    expect(checkUrlSchemes(new Map([["n.html", "<a href=/a>a</a>"]])).refused).toEqual([
      "url.attribute_unquoted:n.html:1:href",
    ]);
  });

  test("accepts relative URLs, fragments and https, and counts each value", () => {
    const page =
      '<a href="/a?q=b:c">a</a><a href="#contenu">b</a>' +
      '<a href="https://x.test/">c</a><script src="/assets/main.js"></script>';
    expect(checkUrlSchemes(new Map([["index.html", page]]))).toEqual({ examined: 4, refused: [] });
  });

  test("accepts an escaped ampersand once the path or the query has started", () => {
    const page = '<a href="https://x.test/a&amp;b">a</a><a href="/a?q=1&amp;r=2">b</a>';
    expect(checkUrlSchemes(new Map([["index.html", page]]))).toEqual({ examined: 2, refused: [] });
  });

  test("reads only .html entries, as text or as bytes", () => {
    const hostile = '<a href="javascript:x">a</a>';
    const ignored = new Map<string, string | Uint8Array>([
      ["assets/volee.svg", hostile],
      ["assets/site.css", hostile],
    ]);
    expect(checkUrlSchemes(ignored)).toEqual({ examined: 0, refused: [] });
    const bytes = new Map([["index.html", new TextEncoder().encode(hostile)]]);
    expect(checkUrlSchemes(bytes).refused).toEqual(["url.scheme_refused:index.html:1:javascript"]);
  });
});

describe("checkButtonTypes", () => {
  test("a button tag without a type is missing, with file and line", () => {
    const untyped = new Map([["form.html", "<main>\n<form><button>Envoyer</button></form>"]]);
    expect(checkButtonTypes(untyped).missing).toEqual(["button.type_missing:form.html:2"]);
    const typed = new Map([["form.html", '<form><button type="submit">Envoyer</button></form>']]);
    expect(checkButtonTypes(typed)).toEqual({
      files: 1,
      buttons: 1,
      markup: 1,
      createElement: 0,
      missing: [],
    });
  });

  test("a DOM creation needs its type set on the same variable within three lines", () => {
    const bare = [
      "const other = 1;",
      "const b = root.createElement('button');",
      "b.textContent = 'x';",
      "b.className = 'y';",
      "b.hidden = false;",
      "b.type = 'button';",
    ].join("\n");
    expect(checkButtonTypes(new Map([["tour.ts", bare]]))).toEqual({
      files: 1,
      buttons: 1,
      markup: 0,
      createElement: 1,
      missing: ["button.type_missing:tour.ts:2"],
    });

    const property = "const b = root.createElement('button');\nb.type = 'button';";
    expect(checkButtonTypes(new Map([["a.ts", property]])).missing).toEqual([]);
    const attribute =
      'const b = document.createElement("button");\nb.setAttribute("type","button");';
    expect(checkButtonTypes(new Map([["a.ts", attribute]])).missing).toEqual([]);
    const thirdLine = "const b = root.createElement('button');\n\n\nb.type = 'button';";
    expect(checkButtonTypes(new Map([["a.ts", thirdLine]])).missing).toEqual([]);

    const otherVariable = "const b = root.createElement('button');\nc.type = 'button';";
    expect(checkButtonTypes(new Map([["a.ts", otherVariable]])).missing).toEqual([
      "button.type_missing:a.ts:1",
    ]);
    const comparison = "const b = root.createElement('button');\nif (b.type === 'x') go();";
    expect(checkButtonTypes(new Map([["a.ts", comparison]])).missing).toEqual([
      "button.type_missing:a.ts:1",
    ]);
    const unassigned = "list.append(root.createElement('button'));";
    expect(checkButtonTypes(new Map([["a.ts", unassigned]])).missing).toEqual([
      "button.type_missing:a.ts:1",
    ]);
  });

  test("an empty input examines nothing", () => {
    expect(checkButtonTypes(new Map())).toEqual({
      files: 0,
      buttons: 0,
      markup: 0,
      createElement: 0,
      missing: [],
    });
  });
});

/** The six failure conditions of the sweep: a refusal, a missing type, or any empty reading. */
function expectSweep(urls: UrlSweep, buttons: ButtonSweep): void {
  expect(urls.refused).toEqual([]);
  expect(buttons.missing).toEqual([]);
  expect(urls.examined).toBeGreaterThan(0);
  expect(buttons.files).toBeGreaterThan(0);
  expect(buttons.markup).toBeGreaterThan(0);
  expect(buttons.createElement).toBeGreaterThan(0);
}

function countersLine(urls: UrlSweep, buttons: ButtonSweep): string {
  return (
    `markup-gates: urls examined=${urls.examined} refused=${urls.refused.length} | ` +
    `files=${buttons.files} buttons=${buttons.buttons} markup=${buttons.markup} ` +
    `createElement=${buttons.createElement} missing=${buttons.missing.length}`
  );
}

describe("sweep conditions", () => {
  const urls: UrlSweep = { examined: 4, refused: [] };
  const buttons: ButtonSweep = { files: 3, buttons: 2, markup: 1, createElement: 1, missing: [] };

  test("a clean, non-empty sweep passes", () => {
    expect(() => expectSweep(urls, buttons)).not.toThrow();
  });

  test.each<readonly [string, UrlSweep, ButtonSweep]>([
    ["a refused URL", { ...urls, refused: ["url.scheme_refused:a.html:1:data"] }, buttons],
    ["a missing type", urls, { ...buttons, missing: ["button.type_missing:a.ts:1"] }],
    ["no URL examined", { ...urls, examined: 0 }, buttons],
    ["no file", urls, { ...buttons, files: 0 }],
    ["no button tag", urls, { ...buttons, markup: 0 }],
    ["no DOM creation", urls, { ...buttons, createElement: 0 }],
  ])("fails on %s", (_name, failingUrls, failingButtons) => {
    expect(() => expectSweep(failingUrls, failingButtons)).toThrow();
  });

  test("fails on what the gates return for an empty input", () => {
    expect(() => expectSweep(checkUrlSchemes(new Map()), checkButtonTypes(new Map()))).toThrow();
  });
});

const root = join(import.meta.dir, "../..");
const cardsDirectory = join(import.meta.dir, "../data/cards");

// Same mounting as site.test.ts: the cards of the repository, placeholder fonts.
async function snapshotCards(): Promise<ProjectCard[]> {
  const names = (await readdir(cardsDirectory))
    .filter((name) => name.endsWith(".project.v1.yaml"))
    .sort();
  return Promise.all(
    names.map(async (name) =>
      parseProjectCard(Bun.YAML.parse(await readFile(join(cardsDirectory, name), "utf8"))),
    ),
  );
}

const fonts = new Map<string, Uint8Array>([
  ["assets/fonts/bricolage-grotesque-latin-wght-normal.woff2", new Uint8Array(1000)],
  ["assets/fonts/source-sans-3-latin-wght-normal.woff2", new Uint8Array(1000)],
  ["assets/fonts/LICENSE-bricolage-grotesque.txt", new Uint8Array(10)],
  ["assets/fonts/LICENSE-source-sans-3.txt", new Uint8Array(10)],
]);

/** Every .ts file under src/ and server/ but the tests; an unreadable file rejects. */
async function readSources(): Promise<Map<string, string>> {
  const sources = new Map<string, string>();
  for (const directory of ["src", "server"]) {
    const names = (await readdir(join(root, directory), { recursive: true }))
      .map((name) => name.replaceAll("\\", "/"))
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .sort();
    for (const name of names) {
      sources.set(`${directory}/${name}`, await readFile(join(root, directory, name), "utf8"));
    }
  }
  return sources;
}

describe("the assembled site and the sources of the repository", () => {
  let files: ReadonlyMap<string, string | Uint8Array>;
  let pages: number;
  let urls: UrlSweep;
  let buttons: ButtonSweep;

  beforeAll(async () => {
    const built = await buildLibreSite({
      cards: await snapshotCards(),
      presentations: [],
      extras: {},
      priorProofs: [],
      fonts,
    });
    files = built.files;
    const texts = await readSources();
    pages = 0;
    for (const [path, content] of files) {
      if (!path.endsWith(".html")) continue;
      pages += 1;
      const key = `assembled/${path}`;
      if (texts.has(key)) throw new Error(`markup_gates.duplicate_source:${key}`);
      texts.set(key, typeof content === "string" ? content : new TextDecoder().decode(content));
    }
    urls = checkUrlSchemes(files);
    buttons = checkButtonTypes(texts);
  });

  test("every URL of the assembled pages carries an allow-listed scheme or none", () => {
    expect(urls.refused).toEqual([]);
    expect(pages).toBeGreaterThan(0);
    expect(urls.examined).toBeGreaterThan(pages);
  });

  test("every button declares its type, in both forms", () => {
    expect(buttons.missing).toEqual([]);
    expect(buttons.buttons).toBe(buttons.markup + buttons.createElement);
    expect(buttons.files).toBeGreaterThan(pages);
    expectSweep(urls, buttons);
  });

  test("prints the seven counters", () => {
    const log = spyOn(console, "log");
    try {
      console.log(countersLine(urls, buttons));
      const line = String(log.mock.calls.at(-1)?.[0]);
      const numbers =
        /^markup-gates: urls examined=(\d+) refused=(\d+) \| files=(\d+) buttons=(\d+) markup=(\d+) createElement=(\d+) missing=(\d+)$/.exec(
          line,
        );
      expect(numbers?.slice(1).map(Number)).toEqual([
        urls.examined,
        urls.refused.length,
        buttons.files,
        buttons.buttons,
        buttons.markup,
        buttons.createElement,
        buttons.missing.length,
      ]);
    } finally {
      log.mockRestore();
    }
  });
});
