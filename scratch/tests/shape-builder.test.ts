// Tests for Shape Builder (maths game: turn pieces to fit outlines; angles and symmetry).
import { test, type T } from "../workbench/testing.ts";

const GAME = "games/shape-builder/shape-builder.sb3";
const shot = (name: string) => `/tmp/claude-0/-home-user/af299c66-140a-5320-8b1f-a09d589ac156/scratchpad/${name}.png`;
const list = (t: T, name: string) => t.get(name) as Promise<any[]>;
const BTN_X = [-170, -85, 0, 85, 170, -110, 0, 110], BTN_Y = -158;
const mod = (a: number, n: number) => ((a % n) + n) % n;

async function startGame(t: T, compiler = true) {
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load(GAME); await t.greenFlag(); await t.frames(5);
  await t.hold("space"); await t.frames(1); await t.release("space");
  await t.until(v => v.phase === "play" && v.state === "turn", { max: 10, what: "the first piece" });
}
const press = async (t: T, b: number) => { await t.mouse(BTN_X[b - 1], BTN_Y); await t.click(BTN_X[b - 1], BTN_Y); await t.frames(2); };
// The current piece: its slot's angle, the piece's angle and the shape's symmetry.
async function piece(t: T) {
  const v = await t.vars();
  const i = Number(v.base) + Number(v.k) - 1;
  return { v, dir: Number((await list(t, "slot.dir"))[i]), pdir: Number(v.pdir), sym: Number(v.sym), state: String(v.state) };
}
// Turns the current piece the shortest way (with buttons), or picks the right angle call; then it drops.
async function solve(t: T, wrong = false) {
  const p = await piece(t);
  if (p.state === "call") {
    const c = [90, 180, 270].find(c => (mod(p.pdir + c - p.dir, p.sym) === 0) !== wrong)!;
    await press(t, 5 + c / 90);
  } else {
    if (!wrong) {
      let need = mod(p.dir - p.pdir, p.sym);
      if (need > p.sym / 2) need -= p.sym;
      const step = Number(p.v.step);
      while (need !== 0) {
        const s = Math.sign(need) * Math.min(Math.abs(need), step === 45 && Math.abs(need) % 90 ? 45 : 90);
        await press(t, s === 90 ? 5 : s === 45 ? 4 : s === -45 ? 2 : 1);
        need -= s;
      }
    } else if (mod(p.dir - p.pdir, p.sym) === 0) await press(t, 5);   // it already fits: turn it out first
    await press(t, 3);
  }
  // Wait until it has landed (and the next piece is up, or the picture is done).
  await t.until(v => v.state !== "drop" && v.state !== "spin", { max: 60, what: "the landing" });
}

test("shape builder: the title shows; a press starts level 1 with 90° buttons", async t => {
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
  await t.load(GAME); await t.greenFlag(); await t.frames(20);
  await t.screenshot(shot("sb-title"));
  await t.hold("space"); await t.frames(1); await t.release("space");
  await t.until(v => v.phase === "play" && v.state === "turn", { max: 10, what: "play" });
  const shown = (await list(t, "btnShow")).map(Number);
  t.expect(JSON.stringify(shown) === "[1,0,1,0,1,0,0,0]", `buttons ${shown}`);
  await t.frames(30);
  await t.screenshot(shot("sb-first"));
});

for (const compiler of [true, false]) test(`shape builder: turning the shortest way and dropping fits, with EXACT (${compiler ? "compiled" : "interpreted"})`, async t => {
  await startGame(t, compiler);
  const before = await piece(t);
  await solve(t);
  const v = await t.vars();
  t.expect(Number(v.k) === 2 && Number(v.hearts) === 3, `next piece ${v.k}, hearts ${v.hearts}`);
  // 100 for the piece, 150 for EXACT, 100 for QUICK.
  t.expect(Number(v.score) === 350, `score ${v.score} (piece turned from ${before.pdir} to ${before.dir}, sym ${before.sym})`);
});

test("shape builder: a wrong angle bounces back and costs a heart", async t => {
  await startGame(t);
  await solve(t, true);
  await t.until(v => v.state === "turn", { max: 30, what: "the bounce" });
  const v = await t.vars();
  t.expect(Number(v.hearts) === 2 && Number(v.k) === 1 && Number(v.streak) === 0, `hearts ${v.hearts}, piece ${v.k}`);
});

test("shape builder: a picture done gives PERFECT; two pictures make a level; level 2 turns in 45°", async t => {
  await startGame(t);
  let shotTaken = false;
  for (let i = 0; i < 40 && Number(await t.get("level")) === 1; i++) {
    const s = String(await t.get("state"));
    if (s === "turn" || s === "call") await solve(t);
    else {
      if (s === "done" && !shotTaken) { await t.frames(10); await t.screenshot(shot("sb-done")); shotTaken = true; }
      await t.frames(10);
    }
  }
  await t.until(v => v.phase === "play" && v.state === "turn" && Number(v.level) === 2, { max: 400, what: "level 2" });
  const v = await t.vars();
  t.expect(Number(v.step) === 45 && Number(v.pic) === 3 && Number(v.hearts) === 3, `step ${v.step}, picture ${v.pic}`);
  t.expect(Number(v.score) > 2 * 500 + 3 * 500, `score ${v.score}`);
  const shown = (await list(t, "btnShow")).map(Number);
  t.expect(JSON.stringify(shown) === "[1,1,1,1,1,0,0,0]", `buttons ${shown}`);
});

test("shape builder: level 3 is angle calls; a right call turns the piece and it fits", async t => {
  await startGame(t);
  for (let i = 0; i < 80 && Number(await t.get("level")) < 3; i++) {
    const s = String(await t.get("state"));
    if (s === "turn" || s === "call") await solve(t); else await t.frames(10);
  }
  await t.until(v => v.phase === "play" && v.state === "call", { max: 400, what: "level 3" });
  await t.frames(20);
  await t.screenshot(shot("sb-call"));
  const k = Number(await t.get("k"));
  await solve(t);
  t.expect(Number(await t.get("k")) === k + 1, `piece ${k} placed`);
  await solve(t, true);
  await t.until(v => v.state === "call", { max: 60, what: "back to the call" });
  t.expect(Number(await t.get("hearts")) === 2, `a wrong call costs a heart`);
});
