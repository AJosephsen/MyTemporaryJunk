// Tests for Starfire Rush (vertical shoot 'em up).
import { test, type T } from "../workbench/testing.ts";

const GAME = "games/starfire-rush/starfire-rush.sb3";
const shot = (name: string) => `/tmp/claude-0/-home-user/af299c66-140a-5320-8b1f-a09d589ac156/scratchpad/${name}.png`;
const list = (t: T, name: string) => t.get(name) as Promise<any[]>;
const setVar = (t: T, name: string, value: any) => t.page((w, [n, x]) => {
  for (const v of Object.values(w.vm.runtime.getTargetForStage().variables) as any[]) if (v.name === n) v.value = x; }, [name, value]);

async function startGame(t: T, compiler = true) {
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load(GAME); await t.greenFlag(); await t.frames(5);
  await t.mouse(0, -120); await t.click(0, -120);
  await t.until(v => v.phase === "play", { max: 10, what: "play" });
}
// Steers the ship under the lowest enemy for n frames (an autopilot, so tests can play).
async function autopilot(t: T, n: number) {
  for (let f = 0; f < n; f += 3) {
    const [on, xs, ys] = await Promise.all(["en.on", "en.x", "en.y"].map(l => list(t, l)));
    let best = -1;
    for (let i = 0; i < on.length; i++) if (Number(on[i]) === 1 && Number(ys[i]) < 175 && (best < 0 || Number(ys[i]) < Number(ys[best]))) best = i;
    await t.mouse(best >= 0 ? Number(xs[best]) : 0, -130);
    await t.frames(3);
  }
}

test("starfire rush: the title shows; a click starts wave 1 and the ship fires on its own", async t => {
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
  await t.load(GAME); await t.greenFlag(); await t.frames(20);
  await t.screenshot(shot("sfr-title"));
  await t.mouse(0, -120); await t.click(0, -120);
  await t.until(v => v.phase === "play", { max: 10, what: "play" });
  await t.frames(20);
  const shots = (await list(t, "pb.on")).map(Number).reduce((a, b) => a + b);
  t.expect(Number(await t.get("wave")) === 1 && shots > 0, `wave ${await t.get("wave")}, ${shots} shots in the air`);
});

test("starfire rush: the ship shoots down wave 1 and scores", async t => {
  await startGame(t);
  await autopilot(t, 240);
  const v = await t.vars();
  t.log({ score: v.score, wave: v.wave, hp: v.hp, gun: v.gun, chain: v.chain });
  t.expect(Number(v.score) > 0, `score ${v.score}`);
  await t.screenshot(shot("sfr-wave1"));
});

// Holds the wave where it is: no new groups, no wave clear, no power cluster.
const holdWave = async (t: T) => { await setVar(t, "groupsLeft", 99); await setVar(t, "spawnT", 99999); await setVar(t, "clusterAt", -1); };
// Puts something into a pool row directly (a power-up or an enemy shot), to test what happens when it meets the ship.
const putRow = (t: T, pool: string, fields: Record<string, any>) => t.page((w, [p, f]) => {
  const vars = Object.values(w.vm.runtime.getTargetForStage().variables) as any[];
  const on = vars.find(v => v.name === `${p}.on`).value; const i = on.findIndex((x: any) => Number(x) === 0);
  for (const [k, x] of Object.entries(f as any)) vars.find(v => v.name === `${p}.${k}`).value[i] = x;
  on[i] = 1;
}, [pool, fields]);

