// Tests for Deep Dig. There is no world list: the tests read the mine from the clones' positions, and set up
// test mines by placing clones themselves (the same way "create clone" does).
import { test, type T } from "../workbench/testing.ts";

const GAME = "games/deep-dig/deep-dig.sb3";
const shot = (name: string) => `/tmp/claude-0/-home-user-MyTemporaryJunk/af299c66-140a-5320-8b1f-a09d589ac156/scratchpad/${name}.png`;
type Sq = [number, number];
type Mine = { Dirt: Sq[]; Rock: Sq[]; Gem: Sq[]; miner: Sq; ladder: Sq };

// The squares of all clones, by sprite. Columns 1..13 and rows 1..8 are inside the walls.
const read = (t: T) => t.page(w => {
  const sq = (x: number, y: number) => [Math.round((x + 224) / 32), Math.round((124 - y) / 32)];
  const out: any = { Dirt: [], Rock: [], Gem: [] };
  for (const c of w.vm.runtime.targets) if (!c.isOriginal && out[c.sprite.name] && c.visible) out[c.sprite.name].push(sq(c.x, c.y));
  const m = w.vm.runtime.getSpriteTargetByName("Miner"), l = w.vm.runtime.getSpriteTargetByName("Ladder");
  out.miner = sq(m.x, m.y); out.ladder = sq(l.x, l.y);
  return out;
}) as Promise<Mine>;
const has = (list: Sq[], c: number, r: number) => list.some(([a, b]) => a === c && b === r);

// A test mine: the miner and ladder where given, rocks and gems where given, no dirt on the `empty` squares,
// dirt everywhere else.
async function mine(t: T, o: { miner?: Sq; ladder?: Sq; rocks?: Sq[]; gems?: Sq[]; empty?: Sq[] }, compiler = true) {
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load(GAME); await t.greenFlag();
  await t.until(v => v.phase === "play", { max: 60, what: "the level to start" });
  await t.page((w, o) => {
    const rt = w.vm.runtime, pos = ([c, r]: number[]) => [-224 + 32 * c, 124 - 32 * r];
    for (const c of rt.targets.slice()) if (!c.isOriginal && ["Dirt", "Rock", "Gem"].includes(c.sprite.name)) { rt.stopForTarget(c); rt.disposeTarget(c); }
    const put = (name: string, sq: number[]) => {
      const orig = rt.getSpriteTargetByName(name), c = orig.makeClone();
      rt.addTarget(c); c.setXY(...pos(sq));
    };
    rt.getSpriteTargetByName("Miner").setXY(...pos(o.miner)); rt.getSpriteTargetByName("Ladder").setXY(...pos(o.ladder));
    const taken = [o.miner, o.ladder, ...o.rocks, ...o.gems, ...o.empty].map(String);
    for (const sq of o.rocks) put("Rock", sq);
    for (const sq of o.gems) put("Gem", sq);
    for (let r = 1; r <= 8; r++) for (let c = 1; c <= 13; c++) if (!taken.includes(String([c, r]))) put("Dirt", [c, r]);
  }, { miner: o.miner ?? [1, 1], ladder: o.ladder ?? [13, 8], rocks: o.rocks ?? [], gems: o.gems ?? [], empty: o.empty ?? [] });
  await t.frames(1);
}
const press = async (t: T, key: string, frames: number) => { await t.hold(key); await t.frames(frames); await t.release(key); await t.frames(4); };

test("deep dig: a new level has dirt, rocks, gems and a ladder, each on its own square", async t => {
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
  await t.load(GAME); await t.greenFlag();
  await t.until(v => v.phase === "play", { max: 60, what: "the level to start" });
  await t.frames(2);
  const m = await read(t);
  const all = [...m.Dirt, ...m.Rock, ...m.Gem, m.ladder].map(String);
  const kinds = [...m.Dirt.map(q => ["Dirt", q]), ...m.Rock.map(q => ["Rock", q]), ...m.Gem.map(q => ["Gem", q]), ["Ladder", m.ladder]] as [string, Sq][];
  const dup = kinds.filter(([, q], i) => kinds.findIndex(([, p]) => p.join() === q.join()) !== i).map(([k, q]) => `${k}@${q}`);
  t.log({ dirt: m.Dirt.length, rocks: m.Rock.length, gems: m.Gem.length, dup });
  t.expect(new Set(all).size === all.length, "two things on one square");
  t.expect(m.Rock.length >= 8 && m.Gem.length >= 6 && m.Dirt.length >= 60, "too few things");
  t.expect(!has(m.Dirt, 1, 1) && m.miner.join() === "1,1" && m.ladder[1] === 8, `miner ${m.miner}, ladder ${m.ladder}`);
  await t.screenshot(shot("deep-dig-start"));
});

