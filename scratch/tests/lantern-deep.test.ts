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

const setSquare = (t: T, row: number, col: number, kind: number, hp: number) => t.page((w, a) => {
  const c = w.vm.runtime.targets.find((c: any) => !c.isOriginal && c.sprite.name === "Square" &&
    Number((Object.values(c.variables) as any[]).find((x: any) => x.name === "row").value) === a.row &&
    Number((Object.values(c.variables) as any[]).find((x: any) => x.name === "col").value) === a.col);
  for (const x of Object.values(c.variables) as any[]) { if (x.name === "kind") x.value = a.kind; if (x.name === "hp") x.value = a.hp; }
}, { row, col, kind, hp });

test("lantern deep: U buys a better pickaxe when there are enough coins", async t => {
  await start(t);
  await t.set("coins", 50);
  await t.frames(2);
  t.expect(String((await t.page(w => w.sprite("Miner"))).bubble).includes("40 coins"), "no upgrade hint");
  await press(t, "u", 2);
  const v = await t.vars();
  t.expect(Number(v.pickLevel) === 2 && Number(v.power) === 2 && Number(v.coins) === 10 && Number(v.cost) === 150,
    `level ${v.pickLevel}, power ${v.power}, coins ${v.coins}, cost ${v.cost}`);
  t.expect(v.pickaxe === "stone", `pickaxe ${v.pickaxe}`);
});

test("lantern deep: digging into lava costs a heart, and lava stays", async t => {
  await start(t);
  await setSquare(t, 1, 7, 11, 9999);
  await press(t, "down arrow", 2);
  const v = await t.vars();
  t.expect(Number(v.hearts) === 2 && Number(v.mrow) === 0 && Number(v.safe) > 0, `hearts ${v.hearts}, row ${v.mrow}`);
});

test("lantern deep: a crawler walks in its cave and hurts the miner; three hurts end the game", async t => {
  await start(t);
  await t.set("power", 8);             // a strong pick, so the tunnel is quick
  await press(t, "right arrow", 60);   // a tunnel from column 7 to the right
  const col = Number(await t.get("mcol"));
  t.expect(col >= 11, `tunnel only to column ${col}`);
  await t.set("power", 1);
  await press(t, "left arrow", 12);    // walk back towards the start
  await t.set("crawlRow", 0); await t.set("crawlCol", col);
  await t.page(w => w.vm.runtime.startHats("event_whenbroadcastreceived", { BROADCAST_OPTION: "crawler" }));
  let v = await t.until(v => Number(v.hearts) === 2, { max: 200, what: "the crawler to reach the miner" });
  await t.screenshot(shot("lantern-crawler"));
  await t.set("hearts", 1);
  v = await t.until(v => v.phase === "over", { max: 200, what: "game over" });
  t.expect(Number(v.hearts) === 0, `hearts ${v.hearts}`);
});

test("lantern deep: deeper down there are caves with crawlers, and lava", async t => {
  await start(t);
  let crawlers = 0, lava = 0;
  for (let row = 30; row <= 120; row += 9) {   // jump down 9 rows at a time (rows above are not needed)
    await t.set("mrow", row); await t.set("mcol", 7); await t.set("lastRow", row - 1);
    await t.frames(3);
    crawlers += await t.page(w => w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === "Crawler" && c.visible).length);
    lava += (await squares(t)).filter(q => q.kind === 11).length;
  }
  t.log({ crawlers, lava });
  t.expect(crawlers > 2, "too few crawlers");
  t.expect(lava > 5, "too little lava");
});

test("lantern deep: a deep dig (picture)", async t => {
  await start(t);
  await t.set("mrow", 70); await t.set("mcol", 7); await t.set("lastRow", 69); await t.set("power", 8); await t.set("pickLevel", 4);
  await t.frames(5);
  for (const [k, n] of [["down arrow", 30], ["left arrow", 30], ["down arrow", 20], ["right arrow", 50]] as const) await press(t, k, n);
  await t.frames(10);
  await t.screenshot(shot("lantern-deep-down"));
  t.log(await t.vars().then(v => ({ coins: v.coins, hearts: v.hearts, mrow: v.mrow })));
});
