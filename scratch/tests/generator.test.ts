// Tests for the generator (lib/sb3.ts) itself.
import { writeFileSync } from "node:fs";
import { test } from "../workbench/testing.ts";
import { Project, Blocks, dsl } from "../lib/sb3.ts";

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
