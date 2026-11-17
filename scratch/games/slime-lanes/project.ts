// Slime Lanes, as a function of the tutorial step: slimeLanes(7) is the whole game, 1..6 are the tutorial's
// checkpoints, 0 is the starter (artwork, no code). Standard Scratch: every sprite runs its own scripts; clones with
// "for this sprite only" variables; touching and touching color.
//   1  slimes: clones crawl along one of four lanes towards the castle
//   2  towers: click the tower in the shop and drag the new one onto the field (it snaps to a square); it costs coins
//   3  shooting: a tower makes clones of itself that are bolts, flying left along its lane
//   4  hits: a slime touching a bolt's colour loses health; destroyed slimes give coins; a slime at the castle costs a life
//   5  chewing and repair: a slime that reaches a tower stops and chews it; the Repair tool mends a tower
//   6  upgrades: Speed (shoots faster), Damage (red bolts, double), Pierce (bolts fly through), Strength (sturdier)
//   7  waves: tougher, faster slimes, and a boss every fifth wave
//
// The Tower sprite's clones have a role: "tower" (placed), "new" (being dragged in) or "bolt". A bolt is a clone of
// its tower, so it starts where the tower is and copies its upgrades (power, pierce).
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { art, TOWER_BASE, POWER_CORE, BOLT_CORE } from "./art.ts";

export const LAST = 7;
export const LANE_Y = [90, 30, -30, -90], COL0 = -210, SQUARE = 60, CASTLE_X = 185, START_X = -228, BAR_Y = -152;
export const SHOP_X = -205, TOOLS: [string, number][] = [["speed", 20], ["damage", 30], ["pierce", 30], ["strength", 15], ["repair", 10]];
export const TOOL_X = [-120, -60, 0, 60, 120], TOWER_COST = 25, BOUNTY = 10, DELAY = 0.7, FAST = 0.35;

