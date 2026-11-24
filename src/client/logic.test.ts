import { describe, expect, test } from "bun:test";

import {
  clampStep,
  defaultFacts,
  nextTabIndex,
  resolveTheme,
  THEME_STORAGE_KEY,
  trippedRules,
} from "./logic";

describe("resolveTheme (ADR 0005 §4)", () => {
  test("a valid saved choice wins over the system", () => {
    expect(resolveTheme("sombre", false)).toBe("sombre");
    expect(resolveTheme("clair", true)).toBe("clair");
  });

  test("without a valid saved choice, the system preference decides", () => {
    expect(resolveTheme(null, true)).toBe("sombre");
    expect(resolveTheme(null, false)).toBe("clair");
    expect(resolveTheme("dark", true)).toBe("sombre");
    expect(resolveTheme("<script>", false)).toBe("clair");
  });

  test("uses one storage key", () => {
    expect(THEME_STORAGE_KEY).toBe("libre-ia-theme");
  });
});

describe("nextTabIndex (WAI-ARIA tabs pattern)", () => {
  test("arrows move and wrap around", () => {
    expect(nextTabIndex(0, "ArrowRight", 8)).toBe(1);
    expect(nextTabIndex(7, "ArrowRight", 8)).toBe(0);
    expect(nextTabIndex(0, "ArrowLeft", 8)).toBe(7);
    expect(nextTabIndex(3, "ArrowLeft", 8)).toBe(2);
  });

  test("Home and End jump to the ends", () => {
    expect(nextTabIndex(4, "Home", 8)).toBe(0);
    expect(nextTabIndex(4, "End", 8)).toBe(7);
  });

  test("any other key leaves the focus where it is", () => {
    expect(nextTabIndex(4, "Enter", 8)).toBeNull();
    expect(nextTabIndex(4, "ArrowDown", 8)).toBeNull();
  });

  test("no tab, no move", () => {
    expect(nextTabIndex(0, "ArrowRight", 0)).toBeNull();
  });
});

describe("the rule engine (ADR 0010 §4)", () => {
  // Hand-written fields and rules, so these cases test the engine and not the site's data.
  const fields = [
    { field: "destination", values: ["appareil", "europe", "hors-ue"] },
    { field: "relu", values: [true, false] },
  ] as const;
  const rules = [
    { id: "europe", when: { destination: "hors-ue" } },
    { id: "relecture", when: { relu: false } },
    { id: "les-deux", when: { destination: "hors-ue", relu: false } },
  ] as const;
  const defaults = defaultFacts(fields);
  const ids = (facts: Record<string, string | boolean>) =>
    trippedRules(rules, facts, defaults).map((rule) => rule.id);

  test("an action that states nothing keeps every default and trips nothing", () => {
    expect(defaults).toEqual({ destination: "appareil", relu: true });
    expect(ids({})).toEqual([]);
  });

  test("a rule trips only when every fact it lists holds", () => {
    expect(ids({ destination: "hors-ue" })).toEqual(["europe"]);
    expect(ids({ relu: false })).toEqual(["relecture"]);
    expect(ids({ destination: "europe", relu: false })).toEqual(["relecture"]);
  });

  test("several rules trip together, in rule order", () => {
    expect(ids({ relu: false, destination: "hors-ue" })).toEqual([
      "europe",
      "relecture",
      "les-deux",
    ]);
  });

  test("a stated fact overrides its default, including a stated default value", () => {
    expect(ids({ destination: "appareil", relu: true })).toEqual([]);
    expect(trippedRules(rules, {}, { destination: "hors-ue", relu: true })).toEqual([rules[0]]);
  });

  test("a field without values gives no default", () => {
    expect(defaultFacts([{ field: "vide", values: [] }])).toEqual({});
  });
});

describe("clampStep", () => {
  test("keeps the guided tour inside its steps", () => {
    expect(clampStep(-1, 7)).toBe(0);
    expect(clampStep(3, 7)).toBe(3);
    expect(clampStep(7, 7)).toBe(6);
  });
});
