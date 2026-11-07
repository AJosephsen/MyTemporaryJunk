// Demo: the same bubble shooter as Bubble Chain, but the whole chain is found in a single frame.
//
// - One sprite per colour (Bubble1 ... Bubble6); every stuck bubble is a clone of its colour's sprite.
//   So `touching (join "Bubble" color)?` tells exactly which colour is at a spot.
// - A tiny, invisible Probe sprite searches inside one custom block that runs without screen refresh:
//   from the landing spot it jumps to each of the 6 neighbouring slots and asks whether a bubble of the shot's
//   colour is there; every hit is queued and searched in turn (a flood fill that finds bubbles by touching).
// - Loose bubbles: a second search starts at the 8 ceiling slots and follows bubbles of any colour,
//   stepping over the ones that are about to pop.
// - One broadcast applies the result: each clone looks for its own position in the "pop" and "anchored" lists.
// Neighbouring slots are always at (+-26, 0) or (+-13, +-22.5), so no row or column numbers are needed.
//
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl, type Ref, type In } from "../../lib/sb3.ts";
import { COLORS, bubbleBody } from "../../games/glimmer-pop/art.ts";

const P = new Project();
const D = 26, ROW_H = 22.5, COLS = 8, ROWS = 12;
const LEFT = -104, RIGHT = 104, TOP = 160, LAUNCH_Y = -150;
const WALL = RIGHT - D / 2;
const TOP_ROW_Y = TOP - D / 2;
const NEIGHBOURS = [[D, 0], [-D, 0], [D / 2, ROW_H], [-D / 2, ROW_H], [D / 2, -ROW_H], [-D / 2, -ROW_H]];
const NCOLORS = COLORS.length;

// ---------------------------------------------------------------- artwork
const svg = (w: number, h: number, vw: number, vh: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${vw} ${vh}">${body}</svg>`;
const bubble = (i: number) => svg(D, D, 30, 30, bubbleBody(i, `g${i}`));
const backdrop = svg(480, 360, 480, 360,
  `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10233f"/><stop offset="1" stop-color="#2a4b6b"/></linearGradient></defs>` +
  `<rect width="480" height="360" fill="url(#sky)"/>` +
  `<rect x="${LEFT + 240 - 6}" y="4" width="${RIGHT - LEFT + 12}" height="352" rx="12" fill="#081426" fill-opacity="0.5" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2"/>` +
  `<text x="64" y="40" font-family="Arial, sans-serif" font-weight="bold" font-size="17" fill="#fff" text-anchor="middle">Bubble Probe</text>` +
  `<text x="64" y="60" font-family="Arial, sans-serif" font-size="11" fill="#fff" fill-opacity="0.7" text-anchor="middle">a Scratch-style demo</text>` +
  [["An invisible probe", "visits neighbour slots"], ["and asks: touching", "this colour?"], ["The whole search", "fits in one frame"]].map(([a, b], k) =>
    `<text x="64" y="${110 + k * 40}" font-family="Arial, sans-serif" font-size="11" fill="#fff" fill-opacity="0.75" text-anchor="middle">${a}</text>` +
    `<text x="64" y="${124 + k * 40}" font-family="Arial, sans-serif" font-size="11" fill="#fff" fill-opacity="0.75" text-anchor="middle">${b}</text>`).join(""));
const ceiling = svg(RIGHT - LEFT, 12, RIGHT - LEFT, 12, `<rect width="${RIGHT - LEFT}" height="12" rx="3" fill="#9fd3ff"/>`);
const dot = svg(4, 4, 4, 4, `<rect width="4" height="4" fill="#ffffff"/>`);

// ---------------------------------------------------------------- shared expressions
type DD = ReturnType<typeof dsl>;
// A slot's key: its x and twice its y, rounded, e.g. "-13,294". Twice y keeps the half pixels (22.5 rows).
const keyOf = (d: DD, x: In, y: In) => d.join(d.round(x), d.join(",", d.round(d.mul(y, 2))));

// ---------------------------------------------------------------- Stage
function stageScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.set("phase", "setup"), d.broadcastWait("fill board"), d.broadcast("play")]);
  return B;
}
function ceilingScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.goto(0, TOP + 5), d.show()]);
  return B;
}

