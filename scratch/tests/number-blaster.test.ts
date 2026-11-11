// Tests for Number Blaster (maths game with the sprite-font kit).
import { test, type T } from "../workbench/testing.ts";

const GAME = "games/number-blaster/number-blaster.sb3";
const shot = (name: string) => `/tmp/claude-0/-home-user-MyTemporaryJunk/af299c66-140a-5320-8b1f-a09d589ac156/scratchpad/${name}.png`;
// The text the sprite font shows for a group: its clones' characters, left to right.
const textOf = (t: T, group: number) => t.page((w, g) => {
  const chars = w.vm.runtime.targets.find((x: any) => x.sprite.name === "Text").sprite.costumes;
  const st = w.vm.runtime.getTargetForStage(), list = (n: string) => (Object.values(st.variables) as any[]).find((x: any) => x.name === n).value;
  const gen = list("groupGen")[g - 1], glyphs = list("glyphChars");
  return w.vm.runtime.targets.filter((c: any) => c.sprite.name === "Text" && !c.isOriginal)
    .map((c: any) => { const get = (n: string) => (Object.values(c.variables) as any[]).find((x: any) => x.name === n).value; return { c, g: get("group"), gen: get("gen") }; })
    .filter((o: any) => Number(o.g) === g && Number(o.gen) === Number(gen))
    .sort((a: any, b: any) => a.c.x - b.c.x)
    .map((o: any) => { const name = o.c.getCostumes()[o.c.currentCostume].name; const i = chars.findIndex((k: any) => k.name === name); return i < glyphs.length ? glyphs[i] : name; })
    .join("");
}, group) as Promise<string>;
const list = (t: T, name: string) => t.get(name) as Promise<any[]>;
// compiler = false runs the project like scratch.mit.edu does (TurboWarp's interpreter).
async function startGame(t: T, compiler = true) {
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load(GAME); await t.greenFlag(); await t.frames(3);
  await t.page(w => w.vm.runtime.startHats("event_whenstageclicked"));
  await t.until(v => v.phase === "play", { max: 30, what: "the game to start" });
}
// Waits for a meteor, then returns its slot and answer.
async function meteor(t: T) {
  for (let i = 0; i < 300; i++) {
    const active = await list(t, "slotActive");
    const s = active.findIndex(x => Number(x) === 1);
    if (s >= 0) return { slot: s + 1, ans: String((await list(t, "slotAns"))[s]) };
    await t.frames(1);
  }
  throw new Error("no meteor came");
}
const clickPad = async (t: T, p: number) => { const x = [-168, -56, 56, 168][p - 1]; await t.mouse(x, -150); await t.click(x, -150); await t.frames(2); };

test("number blaster: the title shows, a click starts level 1", async t => {
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
  await t.load(GAME); await t.greenFlag(); await t.frames(10);
  await t.screenshot(shot("nb-title"));
  await t.mouse(0, 40); await t.click(0, 40);          // right on the title words
  const v = await t.until(v => v.phase === "play", { max: 30, what: "play" });
  t.expect(Number(v.level) === 1 && Number(v.lives) === 3, `level ${v.level}`);
});

for (const compiler of [true, false]) test(`number blaster: a meteor carries a sum, and its answer is on a pad (${compiler ? "compiled" : "interpreted"})`, async t => {
  await startGame(t, compiler);
  const m = await meteor(t);
  await t.frames(3);
  const sum = await textOf(t, 30 + m.slot);
  t.log({ sum, ans: m.ans, pads: await list(t, "padValue") });
  t.expect(/^\d+[+−×÷]\d+$/.test(sum), `the meteor shows "${sum}"`);
  const [a, op, b] = sum.split(/([+−×÷])/);
  const want = op === "+" ? +a + +b : op === "−" ? +a - +b : op === "×" ? +a * +b : +a / +b;
  t.expect(String(want) === m.ans, `${sum} is not ${m.ans}`);
  const pads = (await list(t, "padValue")).map(String);
  t.expect(pads.includes(m.ans) && new Set(pads).size === 4 && pads.every(p => p !== ""), `pads ${pads}`);
  for (let p = 1; p <= 4; p++) t.expect(await textOf(t, 20 + p) === pads[p - 1], `pad ${p} shows "${await textOf(t, 20 + p)}"`);
  await t.frames(60);
  await t.screenshot(shot("nb-meteor"));
});

for (const compiler of [true, false]) test(`number blaster: the right pad blasts the meteor and scores; the score display rolls up (${compiler ? "compiled" : "interpreted"})`, async t => {
  await startGame(t, compiler);
  const m = await meteor(t);
  const p = (await list(t, "padValue")).map(String).indexOf(m.ans) + 1;
  await clickPad(t, p);
  const v = await t.vars();
  t.expect(Number(v.hits) === 1 && Number((await list(t, "slotActive"))[m.slot - 1]) === 0, `hits ${v.hits}`);
  t.expect(Number(v.score) > 100, `score ${v.score}`);
  await t.frames(3);
  await t.screenshot(shot("nb-blast"));
  await t.frames(40);
  t.expect(await textOf(t, 1) === String(v.score), `score shows "${await textOf(t, 1)}", score ${v.score}`);
});