test("starfire rush: power-ups: power raises the gun (more shots), repair heals, shield blocks shots", async t => {
  await startGame(t);
  await t.frames(30);
  const v = await t.vars();
  await putRow(t, "pu", { x: v.px, y: Number(v.py) + 10, kind: 1, t: 0 });
  await t.frames(3);
  t.expect(Number(await t.get("gun")) === 2, `gun ${await t.get("gun")}`);
  for (let g = 3; g <= 6; g++) { const w = await t.vars(); await putRow(t, "pu", { x: w.px, y: Number(w.py) + 10, kind: 1, t: 0 }); await t.frames(3); }
  t.expect(Number(await t.get("gun")) === 6, `max gun ${await t.get("gun")}`);
  await t.frames(20);
  const shots = (await list(t, "pb.on")).map(Number).reduce((a, b) => a + b);
  t.expect(shots >= 20, `${shots} shots in the air at gun 6`);
  await t.screenshot(shot("sfr-gun6"));
  // Hit by a shot: health and a gun level go.
  let w = await t.vars();
  await putRow(t, "eb", { x: w.px, y: Number(w.py) + 5, vx: 0, vy: -1, k: 1, dir: 180 });
  await t.frames(2);
  w = await t.vars();
  t.expect(Number(w.hp) === 5 && Number(w.gun) === 5 && Number(w.inv) > 0, `hp ${w.hp}, gun ${w.gun}, inv ${w.inv}`);
  // Repair heals 2 (at most 6).
  await putRow(t, "pu", { x: w.px, y: Number(w.py) + 10, kind: 2, t: 0 });
  await t.frames(3);
  t.expect(Number(await t.get("hp")) === 6, `hp ${await t.get("hp")}`);
  // Shield: shots near the ship vanish, no damage.
  await setVar(t, "inv", 0);
  w = await t.vars();
  await putRow(t, "pu", { x: w.px, y: Number(w.py) + 10, kind: 3, t: 0 });
  await t.frames(3);
  w = await t.vars();
  await putRow(t, "eb", { x: w.px, y: Number(w.py) + 30, vx: 0, vy: -2, k: 1, dir: 180 });
  await t.frames(10);
  t.expect(Number(await t.get("hp")) === 6 && Number(await t.get("shieldT")) > 0, `shielded: hp ${await t.get("hp")}`);
});

test("starfire rush: a bomb clears enemy shots and hurts every enemy", async t => {
  await startGame(t);
  await t.frames(60);
  for (let i = 0; i < 6; i++) await putRow(t, "eb", { x: -150 + i * 60, y: 100, vx: 0, vy: -0.5, k: 1, dir: 180 });
  const w = await t.vars();
  await putRow(t, "pu", { x: w.px, y: Number(w.py) + 10, kind: 4, t: 0 });
  await t.frames(3);
  const shots = (await list(t, "eb.on")).map(Number).reduce((a, b) => a + b);
  t.expect(shots === 0, `${shots} enemy shots left`);
});

test("starfire rush: clearing a wave gives a bonus and the next wave; new enemy kinds join", async t => {
  await startGame(t);
  await setVar(t, "hp", 99);
  for (let f = 0; f < 60 && Number(await t.get("wave")) < 2; f++) await autopilot(t, 30);
  t.expect(Number(await t.get("wave")) === 2, `wave ${await t.get("wave")}`);
  // Later waves bring the other kinds.
  await setVar(t, "wave", 7);
  for (let f = 0; f < 40; f++) { await autopilot(t, 30); await setVar(t, "hp", 99); if ((await list(t, "en.kind")).map(Number).some((k, i) => k >= 5)) break; }
  const kinds = new Set((await list(t, "en.kind")).map(Number));
  t.log([...kinds]);
  t.expect([...kinds].some(k => k >= 5), `tanks or spinners by wave 8: ${[...kinds]}`);
  await t.screenshot(shot("sfr-wave8"));
});

test("starfire rush: wave 5 is a boss: a warning, three phases, a big bonus, a new sector", async t => {
  await startGame(t);
  await setVar(t, "wave", 4); await setVar(t, "groupsLeft", 0);
  await t.page(w => { for (const v of Object.values(w.vm.runtime.getTargetForStage().variables) as any[]) if (v.name === "en.on") v.value.fill(0); });
  await t.until(v => v.wstate === "warning", { max: 200, what: "the warning" });
  await t.frames(20);
  await t.screenshot(shot("sfr-warning"));
  await t.until(v => v.wstate === "boss", { max: 200, what: "the boss" });
  await setVar(t, "gun", 6);
  let phaseShot = false, mostPower = 0;
  for (let f = 0; f < 200 && (await t.get("wstate")) === "boss"; f++) {
    await setVar(t, "shieldT", 999); await setVar(t, "gun", 6);
    await t.mouse(Number(await t.get("bossX")), -40); await t.frames(5);
    const hp = Number(await t.get("bossHp")), max = Number(await t.get("bossMax"));
    mostPower = Math.max(mostPower, (await list(t, "pu.on")).map(Number).reduce((a, b) => a + b));
    if (!phaseShot && hp < max * 0.3) { await t.screenshot(shot("sfr-boss")); phaseShot = true; }
  }
  await t.until(v => v.wstate === "bossdown", { max: 10, what: "the boss to go down" });
  t.expect(mostPower >= 3, `power-ups fall during the fight (${mostPower} at once)`);
  await t.frames(85);
  await t.screenshot(shot("sfr-bossdown"));
  const v = await t.until(v => Number(v.wave) === 6, { max: 400, what: "wave 6" });
  t.expect(Number(v.score) >= 20000 && Number(v.sector) === 2, `score ${v.score}, sector ${v.sector}`);
});

