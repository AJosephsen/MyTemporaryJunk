// Tests for the Maze Maker tutorial: the maze is read back from the screen (pen layer) as sand or soil.
import { test, type T } from "../workbench/testing.ts";

const COLS = 12, ROWS = 9, CELL = 34, X0 = -187, Y0 = 136;
const step = (n: number) => `tutorials/maze-maker/step${n}.sb3`;
// The tests also take the tutorial's pictures.
const shot = (n: number) => new URL(`../tutorials/maze-maker/step${n}.png`, import.meta.url).pathname;

// Which of the given Stage points are sand? Hides the digger, draws, and reads the pixels.
const sandAt = (t: T, points: [number, number][]) => t.page((w, pts) => {
  const r = w.vm.renderer, gl = r.gl, digger = w.vm.runtime.getSpriteTargetByName("Digger");
  const was = digger.visible; digger.setVisible(false); r.draw();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(4);
  const out = pts.map(([x, y]: [number, number]) => {
    gl.readPixels(Math.round((x + 240) / 480 * W), Math.round((y + 180) / 360 * H), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return Math.abs(px[0] - 242) + Math.abs(px[1] - 213) + Math.abs(px[2] - 140) < 40;
  });
  digger.setVisible(was);
  return out;
}, points) as Promise<boolean[]>;

// Counts dug cells and open passages between neighbouring cells.
async function readMaze(t: T) {
  const cells: [number, number][] = [], passages: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = X0 + c * CELL, y = Y0 - r * CELL;
    cells.push([x, y]);
    if (c < COLS - 1) passages.push([x + CELL / 2, y]);
    if (r < ROWS - 1) passages.push([x, y - CELL / 2]);
  }
  const dug = (await sandAt(t, cells)).filter(Boolean).length;
  const open = (await sandAt(t, passages)).filter(Boolean).length;
  return { dug, open };
}

test("maze maker step 1: the digger draws tunnels", async t => {
  await t.load(step(1)); await t.greenFlag(); await t.frames(90);
  await t.screenshot(shot(1));
  const { dug } = await readMaze(t);
  t.expect(dug >= 3, `dug ${dug} cells`);
});

test("maze maker step 2: peeking first, the tunnel never runs into itself", async t => {
  await t.load(step(2)); await t.greenFlag(); await t.frames(200);
  await t.screenshot(shot(2));
  const { dug, open } = await readMaze(t);
  t.log({ dug, open });
  t.expect(dug > 5 && open === dug - 1, `dug ${dug}, open ${open}`);
  t.expect(dug < COLS * ROWS, "the walk alone should get stuck before the maze is complete");
});

for (const compiler of [true, false]) {
  test(`maze maker step 3: recursion completes a perfect maze, one step at a time (${compiler ? "compiled" : "interpreted, like scratch.mit.edu"})`, async t => {
    await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
    await t.load(step(3)); await t.greenFlag();
    await t.frames(30);
    const early = await readMaze(t);
    if (compiler) { await t.frames(60); await t.screenshot(shot(3)); }
    let frames = compiler ? 91 : 30;
    while (await t.page(w => w.vm.runtime.threads.length > 0) && frames < 3000) { await t.frames(10); frames += 10; }
    const { dug, open } = await readMaze(t);
    t.log({ dugAfter30Frames: early.dug, framesToFinish: frames });
    await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
    t.expect(early.dug < 40, `already ${early.dug} cells after 30 frames`);
    t.expect(dug === COLS * ROWS && open === COLS * ROWS - 1, `dug ${dug}, open ${open}`);
  });
}

test("maze maker step 4: run without screen refresh builds perfect mazes in one frame", async t => {
  await t.load(step(4));
  for (let i = 0; i < 3; i++) {
    await t.greenFlag(); await t.frames(1);
    const { dug, open } = await readMaze(t);
    t.expect(dug === COLS * ROWS && open === COLS * ROWS - 1, `maze ${i}: dug ${dug}, open ${open}`);
  }
  await t.screenshot(shot(4));
});
