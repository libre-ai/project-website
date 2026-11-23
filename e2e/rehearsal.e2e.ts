import { expect, type Page, test } from "@playwright/test";

import { APPLICATIONS } from "../src/content/applications";

// Rehearsal of the application micro-demos (ADR 0007 §5). The visual suite photographs settled
// pages with every animation stopped, so it never sees the in-between states of a demo, which is
// where a demo breaks: a chip that jumps a few pixels, a loop that does not join, a label that
// never fits its box. Here every animation of a demo is paused and sought frame by frame: each
// frame is a function of time alone, so a run repeats exactly. The method comes from the
// film/jumps/layout scripts of Stageshow (benjitaylor/skills, MIT); no code is taken from it.
//
// Not covered, by construction: colour changes (computed colours serialise in several syntaxes
// once color-mix() is involved), discrete properties such as text-decoration, SVG internals,
// and anything outside the figure.

const FPS = 30;
const JUMP_PX = 4;
const SPIKE = 3;
const OPACITY_POP = 0.5;
const SEEN = 0.1;
const VISIBLE = 0.5;

type DefectKind =
  | "no-animation"
  | "loop-period"
  | "jump"
  | "opacity-pop"
  | "out-of-frame"
  | "never-fits";

interface Defect {
  demo: string;
  element: string;
  kind: DefectKind;
  atMs: number;
  amount: number;
  occurrences: number;
}

interface DemoReport {
  demo: string;
  animations: number;
  frames: number;
  elements: number;
  stepped: number;
  defects: Defect[];
}

interface Thresholds {
  selector: string;
  fps: number;
  jumpPx: number;
  spike: number;
  opacityPop: number;
  seen: number;
  visible: number;
}

