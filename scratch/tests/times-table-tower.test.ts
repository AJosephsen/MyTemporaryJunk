// Tests for Times Table Tower (maths stacking game).
import { test, type T } from "../workbench/testing.ts";

const GAME = "games/times-table-tower/times-table-tower.sb3";
const shot = (name: string) => `/tmp/claude-0/-home-user/af299c66-140a-5320-8b1f-a09d589ac156/scratchpad/${name}.png`;
const list = (t: T, name: string) => t.get(name) as Promise<any[]>;
const press = async (t: T) => { await t.hold("space"); await t.frames(1); await t.release("space"); };

async function startGame(t: T, compiler = true) {
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load(GAME); await t.greenFlag(); await t.frames(5);
  await press(t);
  await t.until(v => v.phase === "play" && v.state === "carry", { max: 90, what: "the first block" });
}
// Waits until the block shows the answer (right = true) or a wrong number, within `tol` of the tower top; then drops it.
async function dropWhen(t: T, right: boolean, tol = 6) {
  for (let i = 0; i < 1500; i++) {
    const v = await t.vars();
    if (v.state === "carry") {
      const shown = String((await list(t, "cand"))[Number(v.ci) - 1]);
      const xs = await list(t, "floor.x");
      const tx = xs.length ? Number(xs[xs.length - 1]) : 0;
      if ((shown === String(v.ans)) === right && Math.abs(Number(v.dropX) - tx) <= tol) {
        await press(t);
        await t.until(v => v.state !== "carry", { max: 5, what: "the block to leave the hook" });
        return { shown, ans: String(v.ans), dropX: Number(v.dropX), tx };
      }
    }
    await t.frames(1);
  }
  throw new Error("never the moment to drop");
}

test("times table tower: the title shows; a press starts level 1 with a question", async t => {
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
  await t.load(GAME); await t.greenFlag(); await t.frames(20);
  await t.screenshot(shot("ttt-title"));
  await press(t);
  const v = await t.until(v => v.phase === "play" && v.state === "carry", { max: 90, what: "play" });
  const cand = (await list(t, "cand")).map(String);
  t.expect(Number(v.level) === 1 && [2, 5, 10].includes(Number(v.qa)) && Number(v.ans) === Number(v.qa) * Number(v.qb), `question ${v.qa}×${v.qb}=${v.ans}`);
  t.expect(cand.length === 4 && new Set(cand).size === 4 && cand.indexOf(String(v.ans)) > 0, `candidates ${cand}`);
});

test("times table tower: right answers stack up; screenshot after a few floors", async t => {
  await startGame(t);
  for (let i = 0; i < 4; i++) {
    const before = (await list(t, "floor.x")).length;
    await dropWhen(t, true, 6);
    await t.until((v, w, m) => v.state !== "fall", { max: 120, what: "landing" });
    t.expect((await list(t, "floor.x")).length === before + 1, `floor ${i + 1} landed`);
  }
  await t.frames(30);
  const v = await t.vars();
  t.log({ score: v.score, mult: v.mult, perfects: v.perfects, w: await list(t, "floor.w") });
  t.expect(Number(v.score) > 0 && Number(v.mult) === 2, `score ${v.score}, mult ${v.mult}`);
  await t.screenshot(shot("ttt-play"));
});

test("times table tower: a wrong number smashes and costs a heart; three end the game", async t => {
  await startGame(t);
  for (let h = 2; h >= 0; h--) {
    await dropWhen(t, false, 200);
    await t.until(v => v.state !== "fall", { max: 120, what: "the smash" });
    const v = await t.vars();
    t.expect(Number(v.hearts) === h, `hearts ${v.hearts}, want ${h}`);
    t.expect((await list(t, "floor.x")).length === 0 && Number(v.streak) === 0, `no floor, streak ${v.streak}`);
  }
  await t.until(v => v.phase === "over", { max: 5, what: "game over" });
  await t.frames(20);
  await t.screenshot(shot("ttt-over"));
  await t.until(v => v.phase === "ready", { max: 200, what: "ready" });
  await press(t);
  const v = await t.until(v => v.phase === "play", { max: 10, what: "a new game" });
  t.expect(Number(v.hearts) === 3 && Number(v.score) === 0, `hearts ${v.hearts} score ${v.score}`);
});

test("times table tower: a level of floors gives a bonus, a new sky and the next tables", async t => {
  await startGame(t);
  const goal = Number(await t.get("goal"));
  for (let i = 0; i < goal; i++) await dropWhen(t, true, 6), await t.until(v => v.state !== "fall", { max: 120, what: "landing" });
  await t.until(v => v.phase === "bonus", { max: 10, what: "bonus" });
  const before = Number(await t.get("score"));
  await t.frames(50);
  await t.screenshot(shot("ttt-levelup"));
  const v = await t.until(v => v.phase === "play" && Number(v.level) === 2, { max: 400, what: "level 2" });
  const backdrop = await t.page(w => w.vm.runtime.getTargetForStage().getCostumes()[w.vm.runtime.getTargetForStage().currentCostume].name);
  t.expect(Number(v.score) >= before + 3 * 500 && backdrop === "sunset" && [3, 4, 2, 5].includes(Number(v.qa)),
    `score ${before} → ${v.score}, sky ${backdrop}, table ${v.qa}`);
});

for (const compiler of [true, false]) test(`times table tower: a tall tower scrolls; the ring shows the top floors with their answers (${compiler ? "compiled" : "interpreted"})`, async t => {
  await startGame(t, compiler);
  // Build 16 floors quickly: set up the tower directly, then land two real ones.
  await t.page(w => {
    const st = w.vm.runtime.getTargetForStage(), get = (n: string) => (Object.values(st.variables) as any[]).find((x: any) => x.name === n);
    get("floor.x").value = Array(14).fill(0); get("floor.w").value = Array(14).fill(120); get("floor.ans").value = Array(14).fill(0);
    get("goal").value = 99;
  });
  for (let i = 0; i < 2; i++) await dropWhen(t, true, 40), await t.until(v => v.state !== "fall", { max: 150, what: "landing" });
  await t.frames(60);
  const v = await t.vars();
  const rows = (await list(t, "ringRow")).map(Number), ys = (await list(t, "slotY")).map(Number);
  const top = rows.indexOf(16);
  t.expect(Number(v.cam) > 250 && top >= 0 && ys[top] > -40 && ys[top] < 60, `cam ${v.cam}, top floor at ${ys[top]}`);
  // Floors far below are not shown.
  t.expect(rows.every((r, j) => r === 0 || ys[j] > -200), `rows ${rows} ys ${ys.map(Math.round)}`);
  await t.screenshot(shot(`ttt-tall-${compiler}`));
});

test("times table tower: a very quick click (down and up between two frames) still counts", async t => {
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
  await t.load(GAME); await t.greenFlag(); await t.frames(10);
  await t.mouse(150, -60, true); await t.mouse(150, -60, false);      // on the sky, between frames
  await t.until(v => v.phase === "play", { max: 5, what: "a quick click to start the game" });
  await t.until(v => v.state === "carry", { max: 90, what: "the first block" });
  await t.mouse(0, 40, true); await t.mouse(0, 40, false);
  await t.until(v => v.state === "fall", { max: 5, what: "a quick click to drop" });
});
