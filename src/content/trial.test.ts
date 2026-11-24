import { describe, expect, test } from "bun:test";

import { defaultFacts, type Facts, trippedRules } from "../client/logic";
import { MISSION_REQUESTS, TRANSFER, TRIAL_FIELDS, TRIAL_RULES } from "./trial";

const defaults = defaultFacts(TRIAL_FIELDS);
const refusals = (facts: Facts) =>
  trippedRules(TRIAL_RULES, facts, defaults).map((rule) => rule.id);

function expectKnownFacts(facts: Facts, where: string) {
  for (const [field, value] of Object.entries(facts)) {
    const known = TRIAL_FIELDS.find((candidate) => candidate.field === field);
    expect(known, `${where}: unknown field ${field}`).toBeDefined();
    expect(known?.values, `${where}: ${field} cannot be ${String(value)}`).toContain(value);
  }
}

describe("the trial's data", () => {
  test("every field has a harmless default and every rule a condition on known fields", () => {
    for (const { field, values } of TRIAL_FIELDS) {
      expect(values.length, field).toBeGreaterThanOrEqual(2);
    }
    expect(refusals({})).toEqual([]);
    for (const rule of TRIAL_RULES) {
      expect(Object.keys(rule.when).length, rule.id).toBeGreaterThan(0);
      expectKnownFacts(rule.when, rule.id);
    }
  });

  test("rule identifiers are unique", () => {
    const ids = TRIAL_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every fact an action states is a known field with an allowed value", () => {
    for (const request of MISSION_REQUESTS) {
      for (const action of request.actions) expectKnownFacts(action.facts, request.id);
    }
    expectKnownFacts(TRANSFER.agent.facts, "transfer.agent");
    expectKnownFacts(TRANSFER.director.facts, "transfer.director");
  });
});

describe("the mission order (ADR 0010 §8)", () => {
  // Refusals as the redesign prototype showed them in its version 17 (textes-v4.json), request
  // by request and action by action. They are an outside record: the engine must find them.
  const expected: Record<string, string[][]> = {
    compta: [[], ["consigne"], ["relecture"]],
    rh: [[], ["autorisation"], []],
    commercial: [["europe", "modele"], []],
    informatique: [["installation"], ["isole"], []],
    support: [["traces"], [], ["relecture"]],
  };

  test("the engine computes the refusals of every action", () => {
    const computed = Object.fromEntries(
      MISSION_REQUESTS.map((request) => [
        request.id,
        request.actions.map((action) => refusals(action.facts)),
      ]),
    );
    expect(computed).toEqual(expected);
  });

  test("an action carries a reason exactly when a rule refuses it", () => {
    for (const request of MISSION_REQUESTS) {
      for (const action of request.actions) {
        const refused = refusals(action.facts).length > 0;
        expect(action.why !== undefined, `${request.id}: ${action.text}`).toBe(refused);
      }
    }
  });

  test("every request has an accepted action and a refused one", () => {
    for (const request of MISSION_REQUESTS) {
      const outcomes = request.actions.map((action) => refusals(action.facts).length > 0);
      expect(outcomes, request.id).toContain(true);
      expect(outcomes, request.id).toContain(false);
    }
  });

  test("every rule of the trial refuses at least one action of the day", () => {
    const tripped = new Set(
      MISSION_REQUESTS.flatMap((request) =>
        request.actions.flatMap((action) => refusals(action.facts)),
      ),
    );
    expect([...tripped].sort()).toEqual(TRIAL_RULES.map((rule) => rule.id).sort());
  });
});

describe("the transfer: one form for everyone (ADR 0010 §8)", () => {
  test("the agent's reviewed transfer passes", () => {
    expect(refusals(TRANSFER.agent.facts)).toEqual([]);
  });

  test("the director's unreviewed transfer stops on the review rule alone", () => {
    expect(refusals(TRANSFER.director.facts)).toEqual(["relecture"]);
  });
});
