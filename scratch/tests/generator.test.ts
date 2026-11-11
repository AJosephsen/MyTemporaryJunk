// Tests for the generator (lib/sb3.ts) itself.
import { writeFileSync } from "node:fs";
import { test } from "../workbench/testing.ts";
import { Project, Blocks, dsl } from "../lib/sb3.ts";
import { record } from "../lib/records.ts";

// A project that reuses blocks on purpose: one expression in two inputs, one statement three times
// (twice in a row and once in another script) and one stack inside two loops.
function reuseProject(): Buffer {
  const P = new Project(), B = new Blocks(P), d = dsl(B);
  const { v, add, set, change, repeat, whenFlag, broadcast, whenReceive } = d;
  const twice = add(v("a"), 1);                           // the same expression ...
  const step = change("n", 1);                            // ... statement ...
  const stack = [change("s", 1), change("s", 1)];         // ... and stack
  B.script(whenFlag(), [
    set("a", 5), set("b", twice), set("c", twice),        // b = c = 6
    set("n", 0), step, step,                              // n = 2 here
    set("s", 0), repeat(2, stack), repeat(3, stack),      // s = 4 + 6
    broadcast("more"),
  ]);
  B.script(whenReceive("more"), [step], 300, 0);          // n = 3
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#fff"/></svg>`;
  return P.build({ backdrop: P.costume("plain", svg, 240, 180), sprites: [], stage: B });
}

for (const compiler of [true, false]) test(`generator: reused blocks are copied, so each place works (${compiler ? "compiled" : "interpreted"})`, async t => {
  writeFileSync(new URL("../export/reuse.sb3", import.meta.url), reuseProject());
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load("export/reuse.sb3"); await t.greenFlag(); await t.frames(5);
  const got = { b: await t.get("b"), c: await t.get("c"), n: await t.get("n"), s: await t.get("s") };
  t.expect(Number(got.b) === 6 && Number(got.c) === 6 && Number(got.n) === 3 && Number(got.s) === 10, JSON.stringify(got));
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
});

// Custom blocks that return values: max, recursive fib, and three results in one sum.
function returnsProject(): Buffer {
  const P = new Project(), B = new Blocks(P), d = dsl(B);
  const { arg, gt, lt, sub, add, ifElse, set, whenFlag, define, ret, retCalls, compute, fn, result, call } = d;
  define("max %s %s", [ifElse(gt(arg("a"), arg("b")), ret("max %s %s", arg("a")), ret("max %s %s", arg("b")))],
    { args: ["a", "b"], warp: true });
  define("fib %s", [ifElse(lt(arg("n"), 2), ret("fib %s", arg("n")),
    retCalls("fib %s", [fn("fib %s", sub(arg("n"), 1)), fn("fib %s", sub(arg("n"), 2))], (x, y) => add(x, y)))],
    { args: ["n"], warp: true, y: 200 });
  define("go", [
    call("max %s %s", 3, 9), set("big", result("max %s %s")),
    ...compute("f10", [fn("fib %s", 10)]),
    ...compute("three", [fn("max %s %s", 1, 2), fn("fib %s", 7), fn("max %s %s", 40, 4)], (a, b, c) => add(add(a, b), c)),
  ], { warp: true, y: 400 });
  B.script(whenFlag(), [call("go")], 400, 0);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#fff"/></svg>`;
  return P.build({ backdrop: P.costume("plain", svg, 240, 180), sprites: [], stage: B });
}

for (const compiler of [true, false]) test(`generator: custom blocks return values, also recursively (${compiler ? "compiled" : "interpreted"})`, async t => {
  writeFileSync(new URL("../export/returns.sb3", import.meta.url), returnsProject());
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load("export/returns.sb3"); await t.greenFlag(); await t.frames(5);
  const got = { big: await t.get("big"), f10: await t.get("f10"), three: await t.get("three"), stack: await t.get("↩ stack") };
  t.expect(Number(got.big) === 9 && Number(got.f10) === 55 && Number(got.three) === 2 + 13 + 40
    && (got.stack as any[]).length === 0, JSON.stringify(got));
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
});

// Records: rows of meteors kept as parallel lists.
function recordsProject(): Buffer {
  const P = new Project(), B = new Blocks(P), d = dsl(B);
  const { v, lt, ifThen, set, whenFlag, define, call } = d;
  const meteor = record(d, "meteor", ["x", "y", "ans"] as const);
  define("go", [
    ...meteor.clear(),
    ...meteor.add({ x: -100, y: 180, ans: 7 }), ...meteor.add({ x: 0, y: 150, ans: 12 }),
    ...meteor.add({ x: 100, y: 120, ans: 9 }), ...meteor.add({ x: 50, ans: 3 }),   // y left out: empty
    meteor.change("y", 1, -30),                                     // row 1: y 150
    meteor.set("x", meteor.find("ans", 9), 111),                    // row 3: x 111
    set("rowOf12", meteor.find("ans", 12)),
    // Remove every meteor below y 140 (rows 3 and 4), walking backwards.
    ...meteor.each("i", [ifThen(lt(meteor.get("y", v("i")), 140), meteor.remove(v("i")))]),
    set("rows", meteor.count()),
  ], { warp: true });
  B.script(whenFlag(), [call("go")], 400, 0);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#fff"/></svg>`;
  return P.build({ backdrop: P.costume("plain", svg, 240, 180), sprites: [], stage: B });
}

for (const compiler of [true, false]) test(`generator: records keep rows in parallel lists (${compiler ? "compiled" : "interpreted"})`, async t => {
  writeFileSync(new URL("../export/records.sb3", import.meta.url), recordsProject());
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load("export/records.sb3"); await t.greenFlag(); await t.frames(5);
  const got = { x: await t.get("meteor.x"), y: await t.get("meteor.y"), ans: await t.get("meteor.ans"),
    rowOf12: await t.get("rowOf12"), rows: await t.get("rows") };
  t.expect(JSON.stringify(got.x.map(Number)) === "[-100,0]" && JSON.stringify(got.y.map(Number)) === "[150,150]"
    && JSON.stringify(got.ans.map(Number)) === "[7,12]" && Number(got.rowOf12) === 2 && Number(got.rows) === 2, JSON.stringify(got));
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
});
