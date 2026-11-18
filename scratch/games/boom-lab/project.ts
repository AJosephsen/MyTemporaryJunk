// Boom Lab (a tutorial on explosion effects), as a function of the tutorial step: boomLab(8) is the whole lab, 1..7 are
// the tutorial's checkpoints, 0 is the starter (artwork, no code). Click the sky to set off the effect picked in the
// toolbar. Every step adds one effect (one button) and one new idea:
//   1  pop: a flip-book, "next costume" a few times
//   2  fireball: one costume that grows and fades (size and the ghost effect)
//   3  ring: clones in a ring; each clone copies the direction it was made with
//   4  sparks: gravity, a speed that changes a little every frame
//   5  smoke: slow, random puffs that rise, grow and fade
//   6  blast: a full-screen flash and a shockwave, together with a fireball and a ring
//   7  quake: the ground shakes, less and less
//   8  mega: debris that bounces on the ground, and every effect at once
//
// The Boom sprite stays hidden; for each piece of an explosion it makes a clone with a role ("pop", "spark", ...).
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { art } from "./art.ts";

export const LAST = 8;
export const EFFECTS = ["pop", "fireball", "ring", "sparks", "smoke", "blast", "quake", "mega"];
export const BAR_Y = -160, CLICK_ABOVE = -135, FLOOR = -100, LAND_Y = -95;
export const buttonX = (i: number) => -203 + 58 * i;

