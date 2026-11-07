// Tests for Glimmer Pop: hex grid rules, popping, dropping, walls, ceiling, levels and game over.
import { test, type T, type Vars } from "../workbench/testing.ts";

const GAME = "games/glimmer-pop/glimmer-pop.sb3";
const idx = (row: number, col: number) => row * 8 + col + 1;

async function ready(t: T): Promise<Vars> {
  await t.load(GAME);
  await t.greenFlag();
  return t.until(v => v.state === "aim", { max: 200, what: "the first shot" });
}

// Replaces the board with the given cells ({ index: colour }) and sets the colour counts to match.
async function board(t: T, cells: Record<number, number>) {
  const grid = Array(112).fill(0), counts = Array(6).fill(0);
  for (const [i, c] of Object.entries(cells)) { grid[Number(i) - 1] = c; counts[c - 1]++; }
  await t.set("grid", grid);
  await t.set("colorCount", counts);
  await t.page(w => w.vm.runtime.startHats("event_whenbroadcastreceived", { BROADCAST_OPTION: "redraw" }));
}

// Aims at a Stage point with the mouse, fires with Space, and runs until the shot has been dealt with.
async function shoot(t: T, x: number, y: number, color: number): Promise<Vars> {
  await t.set("shotColor", color);
  await t.mouse(x, y);
  await t.frames(1);
  await t.hold("space"); await t.frames(1); await t.release("space");
  return t.until(v => v.state !== "fly", { max: 200, what: "the shot to land" });
}

const filled = (v: Vars) => v.grid.map(Number).map((c: number, i: number) => c ? i + 1 : 0).filter(Boolean);

test("glimmer pop: a new game fills a symmetric board and makes one clone per cell", async t => {
  const v = await ready(t);
  const g = v.grid.map(Number);
  for (let r = 0; r < 14; r++) for (let c = 0; c < 8; c++) {
    const mirror = (r % 2 ? 6 : 7) - c;
    if (mirror >= 0) t.expect(g[idx(r, c) - 1] === g[idx(r, mirror) - 1], `row ${r} is not symmetric`);
  }
  t.expect(g.slice(idx(5, 0) - 1).every((c: number) => c === 0), "level 1 fills 5 rows");
  t.expect(g.slice(0, 8).every((c: number) => c > 0), "the top row is full");
  const cells = await t.page(w => w.vm.runtime.targets.filter((x: any) => x.sprite.name === "Board" && !x.isOriginal).length);
  t.expect(cells === 112, `cell clones: ${cells}`);
});

test("glimmer pop: three of a colour pop, and a bubble left hanging falls", async t => {
  await ready(t);
  // A colour-2 anchor at the top; colour 1 hangs from it, with colour 3 and another colour 1 below.
  await board(t, { [idx(0, 3)]: 2, [idx(1, 3)]: 1, [idx(2, 3)]: 3, [idx(2, 4)]: 1 });
  const v = await shoot(t, 0, 100, 1);
  t.expect(v.landIdx === idx(3, 3), `the shot snapped to cell ${v.landIdx}, expected ${idx(3, 3)} (row 3, col 3)`);
  t.expect(v.popped === 3 && v.dropped === 1, `popped ${v.popped}, dropped ${v.dropped}`);
  t.expect(JSON.stringify(filled(v)) === JSON.stringify([idx(0, 3)]), `left on the board: ${filled(v)}`);
  t.expect(v.score === 3 * 10 + 20, `score ${v.score}`);
  t.expect(v.state === "aim", `state ${v.state}`);
});

test("glimmer pop: two of a colour stay on the board", async t => {
  await ready(t);
  await board(t, { [idx(0, 3)]: 2, [idx(0, 0)]: 3 });
  const v = await shoot(t, 0, 100, 2);
  t.expect(v.popped === 0 && filled(v).length === 3, `popped ${v.popped}, bubbles ${filled(v).length}`);
});

