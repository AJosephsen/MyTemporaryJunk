// Headless test harness for Scratch projects.
// Tests run in Chromium with the TurboWarp runtime. After the green flag, time only moves when a test says so:
// t.frames(30) runs exactly 30 frames (one second of game time) as fast as the machine allows.
//
//   import { test } from "../workbench/testing.ts";
//   test("drone falls", async t => {
//     await t.load("games/dust-hopper/dust-hopper.sb3");
//     await t.greenFlag();
//     const v = await t.until(v => v.state === "flying");   // runs inside the page
//     t.expect(v.Fuel === 1000, "full tank");
//   });
import { createRequire } from "node:module";
import { startServer } from "./server.ts";

export type Vars = Record<string, any>;
export type Sprite = { x: number; y: number; direction: number; costume: string; visible: boolean; bubble: string };

export interface T {
  /** Loads a project, path relative to the scratch/ folder. */
  load(path: string): Promise<void>;
  /** Clicks the green flag. From here on, time only moves with frames() and until(). */
  greenFlag(): Promise<void>;
  /** Runs exactly n frames (30 frames = 1 second of game time). */
  frames(n: number): Promise<void>;
  /**
   * Runs frame by frame until check(v, w, memo) returns true, and returns the variables at that frame.
   * The check runs inside the page, so it can only use its arguments: v = all variables,
   * w = the page's workbench object (for example w.key("up arrow", true)), memo = an object kept between frames.
   */
  until(check: (v: Vars, w: any, memo: any) => boolean, opts?: { max?: number; what?: string }): Promise<Vars>;
  vars(): Promise<Vars>;
  get(name: string): Promise<any>;
  set(name: string, value: any): Promise<void>;
  /** Keys use Scratch names: "up arrow", "space", "a", ... */
  hold(key: string): Promise<void>;
  release(key: string): Promise<void>;
  sprite(name: string): Promise<Sprite>;
  /** Runs fn(w) inside the page, with w = the page's workbench object (w.vm is the Scratch VM). */
  page<R>(fn: (w: any) => R): Promise<R>;
  screenshot(file: string): Promise<void>;
  expect(ok: boolean, message: string): void;
  near(actual: number, expected: number, tolerance: number, label: string): void;
  log(...args: unknown[]): void;
}

type TestFn = (t: T) => Promise<void>;
const tests: { name: string; fn: TestFn }[] = [];
export const test = (name: string, fn: TestFn) => { tests.push({ name, fn }); };


class Failure extends Error {}

export async function run(opts: { filter?: string; verbose?: boolean } = {}) {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const server = await startServer();
  const browser = await chromium.launch();
  const selected = tests.filter(x => !opts.filter || x.name.toLowerCase().includes(opts.filter.toLowerCase()));
  let failed = 0;
  const started = Date.now();

  for (const { name, fn } of selected) {
    const page = await browser.newPage({ viewport: { width: 760, height: 600 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (e: Error) => pageErrors.push(e.message));
    const logs: string[] = [];
    await page.goto(server.url + "?test=1");
    await page.waitForFunction(() => document.body.dataset.ready === "1");
    const wb = <R>(fn: (w: any, arg: any) => R, arg?: any): Promise<R> =>
      page.evaluate(([src, a]: [string, any]) => new Function("w", "a", `return (${src})(w, a)`)((window as any).workbench, a), [fn.toString(), arg]);

    const t: T = {
      async load(path) { await wb((w, p) => w.load(p), path); },
      async greenFlag() { await wb(w => w.greenFlag()); },
      async frames(n) { await wb((w, k) => w.step(k), n); },
      async until(check, o = {}) {
        const max = o.max ?? 900;
        const r = await wb((w, a) => w.until(a[0], a[1]), [check.toString(), max]) as { ok: boolean; vars: Vars };
        if (!r.ok) throw new Failure(`timed out after ${max} frames waiting for ${o.what ?? check.toString()}`);
        return r.vars;
      },
      vars: () => wb(w => w.vars()),
      async get(name) { return (await t.vars())[name]; },
      async set(name, value) { await wb((w, a) => w.set(a[0], a[1]), [name, value]); },
      async hold(key) { await wb((w, k) => w.key(k, true), key); },
      async release(key) { await wb((w, k) => w.key(k, false), key); },
      sprite: name => wb((w, n) => w.sprite(n), name),
      page: fn => wb(fn),
      async screenshot(file) { await wb(w => w.step(1)); await page.locator("#stage").screenshot({ path: file }); },
      expect(ok, message) { if (!ok) throw new Failure(message); },
      near(actual, expected, tol, label) {
        if (!(Math.abs(actual - expected) <= tol)) throw new Failure(`${label}: expected ${expected} ± ${tol}, got ${actual}`);
      },
      log: (...args) => { logs.push(args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ")); },
    };

    const t0 = Date.now();
    try {
      await fn(t);
      if (pageErrors.length) throw new Failure(`page errors: ${pageErrors.join("; ")}`);
      console.log(`  ok    ${name}  (${Date.now() - t0} ms)`);
    } catch (e) {
      failed++;
      console.log(`  FAIL  ${name}\n        ${e instanceof Failure ? e.message : (e as Error).stack}`);
    }
    if ((opts.verbose || failed) && logs.length) console.log(logs.map(l => "        " + l).join("\n"));
    await page.close();
  }

  await browser.close();
  await server.close();
  console.log(`\n${selected.length - failed} passed, ${failed} failed, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  return failed === 0;
}
