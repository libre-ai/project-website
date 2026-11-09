import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkDiagram, extractTexts, parseSource } from "./diagram-nodes";

describe("extractTexts", () => {
  test("returns the text of every <text> element, decoded and trimmed", () => {
    const html = '<svg><text x="1">  A &amp; B </text><text>C</text><title>ignored</title></svg>';
    expect(extractTexts(html)).toEqual(["A & B", "C"]);
  });

  test("joins tspans of one text element and drops empty ones", () => {
    const html =
      "<svg><text><tspan>Utilisable</tspan><tspan> ?</tspan></text><text>  </text></svg>";
    expect(extractTexts(html)).toEqual(["Utilisable ?"]);
  });
});

describe("parseSource", () => {
  test("ignores blank lines and # comments", () => {
    expect(parseSource("# titre\n\nA\n  B  \n")).toEqual(["A", "B"]);
  });
});

describe("checkDiagram (DIAG-1)", () => {
  test("a rendered node absent from the source is reported", () => {
    const result = checkDiagram("<svg><text>A</text><text>Z</text></svg>", "A\n");
    expect(result.rendered).toBe(2);
    expect(result.missingFromSource).toEqual(["Z"]);
  });

  test("a source line never rendered is reported", () => {
    const result = checkDiagram("<svg><text>A</text></svg>", "A\nB\n");
    expect(result.unrendered).toEqual(["B"]);
  });

  test("a diagram without any text node fails closed", () => {
    expect(() => checkDiagram("<svg></svg>", "A\n")).toThrow("diagram.no_text_nodes");
  });
});

describe("repository diagrams", () => {
  const directory = join(import.meta.dir, "..", "docs", "diagrams");
  const diagrams = readdirSync(directory).filter((name) => name.endsWith(".html"));

  test("the directory holds at least one diagram", () => {
    expect(diagrams.length).toBeGreaterThan(0);
  });

  // DIAG-5 (ADR 0003): no diagram carries a state name, in any file of the folder.
  test("no diagram or source uses an exposure or maturity name", () => {
    const names = [
      "exposition",
      "maturité",
      "utilisable",
      "éprouvé",
      "usable-verifiable",
      "spec-published",
    ];
    let examined = 0;
    for (const file of readdirSync(directory).filter((n) => /\.(html|txt)$/.test(n))) {
      const text = readFileSync(join(directory, file), "utf8").toLowerCase();
      examined += 1;
      for (const name of names) expect(text, `${file}: ${name}`).not.toContain(name);
    }
    console.log(`DIAG-5 files examined: ${examined}`);
    expect(examined).toBeGreaterThan(0);
  });

  for (const name of diagrams) {
    test(`${name}: every node is in its source, every source line is rendered`, () => {
      const source = readFileSync(join(directory, name.replace(/\.html$/, ".nodes.txt")), "utf8");
      const result = checkDiagram(readFileSync(join(directory, name), "utf8"), source);
      console.log(`DIAG-1 ${name}: nodes ${result.rendered}, source lines ${result.sourceLines}`);
      expect(result.missingFromSource).toEqual([]);
      expect(result.unrendered).toEqual([]);
    });
  }
});
