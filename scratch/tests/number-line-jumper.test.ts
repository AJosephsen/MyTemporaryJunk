// Tests for Number Line Jumper (maths game: where does the frog land on the number line?).
import { test, type T } from "../workbench/testing.ts";

const GAME = "games/number-line-jumper/number-line-jumper.sb3";
const shot = (name: string) => `/tmp/claude-0/-home-user/af299c66-140a-5320-8b1f-a09d589ac156/scratchpad/${name}.png`;
const SP = 32, PAD_Y = -70;

async function startGame(t: T, compiler = true) {
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load(GAME); await t.greenFlag(); await t.frames(5);
  await t.mouse(0, 60); await t.click(0, 60);
  await t.until(v => v.phase === "play" && v.state === "ask", { max: 120, what: "the first question" });
}
// Waits for a question, then clicks the pad (the right one, or one next to it).
async function answer(t: T, right = true) {
  const v = await t.until(v => v.state === "ask", { max: 300, what: "a question" });
  await t.frames(5);
  const w = await t.vars();
  const idx = Number(w.target) + (right ? 0 : 1);
  const x = (idx - Number(w.cam)) * SP;
  await t.mouse(x, PAD_Y); await t.click(x, PAD_Y); await t.frames(2);
  return { card: String(v.card), from: Number(v.fi), target: Number(v.target), unit: Number(v.unit) };
}
const landed = (t: T) => t.until(v => v.state !== "hop", { max: 200, what: "the landing" });

test("number line jumper: the title shows; a click starts level 1 with a forward jump", async t => {
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
  await t.load(GAME); await t.greenFlag(); await t.frames(20);
  await t.screenshot(shot("nlj-title"));
  await t.mouse(0, 60); await t.click(0, 60);
  const v = await t.until(v => v.phase === "play" && v.state === "ask", { max: 120, what: "play" });
  t.expect(Number(v.target) > Number(v.fi) && /^\+[1-5]$/.test(String(v.card)), `card ${v.card}, ${v.fi} → ${v.target}`);
  await t.frames(20);
  await t.screenshot(shot("nlj-ask"));
});

for (const compiler of [true, false]) test(`number line jumper: the right pad: the frog hops there, counting, and scores (${compiler ? "compiled" : "interpreted"})`, async t => {
  await startGame(t, compiler);
  const q = await answer(t);
  t.expect((await t.get("state")) === "hop", "it hops");
  if (compiler) { await t.frames(12); await t.screenshot(shot("nlj-hop")); }
  await landed(t);
  const v = await t.vars();
  t.expect(Number(v.fi) === q.target && Number(v.score) >= 100 && Number(v.hearts) === 3, `frog at ${v.fi} (want ${q.target}), score ${v.score}`);
});

test("number line jumper: a wrong pad costs a heart, but the frog still hops to the right one", async t => {
  await startGame(t);
  const q = await answer(t, false);
  t.expect(Number(await t.get("hearts")) === 2, `hearts ${await t.get("hearts")}`);
  await t.frames(6);
  await t.screenshot(shot("nlj-wrong"));
  await landed(t);
  t.expect(Number(await t.get("fi")) === q.target, `frog at ${await t.get("fi")}, want ${q.target}`);
});

test("number line jumper: levels: back and forth, negatives, two jumps, 2s, 5s, 10s", async t => {
  await startGame(t);
  const seen: string[] = [];
  for (let level = 1; level <= 7; level++) {
    for (let i = 0; i < 8; i++) {
      const q = await answer(t);
      if (i === 0) seen.push(`${level}: ${q.from * q.unit} ${q.card} = ${q.target * q.unit}`);
      await landed(t);
      t.expect(Number(await t.get("fi")) === q.target, `level ${level}: frog at ${await t.get("fi")}, want ${q.target}`);
    }
    if (level < 7) {
      for (let f = 0; f < 50 && !((await t.get("phase")) === "play" && Number(await t.get("level")) === level + 1); f++) await t.frames(10);
      t.expect(Number(await t.get("level")) === level + 1, `level ${level + 1}`);
    }
    if (level === 3) { await t.frames(60); await t.screenshot(shot("nlj-level4")); }
  }
  t.log(seen);
  t.expect(seen[3].includes(" ") && seen[3].split(" ").length >= 5, `two jumps: ${seen[3]}`);
  await t.until(v => v.state === "ask", { max: 300, what: "a question" });
  await t.frames(20);
  await t.screenshot(shot("nlj-level7"));
});

test("number line jumper: running out of time costs a heart; the frog goes to the right pad", async t => {
  await startGame(t);
  const v0 = await t.vars();
  await t.until(v => Number(v.hearts) === 2, { max: 400, what: "time to run out" });
  await landed(t);
  t.expect(Number(await t.get("fi")) === Number(v0.target), `frog at ${await t.get("fi")}`);
});
