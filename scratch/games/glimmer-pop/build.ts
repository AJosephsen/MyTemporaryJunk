// Builds glimmer-pop.sb3: an original bubble-shooter for Scratch 3.
//
// The board is a hex grid of 12 rows x 8 columns, stored in the list `grid` (index = row * 8 + col + 1;
// 0 = empty, 1-6 = colour). Odd rows are shifted half a bubble to the right and use only 7 columns.
// Every grid cell is a clone of the Board sprite that shows its colour, so the board stays crisp at any size.
//
// Phases (broadcasts): setup (and wait) -> new level -> ready -> tick ... (the Board flies and settles the shot) -> redraw,
// level clear -> new level, game over -> restart. The Stage broadcasts `tick` once per frame.
// All loops that must finish within a frame live in custom blocks that run without screen refresh.
//
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl, type Ref, type In } from "../../lib/sb3.ts";
import { art, GEOM } from "./art.ts";

const P = new Project();
const { cols: COLS, rows: ROWS, d: D, rowH: ROW_H } = GEOM;
const CELLS = COLS * ROWS;
const WALL = GEOM.right - D / 2;     // the shot's centre bounces at +-105
const SHOT_SPEED = 14;               // pixels per frame
const SUBSTEPS = 4;                  // collision checks per frame
const HIT = Math.round(GEOM.d * 0.9); // centre distance that counts as touching a bubble
const AIM_LIMIT = 78;                // degrees either side of straight up
const NEXT = GEOM.next;
const LEFT_CENTRE = Math.round((-228 + GEOM.left - 10) / 2);   // centre of the left panels
const SCORE_RIGHT = GEOM.left - 32;                            // the score's last digit

// ---------------------------------------------------------------- clicks
// A quick click or tap can start and end between two frames, so "mouse down?" can miss it. Click events
// cannot: every sprite (and the Stage) notes the click, and the Shooter fires on the next frame.
const noteClicks = (B: Blocks, stage = false) => {
  const d = dsl(B);
  B.script(stage ? d.whenStageClicked() : d.whenClicked(), [d.set("clicked", 1)], 900, 1800);
};

// ---------------------------------------------------------------- helpers that build block expressions
type D = ReturnType<typeof dsl>;

// ---------------------------------------------------------------- Stage: the clock
function stageScripts(): Blocks {
  const B = new Blocks(P);
  const { set, whenFlag, whenReceive, broadcast, broadcastWait, forever } = dsl(B);
  B.script(whenFlag(), [broadcastWait("setup"), broadcast("new level"), forever([broadcast("tick")])]);
  B.script(whenReceive("setup"), [
    set("score", 0), set("shownScore", 0), set("level", 1), set("state", "wait"), set("topY", GEOM.top),
  ]);
  B.script(whenReceive("restart"), [broadcastWait("setup"), broadcast("new level")]);
  noteClicks(B, true);
  return B;
}