// ---------------------------------------------------------------- Bubble1 ... Bubble6: one sprite per colour
function bubbleScripts(color: number): Blocks {
  const B = new Blocks(P).local("isClone", "myKey", "vy2");
  const d = dsl(B);
  const { v, add, sub, mul, div, lt, gt, eq, and, not, floor, mod, item, length, set, change, repeat, ifThen,
    ifElse, whenFlag, whenReceive, whenCloned, cloneMyself, deleteClone, hide, show, goto, changeY, changeSize,
    changeEffect, contains, front } = d;

  B.script(whenFlag(), [ifElse(eq(v("isClone"), 1), [deleteClone()], [hide(), set("isClone", 0)])], 20, 20);
  // My colour's bubbles from the list `layout` (12 rows x 8, 0 = empty).
  // All six colour sprites fill at the same time and share the counters i, row and col, so the fill must run
  // without screen refresh: a normal loop pauses after each pass and the six loops would mix up each other's i.
  B.script(whenReceive("fill board"), [ifThen(eq(v("isClone"), 0), [d.call("fill")])], 20, 120);
  d.define("fill", [
    ifThen(eq(v("isClone"), 0), [
      set("i", 1),
      repeat(length("layout"), [
        ifThen(eq(item("layout", v("i")), color), [
          set("row", floor(div(sub(v("i"), 1), COLS))), set("col", mod(sub(v("i"), 1), COLS)),
          goto(add(add(LEFT + D / 2, mul(v("col"), D)), mul(mod(v("row"), 2), D / 2)), sub(TOP_ROW_Y, mul(v("row"), ROW_H))),
          cloneMyself(),
        ]),
        change("i", 1),
      ]),
    ]),
  ], { warp: true, x: 520, y: 120 });
  B.script(whenReceive("add bubble"), [
    ifThen(and(eq(v("isClone"), 0), eq(v("newColor"), color)), [goto(v("newX"), v("newY")), cloneMyself()]),
  ], 20, 480);
  B.script(whenCloned(), [set("isClone", 1), set("myKey", keyOf(d, d.xPos(), d.yPos())), show()], 20, 600);

  // Apply the probe's result: pop, fall or stay.
  B.script(whenReceive("resolve"), [
    ifThen(eq(v("isClone"), 1), [
      ifThen(contains("popKeys", v("myKey")), [front(), repeat(6, [changeSize(8), changeEffect("GHOST", 16)]), deleteClone()]),
      ifThen(and(gt(length("popKeys"), 0), not(contains("anchoredKeys", v("myKey")))), [
        change("dropped", 1), set("vy2", 1),
        repeat(30, [changeY(v("vy2")), change("vy2", -0.8), ifThen(lt(d.yPos(), -150), [changeEffect("GHOST", 12)])]),
        deleteClone(),
      ]),
    ]),
  ], 20, 700);
  B.script(d.whenClicked(), [set("clicked", 1)], 520, 20);
  return B;
}

