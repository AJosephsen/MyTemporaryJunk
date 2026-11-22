// Reusable effect sprites (.sprite3): each one hides when the green flag is clicked and plays its effect, with its own
// sound, in every clone. To use one in a project:
//   set [fx x v] to (x position)
//   set [fx y v] to (y position)
//   create clone of [FX Pop v]
// The clone goes to (fx x, fx y), plays and deletes itself. fx x and fx y are variables for all sprites; Scratch makes
// them when you upload the first effect sprite (or uses yours if they are already there).
//
// Effects with several pieces (Ring, Sparks, Smoke, Debris, Explosion) work in two stages: the clone you make is the
// "emitter" (its role is empty): it plays the sound and makes the pieces (clones of itself with a role), then waits
// for the sound to finish and deletes itself. A deleted clone's sound stops, so the emitter lives as long as its sound.
import { Project, Blocks, dsl, sprite3 } from "../lib/sb3.ts";
import { tone, noise, clicks, mix, env, wav } from "../lib/sound.ts";
import { art } from "../games/boom-lab/art.ts";
import { cartoonArt } from "./cartoon-art.ts";

export const FX_X = "fx x", FX_Y = "fx y", FLOOR = -170;

// ---------------------------------------------------------------- sounds
export const SOUNDS: Record<string, () => Float32Array> = {
  pop: () => mix([[0, tone(0.12, 900, 180, env(0.002, 0.03))], [0, noise(0.05, 0.9, 0.5, env(0.001, 0.01), 3)]]),
  whoomp: () => mix([[0, noise(0.6, 0.05, 0.02, env(0.04, 0.15), 4)], [0, tone(0.5, 140, 60, env(0.02, 0.12))]]),
  zing: () => mix([[0, tone(0.4, 500, 2000, env(0.005, 0.12))], [0.03, tone(0.35, 750, 3000, env(0.005, 0.08), "saw")]]),
  crackle: () => mix([[0, clicks(0.8, 45, 0.7, env(0.01, 0.3), 5)], [0, noise(0.15, 0.4, 0.1, env(0.002, 0.04), 6)]]),
  hiss: () => mix([[0, noise(1.2, 0.15, 0.05, env(0.25, 0.35), 7)]], 0.6),
  thump: () => mix([[0, tone(0.7, 110, 35, env(0.003, 0.18))], [0, noise(0.5, 0.08, 0.02, env(0.003, 0.1), 8)]]),
  flash: () => mix([[0, noise(0.25, 1, 0.3, env(0.001, 0.05), 9)], [0, tone(0.2, 2400, 1200, env(0.001, 0.04))]], 0.6),
  clatter: () => mix([[0, noise(0.2, 0.1, 0.03, env(0.002, 0.05), 10)], [0.1, clicks(0.9, 14, 0.25, env(0.05, 0.4), 11)]]),
  boom: () => mix([[0, noise(1.4, 0.12, 0.015, env(0.005, 0.35), 12)], [0, tone(1.2, 90, 30, env(0.004, 0.3))],
    [0.05, clicks(1.0, 40, 0.6, env(0.02, 0.3), 13)]]),
  // Cartoon sounds: a soft "poof", and a bouncy "ka-boom" (a falling square-wave tone with a thud).
  poof: () => mix([[0, noise(0.45, 0.25, 0.06, env(0.03, 0.1), 14)], [0, tone(0.2, 320, 140, env(0.01, 0.06))]], 0.7),
  kaboom: () => mix([[0, tone(0.18, 420, 160, env(0.003, 0.05), "square")], [0.1, noise(1.0, 0.14, 0.02, env(0.005, 0.25), 15)],
    [0.1, tone(0.8, 120, 38, env(0.004, 0.22))], [0.35, noise(0.5, 0.2, 0.05, env(0.05, 0.12), 16)]]),
};

// ---------------------------------------------------------------- the effects
type Fx = { name: string; title: string; about: string; sound: string; costumes: (string | any)[]; length: number; build: (B: Blocks) => void };
// A recipe: [how many, which piece] to make, or a number: wait that many seconds first.
type Recipe = ([number, string] | number)[];