// ---------------------------------------------------------------- Board: grid logic, the flying shot, and one clone per cell
// All grid work goes through two shared custom blocks:
//   locate      cell ci -> its row cr, column cc and position cx, cy
//   neighbours  cell ci -> the list nbrs of the (up to 6) cells around it
function boardScripts(): Blocks {
  const B = new Blocks(P).local("idx", "myRow", "myX", "isClone");
  const d = dsl(B);
  const { v, add, sub, mul, lt, gt, eq, and, or, not, floor, mod, random, item, length, set, change, replace, addTo,
    deleteAll, deleteOf, repeat, until, ifThen, ifElse, define, call, whenReceive, whenCloned, cloneMyself,
    deleteClone, hide, show, goto, costumeTo, broadcast } = d;
  const rowY = (row: In) => sub(sub(v("topY"), D / 2), mul(row, ROW_H));
  // Runs `body` once for every cell, with ci = 1, 2, ... CELLS.
  const forEachCell = (body: Ref[]) => [set("ci", 1), repeat(CELLS, [...body, change("ci", 1)])];
  // Runs `body` for every neighbour n of cell ci.
  const forEachNeighbour = (body: Ref[]) => [
    call("neighbours"), set("k", 1),
    repeat(length("nbrs"), [set("n", item("nbrs", v("k"))), ...body, change("k", 1)]),
  ];
  const clearList = (list: string, count: number) => [deleteAll(list), repeat(count, [addTo(list, 0)])];

  // ---- setup: one clone per cell, each knowing its row and x
  B.script(whenReceive("setup"), [
    ifElse(eq(v("isClone"), 1), [deleteClone()], [hide(), call("make cells")]),
  ], 20, 20);
  define("make cells", [
    set("idx", 1),
    repeat(CELLS, [
      set("ci", v("idx")), call("locate"), set("myRow", v("cr")), set("myX", v("cx")),
      cloneMyself(), change("idx", 1),
    ]),
  ], { warp: true, x: 20, y: 160 });
  B.script(whenCloned(), [set("isClone", 1), hide()], 20, 320);

  // ---- each cell shows its colour; its height follows the ceiling
  B.script(whenReceive("redraw"), [
    ifThen(eq(v("isClone"), 1), [
      ifElse(gt(item("grid", v("idx")), 0), [
        costumeTo(item("grid", v("idx"))), goto(v("myX"), rowY(v("myRow"))), show(),
      ], [hide()]),
    ]),
  ], 20, 420);

  // ---- new level
  B.script(whenReceive("new level"), [
    ifThen(eq(v("isClone"), 0), [
      set("topY", GEOM.top),
      set("ceilingShots", sub(9, v("level"))), ifThen(lt(v("ceilingShots"), 4), [set("ceilingShots", 4)]),
      set("shotsLeft", v("ceilingShots")),
      call("fill level"),
      call("pick next"), set("shotColor", v("nextColor")), call("pick next"),
      set("state", "ready"),
      broadcast("redraw"), broadcast("ready"),
    ]),
  ], 20, 640);

  // ---- the shot flies on every tick (the Shooter sets state "fly", shotX/Y and vx/vy)
  B.script(whenReceive("tick"), [ifThen(and(eq(v("isClone"), 0), eq(v("state"), "fly")), [call("fly")])], 20, 900);

  // ---------------------------------------------------------------- shared blocks
  define("locate", [
    set("cr", floor(d.div(sub(v("ci"), 1), COLS))), set("cc", mod(sub(v("ci"), 1), COLS)),
    set("cx", add(add(GEOM.left + D / 2, mul(v("cc"), D)), mul(mod(v("cr"), 2), D / 2))),
    set("cy", rowY(v("cr"))),
  ], { warp: true, x: 520, y: 20 });

  // A cell exists if it is on the board; odd rows (shifted right) have only 7 cells.
  define("check cell", [
    set("ok", 0),
    ifThen(and(and(not(lt(v("tr"), 0)), lt(v("tr"), ROWS)), and(not(lt(v("tc"), 0)), lt(v("tc"), COLS))), [
      ifThen(not(and(eq(mod(v("tr"), 2), 1), eq(v("tc"), COLS - 1))), [set("ok", 1)]),
    ]),
  ], { warp: true, x: 520, y: 260 });

  define("neighbours", [
    deleteAll("nbrs"), call("locate"),
    // same row: c-1 and c+1; rows above and below: (c-1, c) on even rows, (c, c+1) on odd rows
    set("shift", mod(v("cr"), 2)),
    ...[[0, -1, 0], [0, 1, 0], [-1, -1, 1], [-1, 0, 1], [1, -1, 1], [1, 0, 1]].flatMap(([dr, dc, useShift]) => [
      set("tr", add(v("cr"), dr)),
      set("tc", useShift ? add(add(v("cc"), v("shift")), dc) : add(v("cc"), dc)),
      call("check cell"),
      ifThen(eq(v("ok"), 1), [addTo("nbrs", add(add(mul(v("tr"), COLS), v("tc")), 1))]),
    ]),
  ], { warp: true, x: 520, y: 480 });

  // ---------------------------------------------------------------- level
  // Fills the top rows with a left-right symmetric pattern; colours often repeat their left neighbour.
  define("fill level", [
    ...clearList("grid", CELLS),
    set("colors", add(3, floor(d.div(v("level"), 2)))), ifThen(gt(v("colors"), 6), [set("colors", 6)]),
    set("fillRows", add(4, v("level"))), ifThen(gt(v("fillRows"), 10), [set("fillRows", 10)]),
    ...forEachCell([
      call("locate"),
      // mirror column: 7 - c on even rows, 6 - c on odd rows
      set("tr", v("cr")), set("tc", sub(sub(COLS - 1, mod(v("cr"), 2)), v("cc"))),
      call("check cell"),
      ifThen(and(and(lt(v("cr"), v("fillRows")), eq(v("ok"), 1)), not(gt(v("cc"), v("tc")))), [
        ifThen(or(eq(v("cc"), 0), eq(random(1, 2), 1)), [set("prevColor", random(1, v("colors")))]),
        replace("grid", v("ci"), v("prevColor")),
        replace("grid", add(add(mul(v("tr"), COLS), v("tc")), 1), v("prevColor")),
      ]),
    ]),
    call("count colours"),
  ], { warp: true, x: 1000, y: 20 });

  define("count colours", [
    ...clearList("colorCount", 6),
    ...forEachCell([
      ifThen(gt(item("grid", v("ci")), 0), [
        replace("colorCount", item("grid", v("ci")), add(item("colorCount", item("grid", v("ci"))), 1)),
      ]),
    ]),
  ], { warp: true, x: 1000, y: 520 });

  // The next shot colour is one of the colours still on the board.
  define("pick next", [
    set("nextColor", random(1, 6)), set("tries", 0),
    until(or(gt(item("colorCount", v("nextColor")), 0), gt(v("tries"), 60)), [
      set("nextColor", random(1, 6)), change("tries", 1),
    ]),
    ifThen(eq(item("colorCount", v("nextColor")), 0), [set("nextColor", random(1, v("colors")))]),
  ], { warp: true, x: 1000, y: 720 });

  // ---------------------------------------------------------------- flight
  // Small steps; bounce off the side walls; stop at the ceiling or next to a bubble.
  define("fly", [
    repeat(SUBSTEPS, [
      ifThen(eq(v("state"), "fly"), [
        change("shotX", v("vx")), change("shotY", v("vy")),
        ifThen(gt(v("shotX"), WALL), [set("shotX", sub(2 * WALL, v("shotX"))), set("vx", mul(v("vx"), -1))]),
        ifThen(lt(v("shotX"), -WALL), [set("shotX", sub(-2 * WALL, v("shotX"))), set("vx", mul(v("vx"), -1))]),
        ifElse(gt(v("shotY"), sub(v("topY"), D / 2)), [call("land")], [
          ...forEachCell([
            ifThen(and(eq(v("state"), "fly"), gt(item("grid", v("ci")), 0)), [
              call("distance"), ifThen(lt(v("dist"), HIT * HIT), [call("land")]),
            ]),
          ]),
        ]),
      ]),
    ]),
  ], { warp: true, x: 1500, y: 20 });

  // dist = squared distance from the shot to cell ci
  define("distance", [
    call("locate"),
    set("dist", add(mul(sub(v("shotX"), v("cx")), sub(v("shotX"), v("cx"))), mul(sub(v("shotY"), v("cy")), sub(v("shotY"), v("cy"))))),
  ], { warp: true, x: 1500, y: 420 });

  // Snaps to the nearest empty cell that touches the ceiling or a bubble, then settles the board.
  define("land", [
    set("bestD", 1e9), set("landIdx", 0),
    ...forEachCell([
      set("tr", floor(d.div(sub(v("ci"), 1), COLS))), set("tc", mod(sub(v("ci"), 1), COLS)), call("check cell"),
      ifThen(and(eq(item("grid", v("ci")), 0), eq(v("ok"), 1)), [
        call("distance"),
        ifThen(lt(v("dist"), v("bestD")), [
          set("attached", 0),
          ifThen(eq(v("cr"), 0), [set("attached", 1)]),
          ...forEachNeighbour([ifThen(gt(item("grid", v("n")), 0), [set("attached", 1)])]),
          ifThen(eq(v("attached"), 1), [set("bestD", v("dist")), set("landIdx", v("ci"))]),
        ]),
      ]),
    ]),
    set("state", "settle"),
    call("settle"),
  ], { warp: true, x: 1500, y: 620 });

  // ---------------------------------------------------------------- settle
  // Places the shot, pops a group of 3+, drops loose bubbles, moves the ceiling, then decides what's next.
  define("settle", [
    replace("grid", v("landIdx"), v("shotColor")),
    // 1. the group of the same colour, by flood fill from the new bubble
    ...clearList("seen", CELLS), deleteAll("queue"), deleteAll("group"),
    addTo("queue", v("landIdx")), replace("seen", v("landIdx"), 1),
    until(eq(length("queue"), 0), [
      set("ci", item("queue", 1)), deleteOf("queue", 1), addTo("group", v("ci")),
      ...forEachNeighbour([
        ifThen(and(eq(item("seen", v("n")), 0), eq(item("grid", v("n")), v("shotColor"))), [
          replace("seen", v("n"), 1), addTo("queue", v("n")),
        ]),
      ]),
    ]),
    set("popped", 0), set("dropped", 0),
    ifThen(gt(length("group"), 2), [
      set("k2", 1),
      repeat(length("group"), [
        set("ci", item("group", v("k2"))), set("fxKind", "pop"), call("queue fx"),
        replace("grid", v("ci"), 0), change("popped", 1), change("k2", 1),
      ]),
      call("drop loose"),
    ]),
    change("score", add(mul(v("popped"), 10), mul(v("dropped"), 20))),
    call("count colours"),
    // 2. the ceiling comes down after every few shots
    change("shotsLeft", -1),
    ifThen(lt(v("shotsLeft"), 1), [change("topY", -ROW_H), set("shotsLeft", v("ceilingShots"))]),
    // 3. win, lose or carry on
    set("left", 0), set("lowest", 999),
    ...forEachCell([
      ifThen(gt(item("grid", v("ci")), 0), [
        change("left", 1), call("locate"), ifThen(lt(v("cy"), v("lowest")), [set("lowest", v("cy"))]),
      ]),
    ]),
    ifElse(eq(v("left"), 0), [
      change("score", 500), set("state", "clear"), broadcast("redraw"), broadcast("level clear"),
    ], [
      ifElse(lt(sub(v("lowest"), D / 2), GEOM.danger), [
        set("state", "over"), broadcast("redraw"), broadcast("game over"),
      ], [
        set("shotColor", v("nextColor")),
        ifThen(eq(item("colorCount", v("shotColor")), 0), [call("pick next"), set("shotColor", v("nextColor"))]),
        call("pick next"),
        set("state", "aim"), broadcast("redraw"),
      ]),
    ]),
  ], { warp: true, x: 2000, y: 20 });

  // Every bubble that no longer hangs from the ceiling (through other bubbles) falls.
  define("drop loose", [
    ...clearList("seen", CELLS), deleteAll("queue"),
    set("ci", 1),
    repeat(COLS, [
      ifThen(gt(item("grid", v("ci")), 0), [addTo("queue", v("ci")), replace("seen", v("ci"), 1)]),
      change("ci", 1),
    ]),
    until(eq(length("queue"), 0), [
      set("ci", item("queue", 1)), deleteOf("queue", 1),
      ...forEachNeighbour([
        ifThen(and(eq(item("seen", v("n")), 0), gt(item("grid", v("n")), 0)), [
          replace("seen", v("n"), 1), addTo("queue", v("n")),
        ]),
      ]),
    ]),
    ...forEachCell([
      ifThen(and(gt(item("grid", v("ci")), 0), eq(item("seen", v("ci")), 0)), [
        set("fxKind", "fall"), call("queue fx"), replace("grid", v("ci"), 0), change("dropped", 1),
      ]),
    ]),
  ], { warp: true, x: 2000, y: 1300 });

  // Adds an effect request for cell ci; the Fx sprite turns requests into clones on its tick.
  define("queue fx", [
    call("locate"),
    addTo("fxKind", v("fxKind")), addTo("fxX", v("cx")), addTo("fxY", v("cy")), addTo("fxColor", item("grid", v("ci"))),
  ], { warp: true, x: 1000, y: 900 });

  noteClicks(B);
  return B;
}

