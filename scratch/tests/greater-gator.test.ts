// Tests for Greater Gator (maths game: eat the bigger number).
import { test, type T } from "../workbench/testing.ts";

const GAME = "games/greater-gator/greater-gator.sb3";
const shot = (name: string) => `/tmp/claude-0/-home-user/af299c66-140a-5320-8b1f-a09d589ac156/scratchpad/${name}.png`;
const CLICK_X = [-160, 160, 0];   // where to click for left, right, the gator (same)

async function startGame(t: T, compiler = true) {
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load(GAME); await t.greenFlag(); await t.frames(5);
  await t.mouse(0, 0); await t.click(0, 0);
  await t.until(v => v.phase === "play" && v.state === "come", { max: 120, what: "the first pair" });
}
// Waits for the next pair, then clicks the right side (or a wrong one).
async function answer(t: T, right = true) {
  const v = await t.until(v => v.state === "come", { max: 200, what: "a pair" });
  const ans = Number(v.answer), pick = right ? ans : ans === 1 ? 2 : 1;
  await t.mouse(CLICK_X[pick - 1], -60); await t.click(CLICK_X[pick - 1], -60); await t.frames(2);
  return { left: String(v.lt), right: String(v.rt), lv: Number(v.lv), rv: Number(v.rv), ans };
}

test("greater gator: the title shows; a click starts level 1 with two numbers to 20", async t => {
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
  await t.load(GAME); await t.greenFlag(); await t.frames(20);
  await t.screenshot(shot("gg-title"));
  await t.mouse(0, 0); await t.click(0, 0);
  const v = await t.until(v => v.phase === "play" && v.state === "come", { max: 120, what: "play" });
  t.expect(Number(v.lv) >= 1 && Number(v.lv) <= 20 && Number(v.rv) >= 1 && Number(v.lv) !== Number(v.rv), `${v.lv} and ${v.rv}`);
  await t.frames(40);
  await t.screenshot(shot("gg-pair"));
});

for (const compiler of [true, false]) test(`greater gator: eating the bigger one scores and shows the comparison (${compiler ? "compiled" : "interpreted"})`, async t => {
  await startGame(t, compiler);
  const p = await answer(t);
  const v = await t.until(v => v.state === "eat", { max: 5, what: "the bite" });
  t.expect(Number(v.score) >= 100 && Number(v.streak) === 1 && Number(v.hearts) === 3, `score ${v.score}, streak ${v.streak}`);
  t.expect((p.ans === 1 ? p.lv > p.rv : p.rv > p.lv) && v.sign === (p.ans === 1 ? ">" : "<"), `${p.left} ${v.sign} ${p.right}`);
  await t.frames(8);
  if (compiler) await t.screenshot(shot("gg-bite"));
});

test("greater gator: the smaller one, or waiting too long, costs a heart", async t => {
  await startGame(t);
  await answer(t, false);
  t.expect(Number(await t.get("hearts")) === 2, `wrong: hearts ${await t.get("hearts")}`);
  await t.until(v => v.state === "come", { max: 200, what: "the next pair" });
  await t.until(v => Number(v.hearts) === 1, { max: 400, what: "too slow" });
  await t.frames(10);
  await t.screenshot(shot("gg-slow"));
});

test("greater gator: levels bring two digits, sums, negatives, decimals and fractions (and SAME)", async t => {
  await startGame(t);
  const seen: string[] = [];
  for (let level = 1; level <= 6; level++) {
    const goal = Number(await t.get("goal"));
    for (let i = 0; i < goal; i++) {
      const p = await answer(t);
      if (i === 0) seen.push(`${level}: ${p.left} ${p.ans === 1 ? ">" : p.ans === 2 ? "<" : "="} ${p.right}`);
    }
    if (level < 6) {
      for (let f = 0; f < 50 && !((await t.get("phase")) === "play" && Number(await t.get("level")) === level + 1); f++) await t.frames(10);
      t.expect(Number(await t.get("level")) === level + 1, `level ${level + 1}`);
    }
  }
  t.log(seen);
  const v = await t.vars();
  t.expect(Number(v.hearts) === 3 && Number(v.score) > 10000, `hearts ${v.hearts}, score ${v.score}`);
  t.expect(seen[3].includes("−") && /0\./.test(seen[4]) && seen[5].includes("/"), `kinds ${seen}`);
  await t.screenshot(shot("gg-level6"));
});

test("greater gator: an equal pair (0.5 and 0.50) wants the gator: SAME", async t => {
  await startGame(t);
  // Jump to level 5 and make the next pair equal.
  await t.page(w => { const st = w.vm.runtime.getTargetForStage(); for (const x of Object.values(st.variables) as any[]) if (x.name === "level") x.value = 5; });
  await t.until(v => v.state === "come", { max: 200, what: "a pair" });
  await t.page(w => { const st = w.vm.runtime.getTargetForStage(); for (const x of Object.values(st.variables) as any[]) {
    if (x.name === "lv" || x.name === "rv") x.value = 0.5; if (x.name === "answer") x.value = 3; if (x.name === "sign") x.value = "=";
    if (x.name === "sameOk") x.value = 1; } });
  await t.mouse(0, -110); await t.click(0, -110); await t.frames(2);
  const v = await t.vars();
  t.expect(v.state === "eat" && Number(v.hearts) === 3 && Number(v.streak) === 1, `state ${v.state}, hearts ${v.hearts}`);
});
