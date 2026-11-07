// Builds glimmer-pop.sb3: an original bubble-shooter for Scratch 3.
//
// The board is a hex grid of 12 rows x 8 columns, stored in the list `grid` (index = row * 8 + col + 1;
// 0 = empty, 1-6 = colour). Odd rows are shifted half a bubble to the right and use only 7 columns.
// Every grid cell is a clone of the Board sprite that shows its colour, so the board stays crisp at any size.
//
// Phases (broadcasts): setup (and wait) -> new level -> ready -> tick ... landed -> redraw,
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
const HIT = 27;                      // centre distance that counts as touching a bubble
const AIM_LIMIT = 78;                // degrees either side of straight up
const NEXT = { x: 178, y: 108 };

// ---------------------------------------------------------------- clicks
// A quick click or tap can start and end between two frames, so "mouse down?" can miss it. Click events
// cannot: every sprite (and the Stage) notes the click, and the Shooter fires on the next frame.
const noteClicks = (B: Blocks, stage = false) => {
  const d = dsl(B);
  B.script(stage ? d.whenStageClicked() : d.whenClicked(), [d.set("clicked", 1)], 900, 1800);
};

// ---------------------------------------------------------------- helpers that build block expressions
type D = ReturnType<typeof dsl>;
const rowOf = (d: D, idx: In) => d.floor(d.div(d.sub(idx, 1), COLS));
const colOf = (d: D, idx: In) => d.mod(d.sub(idx, 1), COLS);
const cellX = (d: D, row: In, col: In) => d.add(d.add(GEOM.left + D / 2, d.mul(col, D)), d.mul(d.mod(row, 2), D / 2));
const cellY = (d: D, row: In) => d.sub(d.sub(d.v("topY"), D / 2), d.mul(row, ROW_H));
const gte = (d: D, a: In, b: In) => d.not(d.lt(a, b));
const lte = (d: D, a: In, b: In) => d.not(d.gt(a, b));

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

