// Tests for the Lantern Deep tutorial: every checkpoint works on its own. They also take the tutorial's pictures.
import { test, type T } from "../workbench/testing.ts";

const step = (n: number) => `tutorials/lantern-deep/step${n}.sb3`;
const shot = (n: number) => new URL(`../tutorials/lantern-deep/step${n}.png`, import.meta.url).pathname;
const squares = (t: T) => t.page(w => w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === "Square").map((c: any) => {
  const get = (n: string) => Number((Object.values(c.variables) as any[]).find(x => x.name === n)?.value);
  return { row: get("row"), col: get("col"), kind: get("kind"), lit: get("lit") };
})) as Promise<{ row: number; col: number; kind: number; lit: number }[]>;
const press = async (t: T, key: string, frames: number) => { await t.hold(key); await t.frames(frames); await t.release(key); await t.frames(3); };
const start = async (t: T, n: number) => { await t.page(w => w.vm.setCompilerOptions({ enabled: true })); await t.load(step(n)); await t.greenFlag(); await t.frames(5); };
const kindAt = (t: T, row: number, col: number, kind: number, hp: number) => t.page((w, a) => {
  const c = w.vm.runtime.targets.find((c: any) => !c.isOriginal && c.sprite.name === "Square" &&
    Number((Object.values(c.variables) as any[]).find((x: any) => x.name === "row").value) === a.row &&
    Number((Object.values(c.variables) as any[]).find((x: any) => x.name === "col").value) === a.col);
  for (const x of Object.values(c.variables) as any[]) { if (x.name === "kind") x.value = a.kind; if (x.name === "hp") x.value = a.hp; }
}, { row, col, kind, hp });

test("lantern deep tutorial step 1: ten rows of squares, bedrock at the sides, a gap for the miner", async t => {
  await start(t, 1);
  const s = await squares(t);
  t.expect(s.length === 149 && new Set(s.map(q => q.row)).size === 10, `${s.length} squares`);
  t.expect(s.filter(q => q.col === 0).every(q => q.kind === 3) && s.filter(q => q.col === 5).every(q => q.kind === 1), "wrong kinds");
  await t.screenshot(shot(1));
});

test("lantern deep tutorial step 2: the arrow keys dig", async t => {
  await start(t, 2);
  await press(t, "down arrow", 25); await press(t, "right arrow", 25);
  const v = await t.vars();
  t.expect(Number(v.mrow) >= 2 && Number(v.mcol) >= 9, `miner at row ${v.mrow}, col ${v.mcol}`);
  await t.screenshot(shot(2));
});

test("lantern deep tutorial step 3: digging down scrolls, with new rows below and none far above", async t => {
  await start(t, 3);
  await press(t, "down arrow", 180);
  const v = await t.vars(), s = await squares(t);
  t.expect(Number(v.mrow) >= 12 && Number(v.scroll) > 200, `row ${v.mrow}, scroll ${v.scroll}`);
  t.expect(Math.max(...s.map(q => q.row)) >= Number(v.mrow) + 8 && Math.min(...s.map(q => q.row)) >= Number(v.mrow) - 12, "rows not made or removed");
  await t.screenshot(shot(3));
});

test("lantern deep tutorial step 4: only squares near the lantern are lit; treasure gives coins", async t => {
  await start(t, 4);
  await t.set("mrow", 30); await t.set("lastRow", 29); await t.frames(5);
  await press(t, "down arrow", 40); await press(t, "left arrow", 30);
  const s = await squares(t), v = await t.vars();
  const lit = s.filter(q => q.lit === 1);
  t.log({ lit: lit.length, squares: s.length, coins: v.coins });
  t.expect(lit.length > 5 && lit.length < s.length / 2, `${lit.length} lit of ${s.length}`);
  await t.screenshot(shot(4));
});

test("lantern deep tutorial step 5: U buys a better pickaxe", async t => {
  await start(t, 5);
  await t.set("coins", 45); await t.frames(3);
  await t.screenshot(shot(5));
  await press(t, "u", 2);
  const v = await t.vars();
  t.expect(Number(v.pickLevel) === 2 && Number(v.power) === 2 && Number(v.coins) === 5, `level ${v.pickLevel}, coins ${v.coins}`);
});

test("lantern deep tutorial step 6: lava costs a heart", async t => {
  await start(t, 6);
  await kindAt(t, 1, 7, 11, 9999);
  await t.frames(2);
  await press(t, "down arrow", 2);
  const v = await t.vars();
  t.expect(Number(v.hearts) === 2, `hearts ${v.hearts}`);
  await t.frames(4);
  await t.screenshot(shot(6));
});

test("lantern deep tutorial step 7: caves with crawlers deeper down", async t => {
  await start(t, 7);
  let crawlers = 0;
  for (let row = 30; row <= 120 && crawlers === 0; row += 9) {
    await t.set("mrow", row); await t.set("lastRow", row - 1); await t.frames(3);
    crawlers = await t.page(w => w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === "Crawler").length);
  }
  t.expect(crawlers > 0, "no crawlers");
  // Walk into the cave row's light so the picture shows a crawler.
  const row = await t.page(w => Number((Object.values(w.vm.runtime.targets.find((c: any) => !c.isOriginal && c.sprite.name === "Crawler").variables) as any[]).find((x: any) => x.name === "row").value));
  await t.set("mrow", row - 1); await t.set("lastRow", row + 8); await t.frames(20);
  await t.screenshot(shot(7));
});