// ---------------------------------------------------------------- Probe: the single-frame search
function probeScripts(): Blocks {
  const B = new Blocks(P);
  const d = dsl(B);
  const { v, add, lt, gt, eq, and, or, not, abs, item, length, set, change, repeat, until, ifThen, define, call,
    whenFlag, whenReceive, goto, deleteAll, deleteOf, addTo, contains, touchingNamed, join, setEffect, show } = d;
  const anyBubble = () => Array.from({ length: NCOLORS }, (_, c) => d.touching(`Bubble${c + 1}`)).reduce((a, b) => or(a, b));

  // Visible to the touching checks, invisible on screen.
  B.script(whenFlag(), [setEffect("GHOST", 100), show()], 20, 20);

  // Runs the search for the bubble that just landed (the Shooter sets newX, newY, newColor).
  B.script(whenReceive("probe"), [
    call("find matches"),
    deleteAll("anchoredKeys"),
    ifThen(gt(length("matchKeys"), 2), [call("find anchored")]),
    deleteAll("popKeys"),
    ifThen(gt(length("matchKeys"), 2), [set("k", 1), repeat(length("matchKeys"), [addTo("popKeys", item("matchKeys", v("k"))), change("k", 1)])]),
  ], 20, 120);

  // Breadth-first search; the queue holds slot positions, `seen` the keys of slots already visited.
  const neighbourVisits = (visit: string) => NEIGHBOURS.flatMap(([dx, dy]) => [
    set("px", add(v("cx"), dx)), set("py", add(v("cy"), dy)), call(visit),
  ]);
  const search = (visit: string) => until(eq(length("qx"), 0), [
    set("cx", item("qx", 1)), set("cy", item("qy", 1)), deleteOf("qx", 1), deleteOf("qy", 1),
    ...neighbourVisits(visit),
  ]);
  const onBoard = () => and(not(gt(abs(v("px")), WALL + 1)), not(gt(v("py"), TOP_ROW_Y + 1)));

  define("find matches", [
    deleteAll("seen"), deleteAll("qx"), deleteAll("qy"), deleteAll("matchKeys"),
    set("k0", keyOf(d, v("newX"), v("newY"))),
    addTo("seen", v("k0")), addTo("matchKeys", v("k0")), addTo("qx", v("newX")), addTo("qy", v("newY")),
    search("visit for match"),
  ], { warp: true, x: 520, y: 20 });
  define("visit for match", [
    set("pk", keyOf(d, v("px"), v("py"))),
    ifThen(and(onBoard(), not(contains("seen", v("pk")))), [
      addTo("seen", v("pk")), goto(v("px"), v("py")),
      ifThen(touchingNamed(join("Bubble", v("newColor"))), [addTo("qx", v("px")), addTo("qy", v("py")), addTo("matchKeys", v("pk"))]),
    ]),
  ], { warp: true, x: 520, y: 400 });

  // Starts at the 8 ceiling slots and follows bubbles of any colour, stepping over the ones about to pop.
  define("find anchored", [
    deleteAll("seen"), deleteAll("qx"), deleteAll("qy"),
    set("px", LEFT + D / 2), set("py", TOP_ROW_Y),
    repeat(COLS, [call("visit for anchor"), change("px", D)]),
    search("visit for anchor"),
  ], { warp: true, x: 1000, y: 20 });
  define("visit for anchor", [
    set("pk", keyOf(d, v("px"), v("py"))),
    ifThen(and(and(onBoard(), not(contains("seen", v("pk")))), not(contains("matchKeys", v("pk")))), [
      addTo("seen", v("pk")), goto(v("px"), v("py")),
      ifThen(anyBubble(), [addTo("qx", v("px")), addTo("qy", v("py")), addTo("anchoredKeys", v("pk"))]),
    ]),
  ], { warp: true, x: 1000, y: 400 });
  void lt;
  return B;
}