export function boomLab(step: number): Buffer {
  const P = new Project();
  const at = (n: number) => step >= n;
  const when = <T>(n: number, xs: () => T[]): T[] => (at(n) ? xs() : []);

  // ---------------------------------------------------------------- Boom: every piece of every explosion
  function boomScripts(): Blocks {
    const B = new Blocks(P).local("role", "vx", "vy", "spin");
    const d = dsl(B);
    const { v, add, mul, div, eq, lt, gt, and, not, set, change, ifThen, whenFlag, whenCloned, hide, show, goTo, forever, cloneMyself,
      deleteClone, wait, random, repeat, waitUntil, mouseDown, mouseY, costume, costumeTo, nextCostume, setSize, changeSize, setEffect,
      changeEffect, move, turn, changeX, changeY, setY, yPos, join, broadcast, define, call, arg, cond } = d;
    if (!at(1)) return B;
    // Wait for a click in the sky, go there, and boom.
    B.script(whenFlag(), [hide(), forever([
      waitUntil(and(mouseDown(), gt(mouseY(), CLICK_ABOVE))),
      goTo("_mouse_"), call("boom"),
      waitUntil(not(mouseDown())),
    ])], 20, 20);
    // "make 16 spark": 16 clones with the role "spark". From step 3 it turns 360 / 16 degrees before each one, so they
    // point all the way round. "Run without screen refresh": all of them are made at once.
    define("make %s %s", [set("role", arg("kind")), repeat(arg("n"), [...when(3, () => [turn(div(360, arg("n")))]), cloneMyself()])],
      { args: ["n", "kind"], warp: true, x: 20, y: 260 });
    // The recipes: which pieces each effect is made of.
    const make = (n: number, kind: string) => call("make %s %s", n, kind);
    const recipes: [string, () => any[]][] = [
      ["pop", () => [make(1, "pop")]],
      ["fireball", () => [make(1, "fireball")]],
      ["ring", () => [make(16, "spark")]],
      ["sparks", () => [make(20, "ember")]],
      ["smoke", () => [make(6, "smoke")]],
      ["blast", () => [broadcast("flash"), make(1, "shock"), make(1, "fireball"), make(12, "spark")]],
      ["quake", () => [broadcast("shake"), make(1, "shock"), make(5, "smoke"), ...when(8, () => [make(6, "chunk")])]],
      ["mega", () => [broadcast("flash"), broadcast("shake"), make(1, "shock"), make(1, "fireball"), make(16, "spark"), make(16, "ember"),
        make(6, "smoke"), make(8, "chunk")]],
    ];
    define("boom", [cond(recipes.slice(0, step).map(([n, body]) => [eq(v("effect"), n), body()] as [any, any[]]))], { warp: true, x: 20, y: 420 });

    // Each role has its own clone script.
    let y = 700;
    const piece = (n: number, role: string, body: () => any[]) => { if (at(n)) { B.script(whenCloned(), [ifThen(eq(v("role"), role), [...body(), deleteClone()])], 20, y); y += 260; } };
    // 1 A flip-book: five costumes, one after the other.
    piece(1, "pop", () => [costume("pop1"), show(), repeat(4, [wait(0.05), nextCostume()]), wait(0.05)]);
    // 2 One costume that grows and fades away.
    piece(2, "fireball", () => [costume("fireball"), setSize(40), show(), repeat(14, [changeSize(12), changeEffect("GHOST", 7)])]);
    // 3 Fly out the way it points (the way it was made), getting smaller.
    piece(3, "spark", () => [costume("spark"), show(), repeat(16, [move(7), changeSize(-5)])]);
    // 4 Gravity: vy goes down a little every frame, so an ember flies up, slows, and falls.
    piece(4, "ember", () => [costume("ember"), set("vx", mul(0.1, random(-50, 50))), set("vy", random(3, 10)), show(),
      repeat(35, [changeX(v("vx")), changeY(v("vy")), change("vy", -0.6), changeEffect("GHOST", 2.5)])]);
    // 5 Smoke: a random size, place, start and drift; slowly up, bigger and fainter.
    piece(5, "smoke", () => [costume("smoke"), setSize(random(40, 80)), setEffect("GHOST", 30), changeX(random(-20, 20)), changeY(random(-5, 15)),
      set("vx", mul(0.1, random(-6, 6))), wait(mul(0.05, random(0, 6))), show(),
      repeat(45, [changeY(1), changeX(v("vx")), changeSize(2), changeEffect("GHOST", 1.6)])]);
    // 6 The shockwave: a ring that grows very fast and fades.
    piece(6, "shock", () => [costume("shock"), setSize(15), show(), repeat(10, [changeSize(30), changeEffect("GHOST", 10)])]);
    // 8 Debris: flies, spins and falls; bounces on the ground, losing speed each time; then fades.
    piece(8, "chunk", () => [costumeTo(join("chunk", random(1, 2))), set("vx", mul(0.1, random(-60, 60))), set("vy", random(5, 11)), set("spin", random(-25, 25)), show(),
      repeat(70, [changeX(v("vx")), changeY(v("vy")), change("vy", -0.6), turn(v("spin")),
        ifThen(and(lt(yPos(), FLOOR), lt(v("vy"), 0)), [setY(FLOOR), set("vy", mul(-0.5, v("vy"))), set("vx", mul(0.7, v("vx"))), set("spin", mul(0.5, v("spin")))])]),
      repeat(10, [changeEffect("GHOST", 10)])]);
    void add;
    return B;
  }

  // ---------------------------------------------------------------- Flash: the whole screen, for a moment
  function flashScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    if (!at(6)) return B;
    const { whenFlag, whenReceive, hide, show, goto, setEffect, changeEffect, repeat, front } = d as any;
    B.script(whenFlag(), [hide(), goto(0, 0)], 20, 20);
    B.script(whenReceive("flash"), [setEffect("GHOST", 20), show(), repeat(8, [changeEffect("GHOST", 10)]), hide()], 20, 140);
    void front;
    return B;
  }

  // ---------------------------------------------------------------- Land: the ground, which can shake
  function landScripts(): Blocks {
    const B = new Blocks(P).local("jolt");
    const d = dsl(B);
    const { v, add, set, change, whenFlag, whenReceive, goto, repeat, random, mul } = d;
    if (!at(7)) return B;
    B.script(whenFlag(), [goto(0, LAND_Y)], 20, 20);
    // A shake: jump to a random spot near home, a little less far each time, then home again.
    B.script(whenReceive("shake"), [set("jolt", 12), repeat(12, [
      goto(random(mul(-1, v("jolt")), v("jolt")), add(LAND_Y, random(mul(-1, v("jolt")), v("jolt")))), change("jolt", -1)]),
      goto(0, LAND_Y)], 20, 140);
    return B;
  }

  // ---------------------------------------------------------------- Button: the toolbar and one button per effect
  function buttonScripts(): Blocks {
    const B = new Blocks(P).local("name");
    const d = dsl(B);
    const { v, eq, not, set, ifThen, ifElse, whenFlag, whenCloned, whenClicked, goto, costume, show, cloneMyself, forever, setSize, setEffect, front } = d;
    if (!at(1)) return B;
    // The original is the toolbar; it makes a clone for each button.
    B.script(whenFlag(), [costume("bar"), goto(0, BAR_Y), show(), set("effect", "pop"),
      ...EFFECTS.slice(0, step).flatMap((n, i) => [set("name", n), costume(n), goto(buttonX(i), BAR_Y), cloneMyself()]),
      set("name", ""), costume("bar"), goto(0, BAR_Y)], 20, 20);
    // A button: in front of the toolbar, big and bright when it is the effect you picked.
    B.script(whenCloned(), [front(), forever([ifElse(eq(v("effect"), v("name")), [setSize(112), setEffect("BRIGHTNESS", 0)], [setSize(92), setEffect("BRIGHTNESS", -30)])])], 20, 300);
    B.script(whenClicked(), [ifThen(not(eq(v("name"), "")), [set("effect", v("name"))])], 20, 480);
    return B;
  }

  const A = art(P);
  return P.build({
    backdrop: A.backdrop,
    sprites: [
      P.sprite("Land", { blocks: landScripts(), costumes: A.land, layer: 1, x: 0, y: LAND_Y }),
      P.sprite("Boom", { blocks: boomScripts(), costumes: A.boom, layer: 2, visible: false }),
      P.sprite("Flash", { blocks: flashScripts(), costumes: A.flash, layer: 3, visible: false }),
      P.sprite("Button", { blocks: buttonScripts(), costumes: A.button, layer: 4, x: 0, y: BAR_Y }),
    ],
    shown: at(1) ? ["effect"] : [],
  });
}