// ---------------------------------------------------------------- Shooter: aims and fires; shows the shot
function shooterScripts(): Blocks {
  const B = new Blocks(P);
  const d = dsl(B);
  const { v, sub, mul, div, lt, gt, eq, or, not, sin, cos, atan, set, change, ifThen, ifElse, define, call,
    whenReceive, key, mouseX, mouseY, goto, costumeTo, show, hide, broadcast, front, setSize } = d;

  B.script(whenReceive("setup"), [hide(), set("aimDir", 0), set("clicked", 0), set("fireWas", 0)], 20, 20);
  B.script(whenReceive("new level"), [goto(GEOM.launchX, GEOM.launchY), setSize(100), show(), front()], 20, 160);

  B.script(whenReceive("tick"), [
    call("read input"),
    ifThen(eq(v("state"), "aim"), [call("aim")]),
    ifThen(or(eq(v("state"), "aim"), eq(v("state"), "ready")), [goto(GEOM.launchX, GEOM.launchY), costumeTo(v("shotColor")), show()]),
    ifThen(eq(v("state"), "fly"), [goto(v("shotX"), v("shotY")), show()]),
    ifThen(not(or(or(eq(v("state"), "aim"), eq(v("state"), "ready")), eq(v("state"), "fly"))), [hide()]),
    ifThen(and_(d, eq(v("state"), "over"), eq(v("fire"), 1)), [set("state", "wait"), broadcast("restart")]),
  ], 20, 300);

  // fire = 1 on the frame after a click, or when Space or Up is pressed (not while held)
  define("read input", [
    set("fire", 0), set("fireByClick", 0),
    ifThen(eq(v("clicked"), 1), [set("fire", 1), set("fireByClick", 1), set("clicked", 0)]),
    ifThen(and_(d, or(key("space"), key("up arrow")), eq(v("fireWas"), 0)), [set("fire", 1)]),
    ifElse(or(key("space"), key("up arrow")), [set("fireWas", 1)], [set("fireWas", 0)]),
  ], { warp: true, x: 520, y: 20 });

  define("aim", [
    // The mouse aims when it moves or clicks; pointing at or below the launcher aims as far to that side as allowed.
    // Off the Stage, Scratch reports the mouse at the Stage's edge; that never aims.
    set("mouseOn", 0),
    ifThen(d.and(lt(d.abs(mouseX()), 239.5), lt(d.abs(mouseY()), 179.5)), [set("mouseOn", 1)]),
    // A click aims at the clicked spot before it shoots; Space, Up and the Shoot button keep the current aim.
    ifThen(d.and(eq(v("mouseOn"), 1), or(or(not(eq(mouseX(), v("lastMX"))), not(eq(mouseY(), v("lastMY")))), eq(v("fireByClick"), 1))), [
      set("aimDY", sub(mouseY(), GEOM.launchY)), ifThen(lt(v("aimDY"), 8), [set("aimDY", 8)]),
      set("aimDir", atan(div(sub(mouseX(), GEOM.launchX), v("aimDY")))),
    ]),
    set("lastMX", mouseX()), set("lastMY", mouseY()),
    ifThen(key("left arrow"), [change("aimDir", -2.5)]),
    ifThen(key("right arrow"), [change("aimDir", 2.5)]),
    ifThen(gt(v("aimDir"), AIM_LIMIT), [set("aimDir", AIM_LIMIT)]),
    ifThen(lt(v("aimDir"), -AIM_LIMIT), [set("aimDir", -AIM_LIMIT)]),
    ifThen(eq(v("fire"), 1), [
      set("shotX", GEOM.launchX), set("shotY", GEOM.launchY),
      set("vx", mul(sin(v("aimDir")), SHOT_SPEED / SUBSTEPS)),
      set("vy", mul(cos(v("aimDir")), SHOT_SPEED / SUBSTEPS)),
      set("state", "fly"),
    ]),
  ], { warp: true, x: 520, y: 400 });

  noteClicks(B);
  return B;
}
const and_ = (d: D, a: Ref, b: Ref) => d.and(a, b);