test("deep dig: holding right digs a tunnel through dirt", async t => {
  await mine(t, {});
  await press(t, "right arrow", 20);
  const m = await read(t);
  t.expect(m.miner[0] >= 4 && m.miner[1] === 1, `miner at ${m.miner}`);
  t.expect(!has(m.Dirt, 2, 1) && !has(m.Dirt, 3, 1) && has(m.Dirt, 2, 2), "the tunnel is wrong");
});

test("deep dig: the walls and rocks block the miner", async t => {
  await mine(t, { rocks: [[2, 1]] });
  await press(t, "left arrow", 8); await press(t, "up arrow", 8); await press(t, "right arrow", 8);
  const m = await read(t);
  t.expect(m.miner.join() === "1,1", `miner at ${m.miner}`);
});

test("deep dig: digging into a gem collects it", async t => {
  await mine(t, { gems: [[2, 1]] });
  await press(t, "right arrow", 3);
  const m = await read(t), v = await t.vars();
  t.expect(Number(v.score) >= 10 && !has(m.Gem, 2, 1), `score ${v.score}`);
});

for (const compiler of [true, false]) test(`deep dig: a rock falls into empty squares below it (${compiler ? "compiled" : "interpreted"})`, async t => {
  await mine(t, { rocks: [[5, 2]], empty: [[5, 3], [5, 4]] }, compiler);
  await t.frames(25);
  const m = await read(t);
  t.expect(has(m.Rock, 5, 4) && !has(m.Rock, 5, 2), `rocks at ${JSON.stringify(m.Rock)}`);
});

for (const compiler of [true, false]) test(`deep dig: a falling rock that lands on the miner costs a life (${compiler ? "compiled" : "interpreted"})`, async t => {
  await mine(t, { miner: [3, 4], rocks: [[3, 1]], empty: [[3, 2], [3, 3]] }, compiler);
  const v = await t.until(v => v.phase === "ouch", { max: 40, what: "the rock to hit the miner" });
  t.expect(Number(v.lives) === 2, `lives ${v.lives}`);
});

test("deep dig: a rock resting on the miner's head is harmless", async t => {
  await mine(t, { miner: [3, 2], rocks: [[3, 1]] });
  await t.frames(40);
  const v = await t.vars();
  t.expect(v.phase === "play" && Number(v.lives) === 3, `phase ${v.phase}, lives ${v.lives}`);
});

for (const compiler of [true, false]) test(`deep dig: a rock on top of another rock rolls off to a free side (${compiler ? "compiled" : "interpreted"})`, async t => {
  await mine(t, { rocks: [[6, 3], [6, 4]], empty: [[5, 3], [5, 4], [5, 5]] }, compiler);
  await t.frames(30);
  const m = await read(t);
  t.expect(has(m.Rock, 5, 5) && has(m.Rock, 6, 4) && !has(m.Rock, 6, 3), `rocks at ${JSON.stringify(m.Rock)}`);
});

test("deep dig: the ladder leads one level deeper", async t => {
  await mine(t, { ladder: [2, 1] });
  await press(t, "right arrow", 3);
  const v = await t.until(v => v.phase === "play" && Number(v.level) === 2, { max: 60, what: "level 2" });
  t.expect(Number(v.depth) === 50, `depth ${v.depth}`);
});

test("deep dig: a short play session (picture)", async t => {
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
  await t.load(GAME); await t.greenFlag();
  await t.until(v => v.phase === "play", { max: 60 });
  for (const [k, n] of [["down arrow", 16], ["right arrow", 20], ["down arrow", 8], ["right arrow", 12]] as const) await press(t, k, n);
  await t.frames(8);
  await t.screenshot(shot("deep-dig-play"));
  t.log(await t.vars().then(v => ({ score: v.score, lives: v.lives, phase: v.phase })));
});