test("number blaster: a wrong pad breaks the streak; three right ones in a row make x2", async t => {
  await startGame(t);
  for (let i = 0; i < 3; i++) {
    const m = await meteor(t);
    await clickPad(t, (await list(t, "padValue")).map(String).indexOf(m.ans) + 1);
  }
  let v = await t.vars();
  t.expect(Number(v.streak) === 3 && Number(v.mult) === 2, `streak ${v.streak}, mult ${v.mult}`);
  await t.frames(2);
  t.expect(await textOf(t, 2) === "x2", `multiplier shows "${await textOf(t, 2)}"`);
  const m = await meteor(t);
  const pads = (await list(t, "padValue")).map(String), answers = (await list(t, "slotAns")).map(String);
  const active = (await list(t, "slotActive")).map(Number);
  const w = pads.findIndex(x => !answers.some((a, i) => active[i] === 1 && a === x)) + 1;
  t.expect(w > 0, "no wrong pad");
  await clickPad(t, w);
  v = await t.vars();
  t.expect(Number(v.streak) === 0 && Number(v.mult) === 1 && Number(v.misses) === 1, `streak ${v.streak} after a miss`);
});

test("number blaster: a meteor that reaches the shield costs a shield; three end the game", async t => {
  await startGame(t);
  const m = await meteor(t);
  await t.page((w, s) => { const st = w.vm.runtime.getTargetForStage(); (Object.values(st.variables) as any[]).find((x: any) => x.name === "slotY").value[s - 1] = -80; }, m.slot);
  await t.until(v => Number(v.lives) === 2, { max: 60, what: "the meteor to land" });
  await t.set("lives", 1);
  const n = await meteor(t);
  await t.page((w, s) => { const st = w.vm.runtime.getTargetForStage(); (Object.values(st.variables) as any[]).find((x: any) => x.name === "slotY").value[s - 1] = -80; }, n.slot);
  await t.until(v => v.phase === "over", { max: 60, what: "game over" });
  await t.frames(20);
  await t.screenshot(shot("nb-gameover"));
  await t.until(v => v.phase === "ready", { max: 120, what: "click to play again" });
});

test("number blaster: clearing a level gives stars, a bonus and the next level with new sums", async t => {
  await startGame(t);
  await t.set("goal", 2);
  for (let i = 0; i < 2; i++) {
    const m = await meteor(t);
    await clickPad(t, (await list(t, "padValue")).map(String).indexOf(m.ans) + 1);
  }
  await t.until(v => v.phase === "levelup", { max: 200, what: "level up" });
  await t.frames(45);
  await t.screenshot(shot("nb-levelup"));
  t.expect(await textOf(t, 7) === "★★★", `stars "${await textOf(t, 7)}"`);
  const before = Number(await t.get("score"));
  const v = await t.until(v => v.phase === "play" && Number(v.level) === 2, { max: 200, what: "level 2" });
  t.expect(Number(v.score) >= before + 3000, `bonus: ${before} → ${v.score}`);
  const m = await meteor(t);
  const sum = await textOf(t, 30 + m.slot);
  t.expect(sum.includes("−"), `level 2 sum "${sum}"`);
});

for (const compiler of [true, false]) test(`number blaster: writing a text group twice in one frame shows only the second text (${compiler ? "compiled" : "interpreted"})`, async t => {
  await startGame(t, compiler);
  await t.frames(5);
  await t.page(w => {
    const st = w.vm.runtime.getTargetForStage(), L = (n: string) => (Object.values(st.variables) as any[]).find((x: any) => x.name === n).value;
    for (const text of ["5", "17"]) {
      L("groupGen")[23] = Number(L("groupGen")[23]) + 1;
      L("qText").push(text); L("qX").push(168); L("qY").push(-150); L("qSize").push(56); L("qGroup").push(24);
      L("qMode").push("fixed"); L("qFollow").push(0); L("qGen").push(L("groupGen")[23]);
    }
  });
  await t.frames(3);
  t.expect(await textOf(t, 24) === "17", `pad 4 shows "${await textOf(t, 24)}"`);
  const all = await t.page(w => w.vm.runtime.targets.filter((c: any) => c.sprite.name === "Text" && !c.isOriginal &&
    Number((Object.values(c.variables) as any[]).find((x: any) => x.name === "group").value) === 24).length);
  t.expect(all === 2, `${all} clones in the group`);
});

test("number blaster: after a minute of play the pads still show one number each (interpreted)", async t => {
  await startGame(t, false);
  for (let i = 0; i < 6; i++) {
    const m = await meteor(t);
    if (i % 2 === 0) await clickPad(t, (await list(t, "padValue")).map(String).indexOf(m.ans) + 1);
    await t.frames(150);
    if ((await t.get("phase")) !== "play") break;
  }
  await t.frames(3);
  const pads = (await list(t, "padValue")).map(String);
  for (let p = 1; p <= 4; p++) t.expect(await textOf(t, 20 + p) === pads[p - 1], `pad ${p}: "${await textOf(t, 20 + p)}" for ${pads[p - 1]}`);
  const shown = await t.page(w => w.vm.runtime.targets.filter((c: any) => c.sprite.name === "Text" && !c.isOriginal && c.visible &&
    Number((Object.values(c.variables) as any[]).find((x: any) => x.name === "group").value) > 20 &&
    Number((Object.values(c.variables) as any[]).find((x: any) => x.name === "group").value) < 25).length);
  t.expect(shown === pads.join("").length, `${shown} pad digits on screen for ${pads}`);
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
});