// ---------------------------------------------------------------- Aim guide, next bubble, ceiling
function guideScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenReceive("tick"), [
    // The guide is drawn pointing up, which Scratch shows at direction 90; so aim 0 (straight up) is direction 90.
    d.ifElse(d.eq(d.v("state"), "aim"), [d.goto(GEOM.launchX, GEOM.launchY), d.point(d.add(d.v("aimDir"), 90)), d.show()], [d.hide()]),
  ]);
  noteClicks(B);
  return B;
}
function nextScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenReceive("tick"), [
    d.ifElse(d.eq(d.v("state"), "over"), [d.hide()], [d.goto(NEXT.x, NEXT.y), d.costumeTo(d.v("nextColor")), d.show()]),
  ]);
  noteClicks(B);
  return B;
}
function ceilingScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenReceive("tick"), [d.goto(0, d.v("topY"))]);
  noteClicks(B);
  return B;
}

// ---------------------------------------------------------------- HUD: score, level and ceiling pips (clones)
function hudScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "slot", "kind");
  const d = dsl(B);
  const { v, add, sub, mul, lt, gt, eq, not, set, change, repeat, ifThen, ifElse, define, call,
    whenReceive, whenCloned, cloneMyself, deleteClone, hide, show, goto, costume, costumeTo, round, ceiling,
    letterOf, textLength } = d;

  B.script(whenReceive("setup"), [
    ifElse(eq(v("isClone"), 1), [deleteClone()], [hide(), call("make hud")]),
  ], 20, 20);
  define("make hud", [
    set("kind", "score"), set("slot", 1), repeat(6, [cloneMyself(), change("slot", 1)]),
    set("kind", "level"), set("slot", 1), repeat(2, [cloneMyself(), change("slot", 1)]),
    set("kind", "pip"), set("slot", 1), repeat(8, [cloneMyself(), change("slot", 1)]),
  ], { warp: true, x: 20, y: 160 });
  B.script(whenCloned(), [set("isClone", 1), hide()], 20, 360);

  B.script(whenReceive("tick"), [
    ifElse(eq(v("isClone"), 0), [
      // the score counts up smoothly
      ifThen(lt(v("shownScore"), v("score")), [change("shownScore", ceiling(d.div(sub(v("score"), v("shownScore")), 6)))]),
      ifThen(gt(v("shownScore"), v("score")), [set("shownScore", v("score"))]),
    ], [call("show slot")]),
  ], 20, 460);

  // Slot 1 is the rightmost digit for the score; the level number is centred.
  define("show slot", [
    ifThen(eq(v("kind"), "score"), [
      set("text", round(v("shownScore"))),
      ifElse(not(gt(v("slot"), textLength(v("text")))), [
        costumeTo(add(letterOf(add(sub(textLength(v("text")), v("slot")), 1), v("text")), 1)),
        goto(sub(SCORE_RIGHT, mul(sub(v("slot"), 1), 18)), 112), show(),
      ], [hide()]),
    ]),
    ifThen(eq(v("kind"), "level"), [
      set("text", v("level")),
      ifElse(not(gt(v("slot"), textLength(v("text")))), [
        costumeTo(add(letterOf(v("slot"), v("text")), 1)),
        goto(add(sub(LEFT_CENTRE, mul(sub(textLength(v("text")), 1), 9)), mul(sub(v("slot"), 1), 18)), 32), show(),
      ], [hide()]),
    ]),
    ifThen(eq(v("kind"), "pip"), [
      ifElse(not(gt(v("slot"), v("ceilingShots"))), [
        ifElse(not(gt(v("slot"), v("shotsLeft"))), [costume("pip on")], [costume("pip off")]),
        goto(add(sub(NEXT.x, mul(sub(v("ceilingShots"), 1), 5.5)), mul(sub(v("slot"), 1), 11)), 24), show(),
      ], [hide()]),
    ]),
  ], { warp: true, x: 520, y: 20 });
  noteClicks(B);
  return B;
}