test("starfire rush: fast enough in the interpreter (scratch.mit.edu) with a busy screen", async t => {
  await startGame(t, false);
  await setVar(t, "wave", 9); await setVar(t, "gun", 6); await setVar(t, "hp", 99); await setVar(t, "groupsLeft", 99);
  // A busy screen: every enemy row taken by spinners and gunners (tough, and they all shoot), the shots flying.
  for (let i = 0; i < 20; i++) await putRow(t, "en", { kind: i % 2 ? 6 : 4, x: -200 + (i % 10) * 44, y: 40 + Math.floor(i / 10) * 50,
    bx: -200 + (i % 10) * 44, sy: 40 + Math.floor(i / 10) * 50, hp: 999, t: 0, fire: i * 3, hit: 0, st: 1, vx: 1, vy: -1 });
  await autopilot(t, 60);
  const t0 = Date.now();
  await autopilot(t, 150);
  const ms = (Date.now() - t0) / 150;
  const busy = [(await list(t, "pb.on")), (await list(t, "en.on")), (await list(t, "eb.on"))].map(l => l.map(Number).reduce((a, b) => a + b));
  t.log({ msPerFrame: ms.toFixed(1), shots: busy[0], enemies: busy[1], enemyShots: busy[2], clones: await t.page(w => w.vm.runtime._cloneCounter) });
  t.expect(ms < 33, `${ms.toFixed(1)} ms a frame`);
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
});

test("starfire rush: high gun levels burn energy fast; when it runs out the gun drops a level", async t => {
  await startGame(t);
  await setVar(t, "groupsLeft", 0); await setVar(t, "hp", 99);
  for (let g = 2; g <= 6; g++) { const w = await t.vars(); await putRow(t, "pu", { x: w.px, y: Number(w.py) + 10, kind: 1, t: 0 }); await t.frames(3); }
  let v = await t.vars();
  t.expect(Number(v.gun) === 6 && Number(v.energy) > 80, `gun ${v.gun}, energy ${v.energy}`);
  await t.frames(30);
  await t.screenshot(shot("sfr-energy"));
  // Level 6 lasts about 2.5 s (12–13 volleys of 8), level 5 about twice as long from 60 energy.
  let f6 = 0; while (Number(await t.get("gun")) === 6 && f6 < 200) { await t.frames(5); f6 += 5; }
  v = await t.vars();
  t.expect(Number(v.gun) === 5 && Number(v.energy) > 50, `after ${f6 + 30} frames: gun ${v.gun}, energy ${v.energy}`);
  let f5 = 0; while (Number(await t.get("gun")) === 5 && f5 < 300) { await t.frames(5); f5 += 5; }
  t.log({ level6Frames: f6 + 30, level5Frames: f5 });
  t.expect(f6 + 30 < 120 && f5 > 60 && f5 < 120, `level 6 lasted ${f6 + 30} frames, level 5 ${f5}`);
  // The double shot hardly ever runs out: 10 seconds at level 2 use almost nothing.
  await holdWave(t); await t.page(w => { for (const v of Object.values(w.vm.runtime.getTargetForStage().variables) as any[]) if (v.name === "pu.on" || v.name === "en.on") v.value.fill(0); });
  await setVar(t, "gun", 2); await setVar(t, "energy", 100);
  await t.frames(300);
  t.expect(Number(await t.get("gun")) === 2 && Number(await t.get("energy")) > 95, `level 2 after 10 s: energy ${await t.get("energy")}`);
  // A power-up fills the energy again.
  v = await t.vars(); await putRow(t, "pu", { x: v.px, y: Number(v.py) + 10, kind: 1, t: 0 }); await t.frames(3);
  t.expect(Number(await t.get("energy")) > 90, `energy ${await t.get("energy")} after a power-up`);
});