export function effects(P: Project) {
  const A = art(P), C = cartoonArt(P);
  const costumes = [...A.boom, ...A.flash];
  const sounds = Object.fromEntries(Object.entries(SOUNDS).map(([n, f]) => [n, P.sound(n, wav(f()))]));

  // Pieces, the same as in Boom Lab: each a list of blocks that starts with the costume and ends with "delete this clone".
  const piece = (d: ReturnType<typeof dsl>, kind: string) => {
    const { v, mul, lt, and, set, change, ifThen, show, costume, costumeTo, setSize, changeSize, setEffect, changeEffect, repeat, wait, nextCostume,
      move, turn, changeX, changeY, setY, yPos, random, join, front, point, floor, mod, div } = d;
    // A cartoon puff: pops up, drifts, then shrinks away. Every 3 frames it switches between its two drawings, so the
    // pencil lines "boil". (vx, vy: how it drifts, in tenths of a step per frame.)
    const cartoonPuff = (vx: [number, number], vy: [number, number]) => {
      const boil = [change("tick", 1), costumeTo(join(join("puff", v("look")), join("-", floor(div(mod(v("tick"), 6), 3)))))];
      const drift = [changeX(v("vx")), changeY(v("vy"))];
      return [point(90), set("look", random(1, 3)), set("tick", random(0, 5)), changeX(random(-14, 14)), changeY(random(-8, 8)),
        set("vx", mul(0.1, random(vx[0], vx[1]))), set("vy", mul(0.1, random(vy[0], vy[1]))), setSize(15), ...boil,
        wait(mul(0.04, random(0, 5))), front(), show(),
        repeat(6, [...boil, ...drift, changeSize(14)]), repeat(24, [...boil, ...drift, changeSize(0.6)]),
        repeat(10, [...boil, ...drift, changeSize(-10)])];
    };
    const pieces: Record<string, () => any[]> = {
      pop: () => [costume("pop1"), front(), show(), repeat(4, [wait(0.05), nextCostume()]), wait(0.05)],
      fireball: () => [costume("fireball"), setSize(40), front(), show(), repeat(14, [changeSize(12), changeEffect("GHOST", 7)])],
      spark: () => [costume("spark"), front(), show(), repeat(16, [move(7), changeSize(-5)])],
      ember: () => [costume("ember"), set("vx", mul(0.1, random(-50, 50))), set("vy", random(3, 10)), front(), show(),
        repeat(35, [changeX(v("vx")), changeY(v("vy")), change("vy", -0.6), changeEffect("GHOST", 2.5)])],
      smoke: () => [costume("smoke"), setSize(random(40, 80)), setEffect("GHOST", 30), changeX(random(-20, 20)), changeY(random(-5, 15)),
        set("vx", mul(0.1, random(-6, 6))), wait(mul(0.05, random(0, 6))), show(),
        repeat(45, [changeY(1), changeX(v("vx")), changeSize(2), changeEffect("GHOST", 1.6)])],
      shock: () => [costume("shock"), setSize(15), front(), show(), repeat(10, [changeSize(30), changeEffect("GHOST", 10)])],
      chunk: () => [costumeTo(join("chunk", random(1, 2))), set("vx", mul(0.1, random(-60, 60))), set("vy", random(5, 11)), set("spin", random(-25, 25)), front(), show(),
        repeat(70, [changeX(v("vx")), changeY(v("vy")), change("vy", -0.6), turn(v("spin")),
          ifThen(and(lt(yPos(), FLOOR), lt(v("vy"), 0)), [setY(FLOOR), set("vy", mul(-0.5, v("vy"))), set("vx", mul(0.7, v("vx"))), set("spin", mul(0.5, v("spin")))])]),
        repeat(10, [changeEffect("GHOST", 10)])],
      puff: () => cartoonPuff([-8, 8], [4, 14]),
      "blast-puff": () => cartoonPuff([-30, 30], [-12, 22]),
      // The cartoon explosion: a flip-book, then the last drawing (the smoke cloud) shrinks while the puffs fly out.
      kaboom: () => [point(90), costume("kaboom1"), front(), show(), repeat(4, [wait(0.07), nextCostume()]), wait(0.05), repeat(8, [changeSize(-11)])],
    };
    return pieces[kind]();
  };

  // One piece: the clone itself is the effect.
  const single = (kind: string, sound: string, length: number) => (B: Blocks) => {
    const d = dsl(B), { v, whenFlag, whenCloned, hide, goto, startSound, wait, deleteClone } = d;
    B.script(whenFlag(), [hide()], 20, 20);
    B.script(whenCloned(), [goto(v(FX_X), v(FX_Y)), startSound(sound), ...piece(d, kind), hide(), wait(length), deleteClone()], 20, 140);
  };
  // Several pieces: the clone you make is the emitter (role empty); the pieces are its clones.
  const several = (recipe: Recipe, sound: string, length: number) => (B: Blocks) => {
    B.local("role", "vx", "vy", "spin", "look", "tick");
    const d = dsl(B), { v, eq, div, set, whenFlag, whenCloned, hide, goto, startSound, wait, deleteClone, ifThen, repeat, turn, cloneMyself, define, call, arg } = d;
    B.script(whenFlag(), [hide(), set("role", "")], 20, 20);
    B.script(whenCloned(), [ifThen(eq(v("role"), ""), [
      hide(), goto(v(FX_X), v(FX_Y)), startSound(sound),
      ...recipe.map(r => typeof r === "number" ? wait(r) : call("make %s %s", r[0], r[1])),
      wait(length), deleteClone()])], 20, 140);
    // "make 16 spark": 16 clones with that role, turning 360 / 16 degrees before each, so they point all the way round.
    define("make %s %s", [set("role", arg("kind")), repeat(arg("n"), [turn(div(360, arg("n"))), cloneMyself()]), set("role", "")],
      { args: ["n", "kind"], warp: true, x: 20, y: 420 });
    let y = 560;
    for (const kind of new Set(recipe.flatMap(r => typeof r === "number" ? [] : [r[1]]))) { B.script(whenCloned(), [ifThen(eq(v("role"), kind), [...piece(d, kind), deleteClone()])], 20, y); y += 280; }
  };

  const list: Fx[] = [
    { name: "FX Pop", title: "Pop", about: "A cartoon pop: a five-frame flip-book.", sound: "pop", costumes: ["pop1", "pop2", "pop3", "pop4", "pop5"], length: 0.1, build: single("pop", "pop", 0.1) },
    { name: "FX Fireball", title: "Fireball", about: "A soft fireball that swells up and fades.", sound: "whoomp", costumes: ["fireball"], length: 0.3, build: single("fireball", "whoomp", 0.3) },
    { name: "FX Shockwave", title: "Shockwave", about: "A ring that grows very fast and fades.", sound: "thump", costumes: ["shock"], length: 0.5, build: single("shock", "thump", 0.5) },
    { name: "FX Ring", title: "Spark ring", about: "Sixteen sparks fly out in a ring.", sound: "zing", costumes: ["spark"], length: 0.5, build: several([[16, "spark"]], "zing", 0.5) },
    { name: "FX Sparks", title: "Sparks", about: "Embers fly up, slow down and fall: gravity.", sound: "crackle", costumes: ["ember"], length: 1, build: several([[20, "ember"]], "crackle", 1) },
    { name: "FX Smoke", title: "Smoke", about: "Grey puffs that rise, grow and fade.", sound: "hiss", costumes: ["smoke"], length: 1.3, build: several([[6, "smoke"]], "hiss", 1.3) },
    { name: "FX Debris", title: "Debris", about: "Rocks and planks fly, spin, and bounce on the bottom of the stage.", sound: "clatter", costumes: ["chunk1", "chunk2"], length: 1, build: several([[8, "chunk"]], "clatter", 1) },
    { name: "FX Explosion", title: "Explosion", about: "The big one: fireball, shockwave, sparks, embers and smoke.", sound: "boom", costumes: ["fireball", "shock", "spark", "ember", "smoke"], length: 1.5,
      build: several([[1, "fireball"], [1, "shock"], [14, "spark"], [14, "ember"], [5, "smoke"]], "boom", 1.5) },
    { name: "FX Cartoon Smoke", title: "Cartoon smoke", about: "Puffy pencil-drawn smoke clouds that pop up, drift and shrink away; their outlines wobble like a hand-drawn cartoon.",
      sound: "poof", costumes: C.puffs, length: 1.6, build: several([[5, "puff"]], "poof", 1.6) },
    { name: "FX Cartoon Boom", title: "Cartoon explosion", about: "A pencil-drawn ka-boom: a spiky burst that turns into a smoke cloud and breaks into puffs.",
      sound: "kaboom", costumes: [...C.boom, ...C.darkPuffs], length: 1.8, build: several([[1, "kaboom"], 0.2, [7, "blast-puff"]], "kaboom", 1.6) },
    { name: "FX Flash", title: "Screen flash", about: "The whole screen flashes warm white. It ignores fx x and fx y.", sound: "flash", costumes: ["flash"], length: 0.3,
      build: (B: Blocks) => {
        const d = dsl(B), { whenFlag, whenCloned, hide, show, goto, startSound, wait, deleteClone, setEffect, changeEffect, repeat, front } = d;
        B.script(whenFlag(), [hide()], 20, 20);
        B.script(whenCloned(), [goto(0, 0), front(), startSound("flash"), setEffect("GHOST", 20), show(), repeat(8, [changeEffect("GHOST", 10)]), hide(), wait(0.3), deleteClone()], 20, 140);
      } },
  ];

  return list.map(fx => {
    const B = new Blocks(P);
    fx.build(B);
    const sprite = P.sprite(fx.name, { blocks: B, costumes: fx.costumes.map(n => typeof n === "string" ? costumes.find(c => c.name === n)! : n), sounds: [sounds[fx.sound]], layer: 1, visible: false });
    return { ...fx, sprite, file: () => sprite3(P, sprite) };
  });
}
