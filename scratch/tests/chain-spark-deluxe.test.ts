// Tests for Chain Spark Deluxe (fireworks puzzle: build, test, reset, go).
import { test, type T } from "../workbench/testing.ts";

const GAME = "games/chain-spark-deluxe/chain-spark-deluxe.sb3";
const shot = (name: string) => `/tmp/claude-0/-home-user/af299c66-140a-5320-8b1f-a09d589ac156/scratchpad/${name}.png`;
const list = (t: T, name: string) => t.get(name) as Promise<any[]>;
const SLOT_X = [-205, -145, -85, -25, 35, 95], TRAY_Y = -160, BUTTON_X = [150, 208];
const KIND = { rocket: 0, shell: 1, fountain: 2 };

async function startGame(t: T, compiler = true) {
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load(GAME); await t.greenFlag(); await t.frames(5);
  await t.mouse(0, 0, true); await t.frames(1); await t.mouse(0, 0, false);
  await t.until(v => v.phase === "build", { max: 10, what: "build" });
}
// Press at (x1, y1), move to (x2, y2) while held, let go: a drag (or a click if it does not move).
async function drag(t: T, x1: number, y1: number, x2: number, y2: number) {
  await t.mouse(x1, y1, true); await t.frames(2);
  for (let i = 1; i <= 5; i++) { await t.mouse(x1 + (x2 - x1) * i / 5, y1 + (y2 - y1) * i / 5, true); await t.frames(1); }
  await t.mouse(x2, y2, false); await t.frames(2);
}
const click = async (t: T, x: number, y: number) => { await t.mouse(x, y, true); await t.mouse(x, y, false); await t.frames(3); };
const place = async (t: T, kind: number, x: number, y: number) => drag(t, SLOT_X[kind], TRAY_Y, x, y);
async function placed(t: T) {
  const [on, kind, x, y, dir] = await Promise.all(["on", "kind", "x", "y", "dir"].map(f => list(t, `fw.${f}`)));
  return on.map((o, i) => ({ i, on: Number(o), kind: Number(kind[i]), x: Number(x[i]), y: Number(y[i]), dir: Number(dir[i]) })).filter(f => f.on === 1);
}
// Sets the level before the title click starts it.
const setLevel = (t: T, n: number) => t.page((w, n) => { for (const x of Object.values(w.vm.runtime.getTargetForStage().variables) as any[]) if (x.name === "level") x.value = n; }, n);
const waitPhase = (t: T, max = 900) => t.until(v => v.phase !== "test" && v.phase !== "go", { max, what: "the show to end" });

test("chain spark deluxe: the title; a click opens level 1 with its tray", async t => {
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
  await t.load(GAME); await t.greenFlag(); await t.frames(20);
  await t.screenshot(shot("csd-title"));
  await t.mouse(0, 0, true); await t.frames(1); await t.mouse(0, 0, false);
  await t.until(v => v.phase === "build", { max: 10, what: "build" });
  t.expect(JSON.stringify((await list(t, "inv")).map(Number)) === "[2,3,1,0,0,0]", `tray ${await list(t, "inv")}`);
});

test("chain spark deluxe: build: drag from the tray, click to turn, drag back to the tray", async t => {
  await startGame(t);
  await place(t, KIND.shell, -60, 40);
  let p = await placed(t);
  t.expect(p.length === 1 && p[0].kind === 2 && Math.abs(p[0].x + 60) < 1 && Math.abs(p[0].y - 40) < 1, `placed ${JSON.stringify(p)}`);
  t.expect(Number((await list(t, "inv"))[1]) === 2, "one shell fewer in the tray");
  await place(t, KIND.rocket, -150, -60);
  await click(t, -150, -60); await click(t, -150, -60);
  p = await placed(t);
  t.expect(p.find(f => f.kind === 1)!.dir === 90, `the rocket turned twice: ${p.find(f => f.kind === 1)!.dir}`);
  // Move the shell, then put it back in the box.
  await drag(t, -60, 40, 30, 70);
  t.expect((await placed(t)).some(f => f.kind === 2 && Math.abs(f.x - 30) < 1), "moved");
  await drag(t, 30, 70, 0, -160);
  t.expect((await placed(t)).length === 1 && Number((await list(t, "inv"))[1]) === 3, "back in the tray");
  await t.screenshot(shot("csd-build"));
});

for (const compiler of [true, false]) test(`chain spark deluxe: TEST runs the show; RESET puts everything back exactly (${compiler ? "compiled" : "interpreted"})`, async t => {
  await startGame(t, compiler);
  // The fuse is at (-200, -100): a fountain right above it, pointing right, sprays at a rocket; shells beyond.
  await place(t, KIND.fountain, -195, -75); await click(t, -195, -75); await click(t, -195, -75);
  await place(t, KIND.rocket, -120, -70);
  await place(t, KIND.shell, -120, 40); await place(t, KIND.shell, -40, 70); await place(t, KIND.shell, 40, 40);
  const before = await placed(t);
  await click(t, BUTTON_X[0], TRAY_Y);
  t.expect((await t.get("phase")) === "test", "TEST");
  if (compiler) { await t.frames(60); await t.screenshot(shot("csd-test")); }
  const v = await waitPhase(t);
  t.log({ phase: v.phase, score: v.score, lit: v.lit, placed: v.placed });
  t.expect(v.phase === "tested" && Number(v.score) > 0 && Number(v.lit) >= 3, `tested: score ${v.score}, lit ${v.lit}`);
  await click(t, BUTTON_X[0], TRAY_Y);   // RESET
  const after = await placed(t);
  t.expect((await t.get("phase")) === "build" && JSON.stringify(after) === JSON.stringify(before), "everything back where it was");
  t.expect(Number(await t.get("score")) === 0 && (await list(t, "fw.st")).map(Number).every(s => s === 0), "and ready again");
});