// ---------------------------------------------------------------- Fx: pops, rings, sparks and falling bubbles
function fxScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "kind", "vx2", "vy2", "life", "color");
  const d = dsl(B);
  const { v, add, sub, mul, div, lt, gt, eq, or, random, item, length, set, change, deleteOf, deleteAll, repeat,
    ifThen, ifElse, define, call, whenReceive, whenCloned, cloneMyself, deleteClone, hide, show, goto, costume,
    costumeTo, setSize, changeSize, setEffect, changeEffect, changeX, changeY, turn, yPos, front } = d;

  B.script(whenReceive("setup"), [
    ifElse(eq(v("isClone"), 1), [deleteClone()], [
      hide(), set("fxCount", 0), deleteAll("fxKind"), deleteAll("fxX"), deleteAll("fxY"), deleteAll("fxColor"),
    ]),
  ], 20, 20);
  B.script(whenReceive("new level"), [ifThen(eq(v("isClone"), 1), [change("fxCount", -1), deleteClone()])], 20, 160);

  B.script(whenReceive("tick"), [
    ifElse(eq(v("isClone"), 1), [call("update fx")], [ifThen(gt(length("fxKind"), 0), [call("spawn fx")])]),
  ], 20, 260);

  // Turns each queued request into clones: a pop gets a swelling bubble, a ring and three sparks.
  define("spawn fx", [
    repeat(length("fxKind"), [
      goto(item("fxX", 1), item("fxY", 1)), set("color", item("fxColor", 1)),
      ifElse(eq(item("fxKind", 1), "pop"), [
        set("kind", "pop"), set("life", 9), cloneMyself(),
        // rings and sparks are extras: skipped when many effects are already running (Scratch allows 300 clones)
        ifThen(lt(v("fxCount"), 140), [
          set("kind", "ring"), set("life", 10), cloneMyself(),
          set("kind", "spark"),
          repeat(3, [
            set("life", random(10, 16)), set("vx2", div(random(-40, 40), 10)), set("vy2", div(random(-10, 45), 10)),
            cloneMyself(),
          ]),
        ]),
      ], [
        set("kind", "fall"), set("life", 90), set("vx2", div(random(-25, 25), 10)), set("vy2", div(random(10, 35), 10)),
        cloneMyself(),
      ]),
      deleteOf("fxKind", 1), deleteOf("fxX", 1), deleteOf("fxY", 1), deleteOf("fxColor", 1),
    ]),
  ], { warp: true, x: 520, y: 20 });

  B.script(whenCloned(), [
    set("isClone", 1), change("fxCount", 1), setSize(100), setEffect("GHOST", 0),
    ifThen(or(eq(v("kind"), "pop"), eq(v("kind"), "fall")), [costumeTo(v("color"))]),
    ifThen(eq(v("kind"), "ring"), [costume("ring"), setSize(60)]),
    ifThen(eq(v("kind"), "spark"), [costume("spark"), setSize(random(80, 140))]),
    front(), show(),
  ], 20, 520);

  define("update fx", [
    change("life", -1),
    ifThen(eq(v("kind"), "pop"), [changeSize(7), changeEffect("GHOST", 11)]),
    ifThen(eq(v("kind"), "ring"), [changeSize(12), changeEffect("GHOST", 10)]),
    ifThen(eq(v("kind"), "spark"), [
      changeX(v("vx2")), changeY(v("vy2")), change("vy2", -0.35), turn(15), changeSize(-6), changeEffect("GHOST", 6),
    ]),
    ifThen(eq(v("kind"), "fall"), [
      changeX(v("vx2")), changeY(v("vy2")), change("vy2", -0.55), turn(mul(v("vx2"), 3)),
      ifThen(lt(yPos(), -120), [changeEffect("GHOST", 8)]),
      ifThen(lt(yPos(), -200), [set("life", 0)]),
    ]),
    ifThen(lt(v("life"), 1), [change("fxCount", -1), deleteClone()]),
  ], { warp: true, x: 520, y: 700 });
  void add; void sub; void gt; void show; void hide;
  noteClicks(B);
  return B;
}

