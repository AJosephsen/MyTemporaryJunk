// Tests for Lantern Deep.
import { test, type T } from "../workbench/testing.ts";

const GAME = "games/lantern-deep/lantern-deep.sb3";
const shot = (name: string) => `/tmp/claude-0/-home-user-MyTemporaryJunk/af299c66-140a-5320-8b1f-a09d589ac156/scratchpad/${name}.png`;
// All square clones: row, col, kind, hp, lit.
const squares = (t: T) => t.page(w => w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === "Square").map((c: any) => {
  const get = (n: string) => Number((Object.values(c.variables) as any[]).find(x => x.name === n).value);
  return { row: get("row"), col: get("col"), kind: get("kind"), hp: get("hp"), lit: get("lit"), y: c.y };
})) as Promise<{ row: number; col: number; kind: number; hp: number; lit: number; y: number }[]>;
const press = async (t: T, key: string, frames: number) => { await t.hold(key); await t.frames(frames); await t.release(key); await t.frames(3); };
async function start(t: T) {
  await t.load(GAME); await t.greenFlag(); await t.frames(5);
}

test("lantern deep: the mine is made row by row, dark except near the lantern", async t => {
  await start(t);
  const s = await squares(t);
  const rows = new Set(s.map(q => q.row));
  t.expect(rows.size === 10 && Math.max(...rows) === 9, `rows ${[...rows]}`);
  t.expect(!s.some(q => q.row === 0 && q.col === 7), "the start square is not empty");
  const lit = s.filter(q => q.lit === 1);
  t.log({ squares: s.length, lit: lit.length });
  t.expect(lit.length > 2 && lit.every(q => Math.abs(q.col - 7) <= 3 && q.row <= 3), `lit: ${JSON.stringify(lit.map(q => [q.col, q.row]))}`);
  t.expect(s.filter(q => q.col === 0 || q.col === 14).every(q => q.kind === 3), "the edges are not bedrock");
  await t.screenshot(shot("lantern-start"));
});

test("lantern deep: digging down breaks squares, collects coins, and the view follows", async t => {
  await start(t);
  await press(t, "down arrow", 200);
  const v = await t.vars(), s = await squares(t);
  t.log({ mrow: v.mrow, coins: v.coins, scroll: v.scroll, squares: s.length });
  t.expect(Number(v.mrow) >= 10, `only ${v.mrow} rows deep`);
  t.expect(Number(v.scroll) > 300, `scroll ${v.scroll}`);
  t.expect(Math.max(...s.map(q => q.row)) >= Number(v.mrow) + 8, "no new rows below");
  t.expect(Math.min(...s.map(q => q.row)) >= Number(v.mrow) - 12, "rows far above were not removed");
  t.expect(s.length < 300, `${s.length} clones`);
  await t.screenshot(shot("lantern-down"));
});

test("lantern deep: stone takes three hits with the first pick", async t => {
  await start(t);
  await t.page(w => {
    const c = w.vm.runtime.targets.find((c: any) => !c.isOriginal && c.sprite.name === "Square" &&
      (Object.values(c.variables) as any[]).find((x: any) => x.name === "row").value === 1 &&
      (Object.values(c.variables) as any[]).find((x: any) => x.name === "col").value === 7);
    for (const x of Object.values(c.variables) as any[]) { if (x.name === "kind") x.value = 2; if (x.name === "hp") x.value = 3; }
  });
  await press(t, "down arrow", 1); await t.frames(6);
  let v = await t.vars();
  t.expect(Number(v.mrow) === 0, "broke stone in one hit");
  await press(t, "down arrow", 30);
  v = await t.vars();
  t.expect(Number(v.mrow) >= 1, `still at row ${v.mrow}`);
});