// ---------------------------------------------------------------- Board: grid logic, and one clone per cell
function boardScripts(): Blocks {
  const B = new Blocks(P).local("idx", "myRow", "myCol", "isClone");
  const d = dsl(B);
  const { v, add, sub, mul, lt, gt, eq, and, or, not, floor, random, item, length, set, change, replace, addTo,
    deleteAll, deleteOf, repeat, until, ifThen, ifElse, define, call, whenReceive, whenCloned, cloneMyself,
    deleteClone, hide, show, goto, costumeTo, broadcast } = d;

  // ---- setup: make one clone per cell
  B.script(whenReceive("setup"), [
    ifElse(eq(v("isClone"), 1), [deleteClone()], [hide(), call("make cells")]),
  ], 20, 20);
  define("make cells", [
    set("idx", 1),
    repeat(CELLS, [
      set("myRow", rowOf(d, v("idx"))), set("myCol", colOf(d, v("idx"))),
      cloneMyself(), change("idx", 1),
    ]),
  ], { warp: true, x: 20, y: 160 });
  B.script(whenCloned(), [set("isClone", 1), hide()], 20, 320);

  // ---- each cell shows its colour at its place below the ceiling
  B.script(whenReceive("redraw"), [
    ifThen(eq(v("isClone"), 1), [
      ifElse(gt(item("grid", v("idx")), 0), [
        costumeTo(item("grid", v("idx"))),
        goto(cellX(d, v("myRow"), v("myCol")), cellY(d, v("myRow"))),
        show(),
      ], [hide()]),
    ]),
  ], 20, 420);

  // ---- new level
  B.script(whenReceive("new level"), [
    ifThen(eq(v("isClone"), 0), [
      set("topY", GEOM.top),
      set("ceilingShots", sub(9, v("level"))),
      ifThen(lt(v("ceilingShots"), 4), [set("ceilingShots", 4)]),
      set("shotsLeft", v("ceilingShots")),
      call("fill level"),
      call("pick next"), set("shotColor", v("nextColor")),
      call("pick next"),
      set("state", "ready"),
      broadcast("redraw"), broadcast("ready"),
    ]),
  ], 20, 640);

  // ---- a shot has landed (Shooter set landIdx and shotColor)
  B.script(whenReceive("landed"), [ifThen(eq(v("isClone"), 0), [call("settle")])], 20, 980);

  // ---------------------------------------------------------------- custom blocks (run without screen refresh)
  // Fills the top rows with a left-right symmetric pattern. Colours often repeat their left neighbour,
  // so the board has clusters to aim for.
  define("fill level", [
    deleteAll("grid"), repeat(CELLS, [addTo("grid", 0)]),
    deleteAll("colorCount"), repeat(6, [addTo("colorCount", 0)]),
    set("colors", add(3, floor(d.div(v("level"), 2)))), ifThen(gt(v("colors"), 6), [set("colors", 6)]),
    set("fillRows", add(4, v("level"))), ifThen(gt(v("fillRows"), 8), [set("fillRows", 8)]),
    set("tr", 0),
    repeat(v("fillRows"), [
      set("tc", 0), set("prevColor", random(1, v("colors"))),
      repeat(COLS, [
        // mirror column: 7 - c on even rows, 6 - c on odd rows (7 cells)
        set("mc", sub(sub(COLS - 1, d.mod(v("tr"), 2)), v("tc"))),
        ifThen(and(not(gt(v("tc"), v("mc"))), not(and(eq(d.mod(v("tr"), 2), 1), eq(v("tc"), COLS - 1)))), [
          // half the time a new colour, otherwise the same as the bubble to the left
          ifThen(eq(random(1, 2), 1), [set("prevColor", random(1, v("colors")))]),
          replace("grid", add(add(mul(v("tr"), COLS), v("tc")), 1), v("prevColor")),
          replace("grid", add(add(mul(v("tr"), COLS), v("mc")), 1), v("prevColor")),
        ]),
        change("tc", 1),
      ]),
      change("tr", 1),
    ]),
    call("count colours"),
  ], { warp: true, x: 520, y: 20 });

  define("count colours", [
    deleteAll("colorCount"), repeat(6, [addTo("colorCount", 0)]),
    set("ci", 1),
    repeat(CELLS, [
      ifThen(gt(item("grid", v("ci")), 0), [
        replace("colorCount", item("grid", v("ci")), add(item("colorCount", item("grid", v("ci"))), 1)),
      ]),
      change("ci", 1),
    ]),
  ], { warp: true, x: 520, y: 600 });

  // Picks the next shot colour from the colours still on the board.
  define("pick next", [
    set("nextColor", random(1, 6)), set("tries", 0),
    until(or(gt(item("colorCount", v("nextColor")), 0), gt(v("tries"), 60)), [
      set("nextColor", random(1, 6)), change("tries", 1),
    ]),
    ifThen(eq(item("colorCount", v("nextColor")), 0), [set("nextColor", random(1, v("colors")))]),
  ], { warp: true, x: 520, y: 760 });

  // Neighbours of cell ci on the hex grid -> list nbrs.
  define("neighbours", [
    deleteAll("nbrs"),
    set("nr", rowOf(d, v("ci"))), set("nc", colOf(d, v("ci"))),
    // the row above and below use columns (c-1, c) on even rows and (c, c+1) on odd rows
    set("shift", d.mod(v("nr"), 2)),
    set("tr", v("nr")), set("tc", sub(v("nc"), 1)), call("try cell"),
    set("tc", add(v("nc"), 1)), call("try cell"),
    set("tr", sub(v("nr"), 1)), set("tc", sub(add(v("nc"), v("shift")), 1)), call("try cell"),
    set("tc", add(v("nc"), v("shift"))), call("try cell"),
    set("tr", add(v("nr"), 1)), set("tc", sub(add(v("nc"), v("shift")), 1)), call("try cell"),
    set("tc", add(v("nc"), v("shift"))), call("try cell"),
  ], { warp: true, x: 1000, y: 20 });
  define("try cell", [
    ifThen(and(and(gte(d, v("tr"), 0), lt(v("tr"), ROWS)), and(gte(d, v("tc"), 0), lt(v("tc"), COLS))), [
      ifThen(not(and(eq(d.mod(v("tr"), 2), 1), eq(v("tc"), COLS - 1))), [
        addTo("nbrs", add(add(mul(v("tr"), COLS), v("tc")), 1)),
      ]),
    ]),
  ], { warp: true, x: 1000, y: 420 });

  // Places the shot, pops a group of 3+, drops loose bubbles, moves the ceiling, then decides what's next.
  define("settle", [
    replace("grid", v("landIdx"), v("shotColor")),
    // 1. the group of the same colour, by flood fill
    deleteAll("seen"), repeat(CELLS, [addTo("seen", 0)]),
    deleteAll("queue"), deleteAll("group"),
    addTo("queue", v("landIdx")), replace("seen", v("landIdx"), 1),
    until(eq(length("queue"), 0), [
      set("ci", item("queue", 1)), deleteOf("queue", 1), addTo("group", v("ci")),
      call("neighbours"),
      set("k", 1),
      repeat(length("nbrs"), [
        set("n", item("nbrs", v("k"))),
        ifThen(and(eq(item("seen", v("n")), 0), eq(item("grid", v("n")), v("shotColor"))), [
          replace("seen", v("n"), 1), addTo("queue", v("n")),
        ]),
        change("k", 1),
      ]),
    ]),
    set("popped", 0), set("dropped", 0),
    ifThen(gt(length("group"), 2), [
      set("k", 1),
      repeat(length("group"), [
        set("ci", item("group", v("k"))),
        set("fxKind", "pop"), call("queue fx"),
        replace("grid", v("ci"), 0), change("popped", 1), change("k", 1),
      ]),
      call("drop loose"),
    ]),
    change("score", add(mul(v("popped"), 10), mul(v("dropped"), 20))),
    call("count colours"),
    // 2. the ceiling comes down after every few shots
    change("shotsLeft", -1),
    ifThen(lt(v("shotsLeft"), 1), [change("topY", -ROW_H), set("shotsLeft", v("ceilingShots"))]),
    // 3. win, lose or carry on
    set("left", 0), set("lowest", 999), set("ci", 1),
    repeat(CELLS, [
      ifThen(gt(item("grid", v("ci")), 0), [
        change("left", 1),
        set("cy", cellY(d, rowOf(d, v("ci")))),
        ifThen(lt(v("cy"), v("lowest")), [set("lowest", v("cy"))]),
      ]),
      change("ci", 1),
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
  ], { warp: true, x: 1500, y: 20 });

  // Every bubble that no longer hangs from the ceiling (through other bubbles) falls.
  define("drop loose", [
    deleteAll("seen"), repeat(CELLS, [addTo("seen", 0)]),
    deleteAll("queue"),
    set("ci", 1),
    repeat(COLS, [
      ifThen(gt(item("grid", v("ci")), 0), [addTo("queue", v("ci")), replace("seen", v("ci"), 1)]),
      change("ci", 1),
    ]),
    until(eq(length("queue"), 0), [
      set("ci", item("queue", 1)), deleteOf("queue", 1),
      call("neighbours"),
      set("k", 1),
      repeat(length("nbrs"), [
        set("n", item("nbrs", v("k"))),
        ifThen(and(eq(item("seen", v("n")), 0), gt(item("grid", v("n")), 0)), [
          replace("seen", v("n"), 1), addTo("queue", v("n")),
        ]),
        change("k", 1),
      ]),
    ]),
    set("ci", 1),
    repeat(CELLS, [
      ifThen(and(gt(item("grid", v("ci")), 0), eq(item("seen", v("ci")), 0)), [
        set("fxKind", "fall"), call("queue fx"),
        replace("grid", v("ci"), 0), change("dropped", 1),
      ]),
      change("ci", 1),
    ]),
  ], { warp: true, x: 1500, y: 1400 });

  // Adds an effect request for cell ci; the Fx sprite turns requests into clones on the next tick.
  define("queue fx", [
    addTo("fxKind", v("fxKind")),
    addTo("fxX", cellX(d, rowOf(d, v("ci")), colOf(d, v("ci")))),
    addTo("fxY", cellY(d, rowOf(d, v("ci")))),
    addTo("fxColor", item("grid", v("ci"))),
  ], { warp: true, x: 1000, y: 700 });

  noteClicks(B);
  return B;
}

// ---------------------------------------------------------------- Shooter: aims, fires and flies
function shooterScripts(): Blocks {
  const B = new Blocks(P);
  const d = dsl(B);
  const { v, add, sub, mul, div, lt, gt, eq, and, or, not, sin, cos, abs, sqrt, atan, set, change, item, repeat,
    ifThen, ifElse, define, call, whenReceive, key, mouseDown, mouseX, mouseY, goto, costumeTo, show, hide,
    broadcast, front, setSize, xPos, yPos } = d;

  B.script(whenReceive("setup"), [hide(), set("aimDir", 0), set("clicked", 0), set("fireWas", 0)], 20, 20);
  B.script(whenReceive("new level"), [goto(GEOM.launchX, GEOM.launchY), setSize(100), show(), front()], 20, 160);

  B.script(whenReceive("tick"), [
    call("read input"),
    ifThen(eq(v("state"), "aim"), [call("aim")]),
    ifThen(or(eq(v("state"), "aim"), eq(v("state"), "ready")), [
      goto(GEOM.launchX, GEOM.launchY), costumeTo(v("shotColor")), show(),
    ]),
    ifThen(eq(v("state"), "fly"), [call("fly")]),
    ifThen(eq(v("state"), "over"), [ifThen(eq(v("fire"), 1), [set("state", "wait"), hide(), broadcast("restart")])]),
  ], 20, 300);

  // fire = 1 on the frame after a click, or when Space or Up is pressed (not while held)
  define("read input", [
    set("fire", 0),
    ifThen(eq(v("clicked"), 1), [set("fire", 1), set("clicked", 0)]),
    ifThen(and(or(key("space"), key("up arrow")), eq(v("fireWas"), 0)), [set("fire", 1)]),
    ifElse(or(key("space"), key("up arrow")), [set("fireWas", 1)], [set("fireWas", 0)]),
  ], { warp: true, x: 520, y: 20 });

  define("aim", [
    // The mouse aims when it moves (or is pressed); the arrow keys turn the aim.
    ifThen(or(or(not(eq(mouseX(), v("lastMX"))), not(eq(mouseY(), v("lastMY")))), eq(v("fire"), 1)), [
      // Pointing at or below the launcher still aims, as far to that side as the limit allows.
      set("aimDY", sub(mouseY(), GEOM.launchY)),
      ifThen(lt(v("aimDY"), 8), [set("aimDY", 8)]),
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

  // Moves in small steps; bounces off the side walls; stops at the ceiling or next to a bubble.
  define("fly", [
    set("step", 0),
    repeat(SUBSTEPS, [
      ifThen(eq(v("state"), "fly"), [
        change("shotX", v("vx")), change("shotY", v("vy")),
        ifThen(gt(v("shotX"), WALL), [set("shotX", sub(2 * WALL, v("shotX"))), set("vx", mul(v("vx"), -1))]),
        ifThen(lt(v("shotX"), -WALL), [set("shotX", sub(-2 * WALL, v("shotX"))), set("vx", mul(v("vx"), -1))]),
        ifElse(gt(v("shotY"), sub(v("topY"), D / 2)), [call("land")], [call("check hit")]),
      ]),
    ]),
    goto(v("shotX"), v("shotY")),
  ], { warp: true, x: 1000, y: 20 });

  define("check hit", [
    set("ci", 1),
    repeat(CELLS, [
      ifThen(and(eq(v("state"), "fly"), gt(item("grid", v("ci")), 0)), [
        set("dx", sub(v("shotX"), cellX(d, rowOf(d, v("ci")), colOf(d, v("ci"))))),
        set("dy", sub(v("shotY"), cellY(d, rowOf(d, v("ci"))))),
        ifThen(lt(add(mul(v("dx"), v("dx")), mul(v("dy"), v("dy"))), HIT * HIT), [call("land")]),
      ]),
      change("ci", 1),
    ]),
  ], { warp: true, x: 1000, y: 500 });

  // Snaps to the nearest empty cell that touches the ceiling or another bubble.
  define("land", [
    set("bestD", 1e9), set("landIdx", 0), set("ci", 1),
    repeat(CELLS, [
      set("tr", rowOf(d, v("ci"))),
      ifThen(and(eq(item("grid", v("ci")), 0), not(and(eq(d.mod(v("tr"), 2), 1), eq(colOf(d, v("ci")), COLS - 1)))), [
        set("dx", sub(v("shotX"), cellX(d, v("tr"), colOf(d, v("ci"))))),
        set("dy", sub(v("shotY"), cellY(d, v("tr")))),
        set("dist", add(mul(v("dx"), v("dx")), mul(v("dy"), v("dy")))),
        ifThen(lt(v("dist"), v("bestD")), [
          set("attached", 0),
          ifElse(eq(v("tr"), 0), [set("attached", 1)], [
            set("tci", v("ci")), call("neighbours of tci"),
          ]),
          ifThen(eq(v("attached"), 1), [set("bestD", v("dist")), set("landIdx", v("ci"))]),
        ]),
      ]),
      change("ci", 1),
    ]),
    hide(),
    set("state", "settle"),
    broadcast("landed"),
  ], { warp: true, x: 1500, y: 20 });

  // attached = 1 if cell tci has a bubble next to it (same neighbour rules as the Board).
  define("neighbours of tci", [
    set("nr", rowOf(d, v("tci"))), set("nc", colOf(d, v("tci"))), set("shift", d.mod(v("nr"), 2)),
    ...[[0, -1, 0], [0, 1, 0], [-1, -1, 1], [-1, 0, 1], [1, -1, 1], [1, 0, 1]].map(([dr, dc, useShift]) => {
      const r = add(v("nr"), dr);
      const c = useShift ? add(add(v("nc"), v("shift")), dc) : add(v("nc"), dc);
      return ifThen(and(and(gte(d, r, 0), lt(add(v("nr"), dr), ROWS)),
        and(gte(d, useShift ? add(add(v("nc"), v("shift")), dc) : add(v("nc"), dc), 0),
          lt(useShift ? add(add(v("nc"), v("shift")), dc) : add(v("nc"), dc), COLS))), [
        ifThen(gt(item("grid", add(add(mul(add(v("nr"), dr), COLS), c), 1)), 0), [set("attached", 1)]),
      ]);
    }),
  ], { warp: true, x: 1500, y: 900 });

  noteClicks(B);
  return B;
}

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
        goto(sub(-150, mul(sub(v("slot"), 1), 18)), 112), show(),
      ], [hide()]),
    ]),
    ifThen(eq(v("kind"), "level"), [
      set("text", v("level")),
      ifElse(not(gt(v("slot"), textLength(v("text")))), [
        costumeTo(add(letterOf(v("slot"), v("text")), 1)),
        goto(add(sub(-178, mul(sub(textLength(v("text")), 1), 9)), mul(sub(v("slot"), 1), 18)), 32), show(),
      ], [hide()]),
    ]),
    ifThen(eq(v("kind"), "pip"), [
      ifElse(not(gt(v("slot"), v("ceilingShots"))), [
        ifElse(not(gt(v("slot"), v("shotsLeft"))), [costume("pip on")], [costume("pip off")]),
        goto(add(sub(178, mul(sub(v("ceilingShots"), 1), 5.5)), mul(sub(v("slot"), 1), 11)), 24), show(),
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
        ifThen(lt(v("fxCount"), 160), [
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