// ---------------------------------------------------------------- Shooter
function shooterScripts(): Blocks {
  const B = new Blocks(P);
  const d = dsl(B);
  const { v, add, sub, mul, div, lt, gt, eq, or, not, sin, cos, atan, round, random, set, repeat, until,
    ifThen, whenReceive, key, mouseX, mouseY, goto, costumeTo, show, hide, broadcastWait, mod, front, touching } = d;
  const anyBubble = () => Array.from({ length: NCOLORS }, (_, c) => touching(`Bubble${c + 1}`)).reduce((a, b) => or(a, b));
  const stopped = () => or(anyBubble(), gt(d.yPos(), TOP_ROW_Y));

  B.script(whenReceive("play"), [
    set("phase", "aim"), set("shotColor", random(1, 4)), set("clicked", 0),
    goto(0, LAUNCH_Y), show(), front(),
    d.forever([
      costumeTo(v("shotColor")), goto(0, LAUNCH_Y),
      set("aimDY", sub(mouseY(), LAUNCH_Y)), ifThen(lt(v("aimDY"), 8), [set("aimDY", 8)]),
      set("aimDir", atan(div(mouseX(), v("aimDY")))),
      ifThen(gt(v("aimDir"), 78), [set("aimDir", 78)]), ifThen(lt(v("aimDir"), -78), [set("aimDir", -78)]),
      ifThen(or(or(key("space"), key("up arrow")), eq(v("clicked"), 1)), [
        set("clicked", 0),
        set("phase", "fly"), set("vx", mul(sin(v("aimDir")), 4)), set("vy", mul(cos(v("aimDir")), 4)),
        until(stopped(), [
          repeat(3, [
            ifThen(not(stopped()), [
              d.changeX(v("vx")), d.changeY(v("vy")),
              ifThen(gt(d.xPos(), WALL), [d.setX(WALL), set("vx", mul(v("vx"), -1))]),
              ifThen(lt(d.xPos(), -WALL), [d.setX(-WALL), set("vx", mul(v("vx"), -1))]),
            ]),
          ]),
        ]),
        // snap to the nearest honeycomb slot
        set("row", round(div(sub(TOP_ROW_Y, d.yPos()), ROW_H))), ifThen(lt(v("row"), 0), [set("row", 0)]),
        set("col", round(div(sub(sub(d.xPos(), LEFT + D / 2), mul(mod(v("row"), 2), D / 2)), D))),
        ifThen(lt(v("col"), 0), [set("col", 0)]),
        ifThen(gt(v("col"), sub(COLS - 1, mod(v("row"), 2))), [set("col", sub(COLS - 1, mod(v("row"), 2)))]),
        set("newX", add(add(LEFT + D / 2, mul(v("col"), D)), mul(mod(v("row"), 2), D / 2))),
        set("newY", sub(TOP_ROW_Y, mul(v("row"), ROW_H))),
        set("newColor", v("shotColor")), hide(),
        broadcastWait("add bubble"),
        // the whole chain is found in this frame
        set("phase", "probe"), set("dropped", 0),
        broadcastWait("probe"),
        set("markedCount", d.length("matchKeys")),
        set("phase", "resolve"),
        broadcastWait("resolve"),
        set("shotColor", random(1, 4)), set("phase", "aim"), show(),
      ]),
    ]),
  ], 20, 20);
  B.script(d.whenStageClicked(), [set("clicked", 1)], 900, 20);
  return B;
}

// ---------------------------------------------------------------- project
const bubbles = COLORS.map((c, i) => P.costume(c.name, bubble(i), D / 2, D / 2));
const sb3 = P.build({
  backdrop: P.costume("night", backdrop, 240, 180),
  stage: stageScripts(),
  sprites: [
    P.sprite("Ceiling", { blocks: ceilingScripts(), costumes: [P.costume("ceiling", ceiling, (RIGHT - LEFT) / 2, 6)], layer: 1, y: TOP + 5 }),
    ...COLORS.map((c, i) => P.sprite(`Bubble${i + 1}`, { blocks: bubbleScripts(i + 1), costumes: [bubbles[i]], layer: 2 + i, visible: false })),
    P.sprite("Probe", { blocks: probeScripts(), costumes: [P.costume("dot", dot, 2, 2)], layer: 9 }),
    P.sprite("Shooter", { blocks: shooterScripts(), costumes: bubbles, layer: 10, y: LAUNCH_Y }),
  ],
  listValues: { layout: [] },
  shown: [],
});
writeFileSync(new URL("bubble-probe.sb3", import.meta.url), sb3);
console.log(`bubble-probe.sb3: ${sb3.length} bytes`);
