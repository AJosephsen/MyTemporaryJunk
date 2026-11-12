// Tests for Pizza Fractions (maths game: put pepperoni on the right fraction of the pizza).
import { test, type T } from "../workbench/testing.ts";

const GAME = "games/pizza-fractions/pizza-fractions.sb3";
const shot = (name: string) => `/tmp/claude-0/-home-user/af299c66-140a-5320-8b1f-a09d589ac156/scratchpad/${name}.png`;
const R = 90, PY = -45, PER = 12, SERVE = [172, -128];
const list = (t: T, name: string) => t.get(name) as Promise<any[]>;

async function startGame(t: T, compiler = true) {
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load(GAME); await t.greenFlag(); await t.frames(5);
  await t.mouse(0, 0); await t.click(0, 0);
  await t.until(v => v.phase === "play" && v.state === "order", { max: 120, what: "the first order" });
}
const click = async (t: T, x: number, y: number) => { await t.mouse(x, y); await t.click(x, y); await t.frames(2); };
// Clicks n slices (across the pizzas, in order), then SERVE.
async function make(t: T, n: number, serve = true) {
  const v = await t.until(v => v.state === "order", { max: 200, what: "an order" });
  const cut = Number(v.cut), scale = Number(v.scale) / 100, xs = (await list(t, "pizzaX")).map(Number);
  for (let s = 0; s < n; s++) {
    const p = Math.floor(s / cut), i = s % cut, a = (i + 0.5) * 360 / cut * Math.PI / 180;
    await click(t, xs[p] + 0.6 * R * scale * Math.sin(a), PY + 0.6 * R * scale * Math.cos(a));
  }
  if (serve) await click(t, SERVE[0], SERVE[1]);
  return { a: Number(v.a), b: Number(v.b), cut, need: Number(v.need), pizzas: Number(v.pizzas) };
}

test("pizza fractions: the title shows; a click starts level 1 with an order in halves or quarters", async t => {
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
  await t.load(GAME); await t.greenFlag(); await t.frames(20);
  await t.screenshot(shot("pf-title"));
  await t.mouse(0, 0); await t.click(0, 0);
  const v = await t.until(v => v.phase === "play" && v.state === "order", { max: 120, what: "play" });
  t.expect([2, 4].includes(Number(v.b)) && Number(v.cut) === Number(v.b) && Number(v.a) < Number(v.b), `order ${v.a}/${v.b}, cut ${v.cut}`);
});

for (const compiler of [true, false]) test(`pizza fractions: clicking slices toggles pepperoni; the right amount served scores (${compiler ? "compiled" : "interpreted"})`, async t => {
  await startGame(t, compiler);
  const v0 = await t.vars();
  // One slice on, then off again.
  await make(t, 1, false);
  t.expect((await list(t, "sel")).map(Number).reduce((a, b) => a + b) === 1, "one slice on");
  await make(t, 1, false);
  t.expect((await list(t, "sel")).map(Number).reduce((a, b) => a + b) === 0, "and off again");
  const o = await make(t, Number(v0.need), false);
  await t.frames(8);
  if (compiler) await t.screenshot(shot("pf-order"));
  await click(t, SERVE[0], SERVE[1]);
  const v = await t.vars();
  t.expect(v.state === "happy" && Number(v.score) >= 150 && Number(v.hearts) === 3, `${o.a}/${o.b}: state ${v.state}, score ${v.score}`);
  if (compiler) { await t.frames(10); await t.screenshot(shot("pf-thanks")); }
});

test("pizza fractions: a wrong amount costs a heart and shows the right slices", async t => {
  await startGame(t);
  const o = await make(t, Number(await t.get("need")) + 1);
  const v = await t.vars();
  const on = (await list(t, "sel")).map(Number).reduce((a, b) => a + b);
  t.expect(v.state === "fix" && Number(v.hearts) === 2 && on === o.need, `state ${v.state}, hearts ${v.hearts}, ${on} slices shown for ${o.a}/${o.b}`);
  await t.frames(10);
  await t.screenshot(shot("pf-wrong"));
});

test("pizza fractions: levels: thirds to twelfths, equivalent fractions, improper over two pizzas", async t => {
  await startGame(t);
  const seen: string[] = [];
  for (let level = 1; level <= 6; level++) {
    for (let i = 0; i < 6; i++) {
      const need = Number((await t.until(v => v.state === "order", { max: 300, what: "an order" })).need);
      const o = await make(t, need, false);
      if (level === 5 && i === 0) { await t.frames(8); await t.screenshot(shot("pf-two")); }
      await click(t, SERVE[0], SERVE[1]);
      if (i === 0) seen.push(`${level}: ${o.a}/${o.b} on ${o.pizzas}×${o.cut} = ${o.need}`);
      // Every cut has its slice costume.
      const has = await t.page((w, c) => w.vm.runtime.targets.find((x: any) => x.sprite.name === "Slice").sprite.costumes.some((k: any) => k.name === `w${c}`), o.cut);
      t.expect(has, `a slice costume for ${o.cut} slices`);
      t.expect((await t.get("state")) === "happy", `level ${level}: ${o.a}/${o.b} served`);
    }
    if (level < 6) {
      for (let f = 0; f < 60 && !((await t.get("phase")) === "play" && Number(await t.get("level")) === level + 1); f++) await t.frames(10);
      t.expect(Number(await t.get("level")) === level + 1, `level ${level + 1}`);
    }
  }
  t.log(seen);
  t.expect(Number(await t.get("hearts")) === 3, "no hearts lost");
});

test("pizza fractions: a customer who waits too long leaves cross; a heart", async t => {
  await startGame(t);
  await t.until(v => Number(v.hearts) === 2, { max: 500, what: "patience to run out" });
  t.expect((await t.get("state")) === "fix", "the right slices are shown");
});