// Runs inside the page: it must stay self-contained (serialised by Playwright).
function rehearse(args: Thresholds): DemoReport[] {
  // A figure in a hidden tab panel is not rendered and runs no animation: only rendered figures
  // are rehearsed, and the caller shows each panel in turn.
  const figures = [...document.querySelectorAll<HTMLElement>(args.selector)].filter(
    (figure) => figure.getClientRects().length > 0,
  );
  return figures.map((figure): DemoReport => {
    const demo =
      figure.closest("li")?.querySelector("a.couvrir")?.getAttribute("href") ?? location.pathname;
    const defects = new Map<string, Defect>();
    const record = (element: string, kind: DefectKind, atMs: number, amount: number): void => {
      const key = `${element}\u0000${kind}`;
      const known = defects.get(key);
      if (known === undefined) {
        defects.set(key, { demo, element, kind, atMs: Math.round(atMs), amount, occurrences: 1 });
      } else {
        known.occurrences += 1;
        known.amount = Math.max(known.amount, amount);
      }
    };

    const animations = figure.getAnimations({ subtree: true });
    if (animations.length === 0) {
      record("figure", "no-animation", 0, 0);
      return {
        demo,
        animations: 0,
        frames: 0,
        elements: 0,
        stepped: 0,
        defects: [...defects.values()],
      };
    }

    // One shared period is what makes the loop join: with several periods the demo only repeats
    // at their least common multiple, which nobody watches.
    const timings = animations.map((animation) => animation.effect?.getTiming());
    const durations = new Set(timings.map((timing) => Number(timing?.duration)));
    const cycle = Math.max(...durations);
    if (durations.size !== 1 || timings.some((timing) => timing?.iterations !== Infinity)) {
      record("figure", "loop-period", 0, durations.size);
    }
    const lastDelay = Math.max(...timings.map((timing) => Number(timing?.delay ?? 0)));

    // A steps() easing changes size on purpose (typewriter): only its position is watched.
    const stepped = new Set<Element>();
    for (const animation of animations) {
      const effect = animation.effect;
      if (!(effect instanceof KeyframeEffect) || effect.target === null) continue;
      const easings = [effect.getTiming().easing, ...effect.getKeyframes().map((k) => k.easing)];
      if (easings.some((easing) => String(easing).startsWith("steps"))) stepped.add(effect.target);
    }

    const elements = [figure, ...figure.querySelectorAll<Element>("*:not(svg *)")];
    const describe = (element: Element): string => {
      const classes = [...element.classList].filter((name) => !name.startsWith("h-")).join(".");
      const text = (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 32);
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}${text ? ` « ${text} »` : ""}`;
    };
    const withText = new Set(
      elements.filter((element) => element !== figure && (element.textContent ?? "").trim() !== ""),
    );
    const leastOverflow = new Map<Element, number>();
    const travel = new Map<Element, { time: number; move: number }[]>();

    for (const animation of animations) animation.pause();
    const step = 1000 / args.fps;
    const end = lastDelay + cycle + 2 * step;
    let previous = new Map<Element, { o: number; l: number; t: number; r: number; b: number }>();
    let frames = 0;
    for (let time = 0; time <= end; time += step) {
      for (const animation of animations) animation.currentTime = time;
      frames += 1;
      const frame = figure.getBoundingClientRect();
      const current = new Map<Element, { o: number; l: number; t: number; r: number; b: number }>();
      for (const element of elements) {
        const style = getComputedStyle(element);
        const own =
          style.display === "none" || style.visibility === "hidden" ? 0 : Number(style.opacity);
        const parent = element.parentElement;
        const o = (parent === null ? 1 : (current.get(parent)?.o ?? 1)) * own;
        const box = element.getBoundingClientRect();
        const sample = { o, l: box.left, t: box.top, r: box.right, b: box.bottom };
        current.set(element, sample);
        const name = describe(element);

        if (o >= args.visible && element !== figure) {
          const outside = Math.max(
            frame.left - box.left,
            box.right - frame.right,
            frame.top - box.top,
            box.bottom - frame.bottom,
          );
          if (outside > 1) record(name, "out-of-frame", time, Math.round(outside));
          if (withText.has(element) && element.clientWidth > 0) {
            const overflow = Math.max(
              element.scrollWidth - element.clientWidth,
              element.scrollHeight - element.clientHeight,
            );
            leastOverflow.set(element, Math.min(leastOverflow.get(element) ?? overflow, overflow));
          }
        }

        const before = previous.get(element);
        if (before === undefined) continue;
        let move = 0;
        if (Math.min(before.o, o) >= args.seen) {
          const moves = stepped.has(element)
            ? [sample.l - before.l, sample.t - before.t]
            : [sample.l - before.l, sample.t - before.t, sample.r - before.r, sample.b - before.b];
          move = Math.max(...moves.map(Math.abs));
        }
        const series = travel.get(element) ?? [];
        series.push({ time, move });
        travel.set(element, series);
        const pop = Math.abs(o - before.o);
        if (pop > args.opacityPop) record(name, "opacity-pop", time, Math.round(pop * 100) / 100);
      }
      previous = current;
    }
    // A jump is an isolated discontinuity, as in Stageshow's jumps script: a frame that moves
    // much more than both of its neighbours. A fast but continuous motion (a card turning, a bar
    // growing) moves about as much from one frame to the next and is not one.
    for (const [element, series] of travel) {
      series.forEach(({ time, move }, index) => {
        const around = Math.max(series[index - 1]?.move ?? 0, series[index + 1]?.move ?? 0);
        if (move > args.jumpPx && move > args.spike * around) {
          record(describe(element), "jump", time, Math.round(move * 10) / 10);
        }
      });
    }
    for (const [element, overflow] of leastOverflow) {
      if (overflow > 1) record(describe(element), "never-fits", 0, overflow);
    }
    for (const animation of animations) animation.play();

    return {
      demo,
      animations: animations.length,
      frames,
      elements: elements.length,
      stepped: stepped.size,
      defects: [...defects.values()],
    };
  });
}

async function open(page: Page, path: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}

function rehearseRendered(page: Page, selector: string): Promise<DemoReport[]> {
  return page.evaluate(rehearse, {
    selector,
    fps: FPS,
    jumpPx: JUMP_PX,
    spike: SPIKE,
    opacityPop: OPACITY_POP,
    seen: SEEN,
    visible: VISIBLE,
  });
}

// The volume is printed on success too: a verdict without it is compatible with no inspection.
function summarise(label: string, reports: readonly DemoReport[]): string {
  const sum = (pick: (report: DemoReport) => number): number =>
    reports.reduce((total, report) => total + pick(report), 0);
  return `${label}: ${reports.length} démos, ${sum((r) => r.animations)} animations, ${sum((r) => r.frames)} images, ${sum((r) => r.elements)} éléments suivis dont ${sum((r) => r.stepped)} pas à pas, ${sum((r) => r.defects.length)} défauts`;
}

const scriptless = (name: string): boolean => name === "chromium-no-js";

test.describe("micro-demo rehearsal", () => {
  test.setTimeout(240_000);

  for (const width of [390, 1440]) {
    test(`every card demo of /applications/ at ${width} px`, async ({ page }, testInfo) => {
      test.skip(scriptless(testInfo.project.name), "seeking animations needs script");
      await page.setViewportSize({ width, height: 900 });
      await open(page, "/applications/");
      // The universes are tabs: each panel is shown in turn, and every demo must be met once.
      const tabs = page.getByRole("tab");
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThan(0);
      const byDemo = new Map<string, DemoReport>();
      for (let index = 0; index < tabCount; index += 1) {
        await tabs.nth(index).click();
        for (const report of await rehearseRendered(page, "figure.demo")) {
          if (!byDemo.has(report.demo)) byDemo.set(report.demo, report);
        }
      }
      const reports = [...byDemo.values()];
      console.log(
        summarise(
          `${testInfo.project.name} /applications/ ${width} px, ${tabCount} onglets`,
          reports,
        ),
      );
      expect(reports).toHaveLength(APPLICATIONS.length);
      expect(reports.flatMap((report) => report.defects)).toEqual([]);
    });
  }

  test("the large demo of every application page at 390 px", async ({ page }, testInfo) => {
    test.skip(scriptless(testInfo.project.name), "seeking animations needs script");
    await page.setViewportSize({ width: 390, height: 900 });
    const reports: DemoReport[] = [];
    for (const application of APPLICATIONS) {
      await open(page, `/applications/${application.slug}/`);
      const found = await rehearseRendered(page, "figure.demo-grande");
      expect(found, application.slug).toHaveLength(1);
      reports.push(...found);
    }
    console.log(summarise(`${testInfo.project.name} pages d'application 390 px`, reports));
    expect(reports.flatMap((report) => report.defects)).toEqual([]);
  });
});