// ---------------------------------------------------------------- Banner: Ready, Board clear, Game over
function bannerScripts(): Blocks {
  const B = new Blocks(P);
  const { v, set, change, whenReceive, hide, show, goto, costume, setSize, changeSize, setEffect, changeEffect,
    repeat, wait, broadcast, front } = dsl(B);
  const popIn = (name: string) => [
    goto(0, 10), costume(name), setSize(60), setEffect("GHOST", 100), front(), show(),
    repeat(8, [changeSize(5), changeEffect("GHOST", -12.5)]),
  ];
  const fadeOut = () => [repeat(6, [changeSize(-3), changeEffect("GHOST", 17)]), hide()];
  B.script(whenReceive("setup"), [hide()], 20, 20);
  B.script(whenReceive("ready"), [...popIn("ready"), wait(1.1), ...fadeOut(), set("state", "aim")], 20, 120);
  B.script(whenReceive("level clear"), [...popIn("clear"), wait(1.6), ...fadeOut(), change("level", 1), broadcast("new level")], 20, 420);
  B.script(whenReceive("game over"), [...popIn("over")], 20, 720);
  void v;
  noteClicks(B);
  return B;
}

// ---------------------------------------------------------------- project
const A = art(P);
const sb3 = P.build({
  backdrop: A.backdrop,
  stage: stageScripts(),
  sprites: [
    P.sprite("Board", { blocks: boardScripts(), costumes: A.bubbles, layer: 1, visible: false }),
    P.sprite("Ceiling", { blocks: ceilingScripts(), costumes: A.ceiling, layer: 2, y: GEOM.top }),
    P.sprite("Next", { blocks: nextScripts(), costumes: A.bubbles, layer: 3, x: NEXT.x, y: NEXT.y }),
    P.sprite("Hud", { blocks: hudScripts(), costumes: A.hud, layer: 4, visible: false }),
    P.sprite("Guide", { blocks: guideScripts(), costumes: A.guide, layer: 5, x: GEOM.launchX, y: GEOM.launchY, visible: false }),
    P.sprite("Shooter", { blocks: shooterScripts(), costumes: A.bubbles, layer: 6, x: GEOM.launchX, y: GEOM.launchY }),
    P.sprite("Fx", { blocks: fxScripts(), costumes: A.fx, layer: 7, visible: false }),
    P.sprite("Banner", { blocks: bannerScripts(), costumes: A.banner, layer: 8, visible: false }),
  ],
  shown: [],
});
writeFileSync(new URL("glimmer-pop.sb3", import.meta.url), sb3);
console.log(`glimmer-pop.sb3: ${sb3.length} bytes`);