test("glimmer pop: clearing the board finishes the level and starts the next one", async t => {
  await ready(t);
  await board(t, { [idx(0, 3)]: 1, [idx(0, 4)]: 1 });
  const v = await shoot(t, 0, 100, 1);
  t.expect(v.state === "clear", `state ${v.state}`);
  t.expect(v.score === 30 + 500, `score with the clear bonus: ${v.score}`);
  const next = await t.until(v => v.state === "aim", { max: 300, what: "level 2" });
  t.expect(next.level === 2, `level ${next.level}`);
  t.expect(filled(next).length > 0, "level 2 has a new board");
});

test("glimmer pop: shots bounce off the side walls", async t => {
  await ready(t);
  await board(t, { [idx(0, 0)]: 2 });
  await t.set("shotColor", 1);
  await t.mouse(-200, -140);                 // far left: the aim stops at its limit
  await t.frames(1);
  t.expect((await t.get("aimDir")) === -78, `aim limit: ${await t.get("aimDir")}`);
  await t.hold("space"); await t.frames(1); await t.release("space");
  const v = await t.until((v, w) => {
    w.minX = Math.min(w.minX ?? 0, v.shotX);
    w.bounced = w.bounced || v.vx > 0;
    return v.state !== "fly";
  }, { max: 300 });
  const { minX, bounced } = await t.page(w => ({ minX: w.minX, bounced: w.bounced }));
  t.expect(bounced, "the shot turned at the left wall");
  t.expect(minX >= -91.001, `the shot stayed inside the wall: ${minX}`);
  t.expect(v.state === "aim", `state ${v.state}`);
});

test("glimmer pop: the ceiling comes down after the last shot of the countdown", async t => {
  await ready(t);
  await board(t, { [idx(0, 0)]: 2, [idx(0, 7)]: 2 });
  await t.set("shotsLeft", 1);
  const before = await t.get("topY");
  const v = await shoot(t, 0, 100, 1);
  t.expect(v.topY === before - 22.5, `topY ${v.topY}`);
  t.expect(v.shotsLeft === v.ceilingShots, `countdown restarted: ${v.shotsLeft} of ${v.ceilingShots}`);
  await t.frames(1);
  t.near((await t.sprite("Ceiling")).y, before - 22.5, 0.01, "ceiling bar position");
});

test("glimmer pop: a bubble below the danger line ends the game; Space starts a new one", async t => {
  await ready(t);
  await board(t, { [idx(0, 2)]: 2, [idx(1, 2)]: 3, [idx(2, 2)]: 2, [idx(3, 2)]: 3, [idx(4, 2)]: 2, [idx(5, 2)]: 3 });
  await t.set("topY", 168 - 22.5 * 7);    // the column now reaches past the danger line once it grows
  const v = await shoot(t, -45, 0, 1);
  t.expect(v.state === "over", `state ${v.state}`);
  await t.frames(20);
  t.expect((await t.sprite("Banner")).costume === "over", "game over banner");
  await t.hold("space"); await t.frames(1); await t.release("space");
  const again = await t.until(v => v.state === "aim", { max: 300, what: "a new game" });
  t.expect(again.level === 1 && again.score === 0, `new game: level ${again.level}, score ${again.score}`);
});

test("glimmer pop: the next bubble only uses colours still on the board", async t => {
  await ready(t);
  await board(t, { [idx(0, 0)]: 3, [idx(0, 7)]: 3, [idx(0, 3)]: 3 });
  const v = await shoot(t, 60, 100, 3);
  t.expect(v.shotColor === 3 && v.nextColor === 3, `shot ${v.shotColor}, next ${v.nextColor}`);
});