export function slimeLanes(step: number): Buffer {
  const P = new Project();
  const at = (n: number) => step >= n;
  const when = <T>(n: number, xs: () => T[]): T[] => (at(n) ? xs() : []);

  // ---------------------------------------------------------------- Slime: crawls along a lane
  function slimeScripts(): Blocks {
    const B = new Blocks(P).local("health", "ouch", "speed");
    const d = dsl(B);
    const { v, add, sub, mul, eq, lt, gt, or, and, not, set, change, ifThen, ifElse, whenFlag, whenCloned, hide, show, goto, forever,
      cloneMyself, deleteClone, wait, random, until, changeX, xPos, touchingColor, costume, setSize, mod } = d;
    if (!at(1)) return B;
    // The Slime sprite stays hidden and sends out clones, each on a random lane (lane 1 is at the top).
    B.script(whenFlag(), [hide(), goto(START_X, 0),
      ...when(7, () => [set("wave", 1), set("spawned", 0)]),
      forever([
        wait(at(7) ? d.max(0.6, sub(3, mul(0.25, v("wave")))) : random(2, 3.5)),
        d.setY(sub(LANE_Y[0], mul(SQUARE, random(0, 3)))),
        ...when(7, () => [
          // Every 8 slimes: the next wave. Each wave the slimes are tougher and faster; a boss every fifth wave.
          change("spawned", 1), ifThen(eq(mod(v("spawned"), 8), 0), [change("wave", 1)]),
        ]),
        cloneMyself(),
      ])], 20, 20);
    B.script(whenCloned(), [
      set("health", 3), set("ouch", 0), set("speed", 0.6), costume("green"),
      ...when(7, () => [
        set("health", add(1, mul(2, v("wave")))), set("speed", d.min(1.6, add(0.4, mul(0.12, v("wave"))))),
        ifThen(gt(v("wave"), 2), [costume("blue")]), ifThen(gt(v("wave"), 4), [costume("purple")]),
        ifThen(and(eq(mod(v("wave"), 5), 0), eq(mod(v("spawned"), 8), 1)), [costume("boss"), set("health", mul(12, v("wave"))), set("speed", 0.35)]),
      ]),
      show(),
      until(gt(xPos(), CASTLE_X), [
        // Chewing a tower (its stone colour): stop. Otherwise crawl on.
        ...(at(5) ? [ifElse(touchingColor(TOWER_BASE), [], [changeX(v("speed"))])] : [changeX(v("speed"))]),
        ...when(4, () => [
          // Hit by a bolt: red ones hurt twice as much. A short "ouch" so one bolt counts once.
          ifThen(gt(v("ouch"), 0), [change("ouch", -1)]),
          ifThen(and(eq(v("ouch"), 0), or(touchingColor(BOLT_CORE), touchingColor(POWER_CORE))), [
            ifElse(touchingColor(POWER_CORE), [change("health", -2)], [change("health", -1)]), set("ouch", 6),
            ifThen(not(gt(v("health"), 0)), [change("coins", BOUNTY), deleteClone()]),
          ]),
        ]),
      ]),
      // Through the castle wall: a life.
      ...when(4, () => [change("lives", -1)]),
      deleteClone(),
    ], 20, 300);
    void lt; void setSize;
    return B;
  }

  // ---------------------------------------------------------------- Tower: the shop, placed towers and their bolts
  function towerScripts(): Blocks {
    const B = new Blocks(P).local("role", "hp", "maxhp", "delay", "power", "pierce");
    const d = dsl(B);
    const { v, add, sub, mul, div, eq, lt, gt, or, and, not, set, change, ifThen, ifElse, whenFlag, whenCloned, whenClicked, show, goto,
      goTo, forever, cloneMyself, deleteClone, wait, until, changeX, setX, setY, xPos, yPos, round, touching, costume, mouseDown,
      sayFor, setSize, changeSize, join, cond, max, min } = d;
    if (!at(2)) return B;
    // The original is the shop: it sits in the toolbar.
    B.script(whenFlag(), [set("role", "shop"), goto(SHOP_X, BAR_Y), costume("tower"), setSize(80), show(),
      set("coins", 100), ...when(5, () => [set("tool", "")]),
      // Lives: set first, then wait for them to run out (in the same script, so nothing reads an old value).
      ...when(4, () => [set("lives", 5), d.waitUntil(eq(v("lives"), 0)),
        sayFor(at(7) ? join("The slimes got in! You reached wave ", v("wave")) : "The slimes got in!", 3), d.stopAll()]),
    ], 20, 20);
    const look = () => [ifElse(lt(v("hp"), div(v("maxhp"), 2)), [costume("cracked")], [costume("tower")])];
    // Click the shop: a new tower to drag (if you have the coins).
    B.script(whenClicked(), [
      ifThen(eq(v("role"), "shop"), [ifElse(not(lt(v("coins"), TOWER_COST)), [set("role", "new"), setSize(100), cloneMyself(), set("role", "shop"), setSize(80)],
        [sayFor(join(TOWER_COST, " coins for a tower"), 1)])]),
      // Click a placed tower with a tool: from step 5.
      ...when(5, () => [ifThen(eq(v("role"), "tower"), [cond([
        [and(eq(v("tool"), "repair"), and(lt(v("hp"), v("maxhp")), not(lt(v("coins"), 10)))), [set("hp", v("maxhp")), change("coins", -10), ...look()]],
        ...(at(6) ? [
          [and(eq(v("tool"), "speed"), and(gt(v("delay"), FAST), not(lt(v("coins"), 20)))), [set("delay", FAST), change("coins", -20), changeSize(8)]],
          [and(eq(v("tool"), "damage"), and(eq(v("power"), 1), not(lt(v("coins"), 30)))), [set("power", 2), change("coins", -30), changeSize(8)]],
          [and(eq(v("tool"), "pierce"), and(eq(v("pierce"), 0), not(lt(v("coins"), 30)))), [set("pierce", 1), change("coins", -30), changeSize(8)]],
          [and(eq(v("tool"), "strength"), and(eq(v("maxhp"), 20), not(lt(v("coins"), 15)))), [set("maxhp", 40), change("hp", 20), change("coins", -15), changeSize(8), ...look()]],
        ] as any : []),
      ])])]),
    ], 20, 200);
    B.script(whenCloned(), [
      ifThen(eq(v("role"), "new"), [
        // Follow the mouse while the button is held, then snap to the nearest square.
        until(not(mouseDown()), [goTo("_mouse_")]),
        setX(add(mul(round(div(sub(xPos(), COL0), SQUARE)), SQUARE), COL0)), setY(add(mul(round(div(sub(yPos(), LANE_Y[3]), SQUARE)), SQUARE), LANE_Y[3])),
        // Not on the field, or on another tower: it goes back to the shop.
        ifThen(or(or(lt(yPos(), LANE_Y[3] - 5), gt(yPos(), LANE_Y[0] + 5)), or(gt(xPos(), 150), touching("Tower"))), [deleteClone()]),
        change("coins", -TOWER_COST), set("role", "tower"), set("hp", 20), set("maxhp", 20), set("delay", DELAY), set("power", 1), set("pierce", 0),
        ...when(3, () => [forever([
          // Shoot: become a bolt for a moment, make a clone (it copies power and pierce), and turn back.
          wait(v("delay")),
          set("role", "bolt"), ifElse(eq(v("power"), 2), [costume("power")], [costume("bolt")]), cloneMyself(), set("role", "tower"), ...look(),
        ])]),
      ]),
      ifThen(eq(v("role"), "bolt"), [
        changeX(-24),
        until(lt(xPos(), -235), [changeX(-8),
          // A bolt stops at the first slime, unless it pierces.
          ...when(4, () => [ifThen(and(touching("Slime"), eq(v("pierce"), 0)), [wait(0.05), deleteClone()])])]),
        deleteClone(),
      ]),
    ], 20, 700);
    // A placed tower being chewed loses health; at 0 it is gone.
    if (at(5)) B.script(whenCloned(), [ifThen(eq(v("role"), "new"), [
      until(eq(v("role"), "tower"), [wait(0.1)]),
      forever([ifThen(touching("Slime"), [change("hp", -1), ...look(), ifThen(not(gt(v("hp"), 0)), [deleteClone()])]), wait(0.25)]),
    ])], 20, 1500);
    void cond; void max; void min; void gt; void mouseDown; void touching;
    return B;
  }

  // ---------------------------------------------------------------- Tools: pick one, then click a tower
  function toolScripts(): Blocks {
    const B = new Blocks(P).local("name", "price");
    const d = dsl(B);
    const { v, eq, set, whenFlag, whenCloned, whenClicked, hide, show, goto, cloneMyself, costume, sayFor, join, ifThen, ifElse } = d;
    if (!at(5)) return B;
    const tools = TOOLS.map((t, i) => [...t, TOOL_X[i]] as [string, number, number]).filter(([n]) => at(6) || n === "repair");
    B.script(whenFlag(), [hide(), set("name", ""),
      ...tools.flatMap(([n, price, x]) => [set("name", n), set("price", price), goto(x, BAR_Y), costume(n), cloneMyself()])], 20, 20);
    B.script(whenCloned(), [show()], 20, 300);
    // Click: this is the tool now (click it again to put it down).
    B.script(whenClicked(), [ifElse(eq(v("tool"), v("name")), [set("tool", "")], [set("tool", v("name")), sayFor(join(join(v("name"), ": "), join(v("price"), " coins")), 1)])], 20, 400);
    void ifThen;
    return B;
  }
  function ringScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    if (!at(5)) return B;
    const { v, eq, whenFlag, forever, hide, show, ifElse, setX, setY } = d;
    B.script(whenFlag(), [hide(), setY(BAR_Y), forever([
      ...TOOLS.map(([n], i) => d.ifThen(eq(v("tool"), n), [setX(TOOL_X[i])])),
      ifElse(eq(v("tool"), ""), [hide()], [show()])])], 20, 20);
    return B;
  }
  const A = art(P);
  return P.build({
    backdrop: A.backdrop,
    sprites: [
      P.sprite("Slime", { blocks: slimeScripts(), costumes: A.slime, layer: 1, visible: false }),
      P.sprite("Tower", { blocks: towerScripts(), costumes: A.tower, layer: 2, visible: at(2), x: SHOP_X, y: BAR_Y }),
      P.sprite("Tool", { blocks: toolScripts(), costumes: A.tool, layer: 3, visible: false }),
      P.sprite("Ring", { blocks: ringScripts(), costumes: A.ring, layer: 4, visible: false }),
    ],
    shown: ["coins", ...(at(4) ? ["lives"] : []), ...(at(7) ? ["wave"] : [])].filter(n => at(2) || n !== "coins"),
  });
}