test("starfire rush: once a wave a cluster of three power-ups falls", async t => {
  await startGame(t);
  await setVar(t, "hp", 99); await setVar(t, "wave", 1); await setVar(t, "groupsLeft", 0);
  await t.page(w => { for (const v of Object.values(w.vm.runtime.getTargetForStage().variables) as any[]) if (v.name === "en.on") v.value.fill(0); });
  await t.until(v => Number(v.wave) === 2, { max: 300, what: "wave 2" });
  let most = 0;
  for (let f = 0; f < 120 && most < 3; f++) { await t.frames(10); await setVar(t, "hp", 99);
    most = Math.max(most, (await list(t, "pu.kind")).map(Number).filter((k, i) => k === 1).length && (await list(t, "pu.on")).map(Number).reduce((a, b) => a + b)); }
  t.expect(most >= 3, `a power cluster in wave 2 (${most} power-ups at once)`);
  await t.screenshot(shot("sfr-cluster"));
});

test("starfire rush: steel: none before wave 3, then it comes; it stops shots both ways and cannot be destroyed", async t => {
  await startGame(t);
  await setVar(t, "hp", 99);
  await autopilot(t, 200);
  t.expect((await list(t, "ob.on")).map(Number).every(x => x === 0), "no steel in wave 1");
  await setVar(t, "wave", 3); await setVar(t, "steelT", 1);
  await t.frames(3);
  t.expect((await list(t, "ob.on")).map(Number).some(x => x === 1), "steel in wave 3");
  // A plate right above the ship: the ship's shots stop on it.
  await t.page(w => { for (const v of Object.values(w.vm.runtime.getTargetForStage().variables) as any[]) if (v.name.startsWith("ob.") || v.name === "en.on" || v.name === "eb.on") v.value.fill(0); });
  await holdWave(t); await setVar(t, "steelT", 99999);
  await putRow(t, "ob", { x: 0, y: 40, kind: 2, hw: 60, hh: 20 });
  await t.mouse(0, -120); await t.frames(30);
  const above = (await list(t, "pb.on")).map(Number).filter((on, i) => on === 1).length;
  const ys = (await list(t, "pb.y")).map(Number).filter((y, i) => true);
  const onl = (await list(t, "pb.on")).map(Number), xs = (await list(t, "pb.x")).map(Number);
  t.expect(onl.every((on, i) => on === 0 || ys[i] < 40 || Math.abs(xs[i]) > 60), `no shot gets through the plate (${above} in the air)`);
  // An enemy shot falling onto it stops too; the plate is still there.
  const plateY = Number((await list(t, "ob.y"))[0]);
  await putRow(t, "eb", { x: 0, y: plateY + 45, vx: 0, vy: -3, k: 1, dir: 180 });
  await t.frames(20);
  t.expect((await list(t, "eb.on")).map(Number).every(x => x === 0), "the enemy shot stopped on the steel");
  t.expect((await list(t, "ob.on")).map(Number).filter(x => x === 1).length === 1, "the steel cannot be shot down");
  await t.screenshot(shot("sfr-steel"));
});

test("starfire rush: the ship cannot fly through steel; pinned at the bottom it is crushed", async t => {
  await startGame(t);
  await setVar(t, "hp", 99); await holdWave(t);
  await t.page(w => { for (const v of Object.values(w.vm.runtime.getTargetForStage().variables) as any[]) if (v.name === "en.on" || v.name === "eb.on") v.value.fill(0); });
  await putRow(t, "ob", { x: 0, y: -20, kind: 3, hw: 75, hh: 27 });
  await t.mouse(0, -120); await t.frames(20);
  await t.mouse(0, 100); await t.frames(20);
  const py = Number(await t.get("py"));
  t.expect(py < -20 - 27, `the ship stays below the steel (y ${py.toFixed(0)})`);
  // The steel keeps coming down; the ship is pinned against the bottom: a hit, and out to the side.
  await setVar(t, "inv", 0);
  const hp0 = Number(await t.get("hp"));
  for (let f = 0; f < 60 && Number(await t.get("hp")) === hp0; f++) await t.frames(5);
  const v = await t.vars();
  t.expect(Number(v.hp) === hp0 - 1 && Math.abs(Number(v.px)) > 75, `crushed: hp ${v.hp}, ship at x ${Number(v.px).toFixed(0)}`);
});