test("glimmer pop: a big drop stays well below the 300-clone limit", async t => {
  await ready(t);
  // A colour-1 pair holds up two tall stacks of colour 3, left and right, with a clear channel down the middle.
  const cells: Record<number, number> = { [idx(0, 3)]: 1, [idx(0, 4)]: 1, [idx(1, 2)]: 3, [idx(1, 4)]: 3 };
  for (let r = 2; r <= 8; r++) for (const c of r % 2 ? [0, 1, 5, 6] : [0, 1, 2, 5, 6, 7]) cells[idx(r, c)] = 3;
  await board(t, cells);
  const v = await shoot(t, 0, 100, 1);
  await t.frames(2);
  const clones = await t.page(w => w.vm.runtime.targets.filter((x: any) => !x.isOriginal).length);
  t.log({ popped: v.popped, dropped: v.dropped, clones });
  t.expect(v.popped === 3 && v.dropped === 38, `popped ${v.popped}, dropped ${v.dropped}`);
  t.expect(v.state === "clear", `state ${v.state}`);
  t.expect(clones < 300, `clones: ${clones}`);
});

test("glimmer pop: 80 random shots never get stuck", async t => {
  await ready(t);
  let seed = 3;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const seen = new Set<string>();
  for (let shot = 0; shot < 80; shot++) {
    const v0 = await t.until(v => v.state === "aim" || v.state === "over", { max: 400, what: `shot ${shot} to be ready` });
    if (v0.state === "over") { seen.add("over"); await t.hold("space"); await t.frames(1); await t.release("space"); continue; }
    await t.mouse(-220 + rand() * 440, -100 + rand() * 260);
    await t.frames(1);
    await t.hold("space"); await t.frames(1); await t.release("space");
    const v = await t.until(v => v.state !== "fly", { max: 300, what: `shot ${shot} to land` });
    seen.add(v.state);
  }
  const v = await t.vars();
  t.log({ states: [...seen], level: v.level, score: v.score });
  const clones = await t.page(w => w.vm.runtime.targets.filter((x: any) => !x.isOriginal).length);
  t.expect(clones < 300, `clones: ${clones}`);
});

test("glimmer pop: a quick click (down and up within one frame) aims and shoots", async t => {
  await ready(t);
  for (const [x, y] of [[0, 100], [-60, 140], [-150, 60]]) {   // empty sky, on a bubble, and outside the playfield
    await t.until(v => v.state === "aim", { max: 300 });
    await t.click(x, y);
    const v = await t.until(v => v.state === "fly" || v.state === "settle", { max: 3, what: `a shot after clicking ${x}, ${y}` });
    t.expect(Math.sign(v.aimDir) === Math.sign(x), `aim towards ${x}: ${v.aimDir}`);
  }
});

test("glimmer pop: the mouse leaving the Stage does not change the aim", async t => {
  await ready(t);
  await t.mouse(0, 100);
  await t.frames(1);
  await t.hold("right arrow"); await t.frames(10); await t.release("right arrow");
  const aimed = await t.get("aimDir");
  await t.mouse(-400, -300);                  // e.g. a finger on an on-screen button beside the Stage
  await t.frames(3);
  t.expect(aimed === 25, `aim after 10 frames of the right arrow: ${aimed}`);
  t.expect((await t.get("aimDir")) === aimed, `aim after the mouse left the Stage: ${await t.get("aimDir")}`);
});

test("glimmer pop: Space (and the Shoot button) fires in the current aim, without re-aiming at the mouse", async t => {
  await ready(t);
  await t.mouse(0, 100);                     // the mouse rests straight above the launcher
  await t.frames(1);
  await t.hold("left arrow"); await t.frames(12); await t.release("left arrow");
  const aimed = await t.get("aimDir");
  await t.hold("space"); await t.frames(1); await t.release("space");
  const v = await t.until(v => v.state === "fly", { max: 3 });
  t.expect(aimed === -30, `aim after 12 frames of the left arrow: ${aimed}`);
  t.expect(v.aimDir === aimed && v.vx < 0, `shot fired at ${v.aimDir}, vx ${v.vx}`);
});
