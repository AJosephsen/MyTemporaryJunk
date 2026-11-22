// Tests for the effect sprites (sprites/effects/*.sprite3) and their demo project (sprites/effects-demo.sb3).
import { test, type T } from "../workbench/testing.ts";

const NAMES = ["FX Pop", "FX Fireball", "FX Shockwave", "FX Ring", "FX Sparks", "FX Smoke", "FX Debris", "FX Explosion", "FX Cartoon Smoke", "FX Cartoon Boom", "FX Flash"];
const file = (name: string) => `sprites/effects/${name.toLowerCase().replace(/\s+/g, "-")}.sprite3`;
type C = { x: number; y: number; visible: boolean; costume: string; role: string };
const clones = (t: T, name: string) => t.page((w, n) => w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === n).map((c: any) => ({
  x: c.x, y: c.y, visible: c.visible, costume: c.getCostumes()[c.currentCostume].name,
  role: (Object.values(c.variables) as any[]).find((v: any) => v.name === "role")?.value ?? "" })), name) as Promise<C[]>;
// Upload a sprite the way "Upload Sprite" does.
const upload = (t: T, path: string) => t.page(async (w, p) => {
  const buf = await (await fetch("/project/" + p)).arrayBuffer();
  await w.vm.addSprite(buf);
}, path);
const globals = (t: T) => t.page(w => (Object.values(w.vm.runtime.getTargetForStage().variables) as any[]).map((v: any) => v.name)) as Promise<string[]>;
const setGlobal = (t: T, name: string, value: number) => t.page((w, [n, x]) => {
  for (const v of Object.values(w.vm.runtime.getTargetForStage().variables) as any[]) if (v.name === n) v.value = x; }, [name, value]);
// "create clone of [name]", as the block does it.
const cloneOf = (t: T, name: string) => t.page((w, n) => {
  const s = w.vm.runtime.getSpriteTargetByName(n), c = s.makeClone(); w.vm.runtime.addTarget(c); c.goBehindOther(s); }, name);

test("fx sprites: uploading one into a project makes fx x and fx y for all sprites; a clone plays there", async t => {
  await t.load("tutorials/boom-lab/starter.sb3");
  t.expect(!(await globals(t)).includes("fx x"), "no fx x yet");
  await upload(t, file("FX Pop"));
  await upload(t, file("FX Explosion"));
  const g = await globals(t);
  const local = await t.page(w => (Object.values(w.vm.runtime.getSpriteTargetByName("FX Pop").variables) as any[]).map((v: any) => v.name));
  t.expect(g.filter(n => n === "fx x").length === 1 && g.filter(n => n === "fx y").length === 1, `globals ${g}; FX Pop's own ${local}`);
  await t.greenFlag(); await t.frames(2);
  await setGlobal(t, "fx x", 77); await setGlobal(t, "fx y", -20);
  await cloneOf(t, "FX Pop"); await cloneOf(t, "FX Explosion");
  await t.frames(3);
  const pop = await clones(t, "FX Pop"), ex = await clones(t, "FX Explosion");
  t.expect(pop.length === 1 && pop[0].x === 77 && pop[0].y === -20 && pop[0].visible, `pop at ${JSON.stringify(pop)}`);
  t.expect(ex.length > 30 && ex.every(c => Math.abs(c.x - 77) < 120), `explosion pieces: ${ex.length}`);
  await t.frames(80);
  t.expect((await clones(t, "FX Pop")).length === 0 && (await clones(t, "FX Explosion")).length === 0, "all gone");
});

// When each effect looks its best, in frames after the click (for the pictures on the library page).
const SHOT: Record<string, number> = { "FX Pop": 4, "FX Fireball": 6, "FX Shockwave": 4, "FX Ring": 7, "FX Sparks": 12, "FX Smoke": 20,
  "FX Debris": 22, "FX Explosion": 8, "FX Cartoon Smoke": 16, "FX Cartoon Boom": 9, "FX Flash": 2 };
const pic = (name: string) => new URL(`../sprites/effects/${name.toLowerCase().replace(/\s+/g, "-")}.png`, import.meta.url).pathname;

test("fx sprites demo: number keys pick the first nine effects; space goes to the next one and round again", async t => {
  await t.load("sprites/effects-demo.sb3"); await t.greenFlag(); await t.frames(2);
  const press = async (k: string) => { await t.hold(k); await t.frames(1); await t.release(k); await t.frames(1); };
  await press("3");
  t.expect(await t.get("effect") === NAMES[2], `3: ${await t.get("effect")}`);
  const seen: string[] = [];
  for (let i = 0; i < NAMES.length; i++) { await press("space"); seen.push(await t.get("effect")); }
  t.expect(seen.join() === [...NAMES.slice(3), ...NAMES.slice(0, 3)].join(), `space: ${seen}`);
});

for (const name of NAMES) test(`fx sprites demo: ${name} plays where you click, with its sound, then it is gone`, async t => {
  await t.load("sprites/effects-demo.sb3"); await t.greenFlag(); await t.frames(2);
  await t.set("effect", name);
  const sound = await t.page((w, n) => w.vm.runtime.getSpriteTargetByName(n).sprite.sounds.map((s: any) => [s.name, s.sampleCount]), name);
  t.expect(sound.length === 1 && sound[0][1] > 1000, `one sound: ${JSON.stringify(sound)}`);
  await t.mouse(40, 30, true); await t.frames(1); await t.mouse(40, 30, false);
  await t.frames(2);
  const c = await clones(t, name);
  const shown = c.filter(x => x.visible);
  t.expect(shown.length >= 1 && (name === "FX Flash" ? shown[0].x === 0 : shown.every(x => Math.abs(x.x - 40) < 60 && Math.abs(x.y - 30) < 60)),
    `${shown.length} pieces near the click: ${JSON.stringify(shown.slice(0, 3))}`);
  await t.frames(SHOT[name] - 3);
  await t.screenshot(pic(name));
  await t.frames(120);
  t.expect((await clones(t, name)).length === 0, "all gone");
});

test("fx sprites: cartoon puffs switch between their two drawings (the pencil lines boil)", async t => {
  await t.load("sprites/effects-demo.sb3"); await t.greenFlag(); await t.frames(2);
  await t.set("effect", "FX Cartoon Smoke");
  await t.mouse(0, 0, true); await t.frames(1); await t.mouse(0, 0, false);
  const looks = new Set<string>();
  for (let i = 0; i < 20; i++) { await t.frames(1); for (const c of await clones(t, "FX Cartoon Smoke")) if (c.visible) looks.add(c.costume); }
  const takes = [...looks].map(n => n.split("-")[1]);
  t.expect(takes.includes("0") && takes.includes("1") && [...looks].every(n => /^puff[1-3]-[01]$/.test(n)), `costumes ${[...looks]}`);
});