test("chain spark deluxe: GO for real: too little is TRY AGAIN (the layout stays); enough is WELL DONE", async t => {
  await startGame(t);
  // Only one shell near the fuse: a short show.
  await place(t, KIND.shell, -190, -70);
  await click(t, BUTTON_X[1], TRAY_Y);
  await waitPhase(t);
  await t.frames(10);
  await t.screenshot(shot("csd-tryagain"));
  await t.until(v => v.phase === "build", { max: 200, what: "back to building" });
  t.expect((await placed(t)).length === 1, "the layout stays after TRY AGAIN");
  // Now a long chain with everything.
  await place(t, KIND.fountain, -170, -50); await click(t, -170, -50); await click(t, -170, -50);
  await place(t, KIND.rocket, -100, -50);
  await place(t, KIND.rocket, -110, 30); await click(t, -110, 30); await click(t, -110, 30);
  await place(t, KIND.shell, -30, 60); await place(t, KIND.shell, 60, 30);
  await click(t, BUTTON_X[1], TRAY_Y);
  const v = await waitPhase(t, 1200);
  t.log({ score: v.score, target: v.target, lit: v.lit, placed: v.placed });
  t.expect(Number(v.score) >= Number(v.target), `score ${v.score} for target ${v.target}`);
  // All six went off: the finale lights up the sky. Then the stars (score / target: 1, 1.25, 1.5).
  t.expect(Number(v.lit) === Number(v.placed) && Number(v.flash) > 20, `finale flash ${v.flash}`);
  await t.frames(20);
  await t.screenshot(shot("csd-welldone"));
  const ratio = Number(v.score) / Number(v.target), want = ratio >= 1.5 ? 3 : ratio >= 1.25 ? 2 : 1;
  t.expect(Number((await list(t, "lvStars"))[0]) === want, `stars ${(await list(t, "lvStars"))[0]}, want ${want} for ${ratio.toFixed(2)}`);
  await t.until(v => v.phase === "build" && Number(v.level) === 2, { max: 200, what: "level 2" });
  await t.frames(3);
  await t.screenshot(shot("csd-next"));
});

// A simple chain for any level: from the fuse, fireworks about 60 px apart in a zigzag across the sky; fountains and
// rockets turned (in 45° clicks) towards the next one. Returns the TEST score.
const ORDER = [2, 1, 3, 4, 5, 0];   // fountain, shell, crossette, willow, spinner, rocket (tray index)
async function simpleChain(t: T) {
  const v = await t.vars();
  const fx = Number(v.fuseX), fy = Number(v.fuseY), inv = (await list(t, "inv")).map(Number);
  const kinds: number[] = []; const left = [...inv];
  while (left.some(n => n > 0)) for (const k of ORDER) if (left[k] > 0) { kinds.push(k); left[k]--; }
  const dx = fx > 50 ? -1 : 1;
  const pts = kinds.map((_, i) => {
    let x = fx + dx * (i === 0 ? 6 : 20 + i * 52), y = Math.max(-105, Math.min(140, fy + (i === 0 ? 32 : 30 + (i % 2 ? 40 : -20))));
    if (Math.abs(x) > 215) { x = Math.sign(x) * 215; }
    return [x, y];
  });
  for (let i = 0; i < kinds.length; i++) {
    const [x, y] = pts[i];
    await place(t, kinds[i], x, y);
    if (kinds[i] === 2 || kinds[i] === 0) {
      const [nx, ny] = pts[Math.min(i + 1, pts.length - 1)];
      const dir = ((Math.atan2(nx - x, ny - y) * 180 / Math.PI) + 360) % 360;
      for (let c = 0; c < Math.round(dir / 45) % 8; c++) await click(t, x, y);
    }
  }
  return kinds.length;
}

test("chain spark deluxe: every level can be beaten with a simple chain (and the new kinds go off)", async t => {
  const results: any[] = [];
  for (let level = 1; level <= 5; level++) {
    await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), true);
    await t.load(GAME); await t.greenFlag(); await t.frames(5);
    await setLevel(t, level);
    await t.mouse(0, 0, true); await t.frames(1); await t.mouse(0, 0, false);
    await t.until(v => v.phase === "build", { max: 10, what: "build" });
    if (level === 2) { await t.frames(5); await t.screenshot(shot("csd-level2")); }
    const n = await simpleChain(t);
    await click(t, BUTTON_X[0], TRAY_Y);
    let mid = false;
    for (let f = 0; f < 150 && (await t.get("phase")) === "test"; f++) {
      await t.frames(8);
      if (!mid && level >= 3 && Number(await t.get("lit")) >= Math.min(n, 4)) { await t.screenshot(shot(`csd-show${level}`)); mid = true; }
    }
    const v = await t.vars();
    results.push({ level, placed: n, lit: Number(v.lit), score: Number(v.score), target: Number(v.target) });
  }
  t.log(results);
  for (const r of results) t.expect(r.score >= r.target, `level ${r.level}: ${r.score} for ${r.target} (${r.lit}/${r.placed} lit)`);
});
