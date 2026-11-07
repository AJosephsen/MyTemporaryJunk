// Demo: a bubble shooter that finds matches and loose bubbles the "Scratch way", without a grid list.
//
// - Every stuck bubble is a clone of the Bubble sprite with its own `color`.
// - The shot flies until it is touching a Bubble (or the ceiling), then snaps to the nearest honeycomb slot.
// - Colour chain: the new bubble puts on a "marked" costume with a glowing ring in a detector colour that is
//   used nowhere else (one per bubble colour). The ring reaches past the bubble's edge into its neighbours.
//   Then, round after round, every unmarked bubble of the same colour asks "touching color <ring colour>?"
//   and, if so, marks itself too. When a round marks nobody new, the chain is complete:
//   3 or more marked bubbles pop; otherwise they unmark.
// - Loose bubbles: the same trick with an orange "anchor" ring that starts at the ceiling.
//   Bubbles that never get anchored fall.
// Each round is two `broadcast and wait`s (check, then apply), so the chain spreads exactly one ring of
// bubbles per round, visibly, and the result never depends on the order Scratch runs the clones in.
//
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl, type Ref } from "../../lib/sb3.ts";
import { COLORS, bubbleBody } from "../../games/glimmer-pop/art.ts";

const P = new Project();
const D = 26, ROW_H = 22.5, COLS = 8, ROWS = 12;
const LEFT = -104, RIGHT = 104, TOP = 160, LAUNCH_Y = -150;
const WALL = RIGHT - D / 2;
// Detector colours: pure colours that appear nowhere in the artwork, one per bubble colour, and one for anchors.
const RING = ["#ff00ff", "#00ffff", "#ffff00", "#00ff00", "#0000ff", "#ff0000"];
const ANCHOR = "#ff8000";
const asNumber = (hex: string) => parseInt(hex.slice(1), 16);

// ---------------------------------------------------------------- artwork
const svg = (w: number, h: number, vw: number, vh: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${vw} ${vh}">${body}</svg>`;
const S = 40 * D / 30;  // a 40-unit canvas (room for the ring) shown at bubble scale
// The bubble on a 40 x 40 canvas, optionally with a ring that reaches about 3.5 px past its edge.
const bubble = (i: number, ring?: string) => svg(S, S, 40, 40,
  `<g transform="translate(5 5)">${bubbleBody(i, `g${i}`)}</g>` +
  (ring ? `<circle cx="20" cy="20" r="17.6" fill="none" stroke="${ring}" stroke-width="3.6"/>` : ""));
const backdrop = svg(480, 360, 480, 360,
  `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1240"/><stop offset="1" stop-color="#4b2a6b"/></linearGradient></defs>` +
  `<rect width="480" height="360" fill="url(#sky)"/>` +
  `<rect x="${LEFT + 240 - 6}" y="4" width="${RIGHT - LEFT + 12}" height="352" rx="12" fill="#120a2c" fill-opacity="0.5" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2"/>` +
  `<text x="64" y="40" font-family="Arial, sans-serif" font-weight="bold" font-size="17" fill="#fff" text-anchor="middle">Bubble Chain</text>` +
  `<text x="64" y="60" font-family="Arial, sans-serif" font-size="11" fill="#fff" fill-opacity="0.7" text-anchor="middle">a Scratch-style demo</text>` +
  [["Matches spread", "through touching rings"], ["Orange rings start", "at the ceiling;"], ["bubbles without one", "fall"]].map(([a, b], k) =>
    `<text x="64" y="${110 + k * 40}" font-family="Arial, sans-serif" font-size="11" fill="#fff" fill-opacity="0.75" text-anchor="middle">${a}</text>` +
    `<text x="64" y="${124 + k * 40}" font-family="Arial, sans-serif" font-size="11" fill="#fff" fill-opacity="0.75" text-anchor="middle">${b}</text>`).join(""));
// The ceiling: a bar the top row of bubbles touches.
// 12 px tall with its centre 5 px above TOP, so it reaches 1 px into the top row of bubbles and they touch it.
const ceiling = svg(RIGHT - LEFT, 12, RIGHT - LEFT, 12, `<rect width="${RIGHT - LEFT}" height="12" rx="3" fill="#b9a2ea"/>`);

const ART = {
  // costumes 1-6: plain; 7-12: match-marked; 13-18: anchored
  bubble: [
    ...COLORS.map((c, i) => P.costume(c.name, bubble(i), S / 2, S / 2)),
    ...COLORS.map((c, i) => P.costume(`${c.name} marked`, bubble(i, RING[i]), S / 2, S / 2)),
    ...COLORS.map((c, i) => P.costume(`${c.name} anchored`, bubble(i, ANCHOR), S / 2, S / 2)),
  ],
};

// ---------------------------------------------------------------- Stage: start
function stageScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [
    d.set("phase", "setup"), d.broadcastWait("fill board"), d.broadcast("play"),
  ]);
  return B;
}

// ---------------------------------------------------------------- Ceiling
function ceilingScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.goto(0, TOP + 5), d.show()]);
  return B;
}

// ---------------------------------------------------------------- Bubble: the original spawns clones; clones do the chain work
function bubbleScripts(): Blocks {
  // Variables for this sprite only: a clone gets a copy of the original's values at the moment it is made.
  const B = new Blocks(P).local("isClone", "color", "marked", "anchored", "vy2", "startMarked", "pending");
  const d = dsl(B);
  const { v, add, sub, mul, div, lt, gt, eq, and, or, not, floor, mod, random, item, length, set, change, repeat,
    ifThen, ifElse, whenFlag, whenReceive, whenCloned, cloneMyself, deleteClone, hide, show, goto, costumeTo,
    touching, define, call, changeY, changeSize, changeEffect, setEffect } = d;
  // touching color with a colour from a list, or a fixed colour
  const touchingColor = d.touchingColor;

  B.script(whenFlag(), [ifElse(eq(v("isClone"), 1), [deleteClone()], [hide(), set("isClone", 0)])], 20, 20);

  // The board: the list `layout` (12 rows x 8, 0 = empty) or, if it is empty, a random symmetric pattern.
  B.script(whenReceive("fill board"), [
    ifThen(eq(v("isClone"), 0), [
      ifThen(eq(length("layout"), 0), [call("random layout")]),
      set("i", 1),
      repeat(length("layout"), [
        ifThen(gt(item("layout", v("i")), 0), [
          set("color", item("layout", v("i"))),
          set("row", floor(div(sub(v("i"), 1), COLS))), set("col", mod(sub(v("i"), 1), COLS)),
          goto(add(add(LEFT + D / 2, mul(v("col"), D)), mul(mod(v("row"), 2), D / 2)), sub(TOP - D / 2, mul(v("row"), ROW_H))),
          cloneMyself(),
        ]),
        change("i", 1),
      ]),
    ]),
  ], 20, 120);
  define("random layout", [
    d.deleteAll("layout"), set("i", 1),
    repeat(COLS * ROWS, [
      set("row", floor(div(sub(v("i"), 1), COLS))), set("col", mod(sub(v("i"), 1), COLS)),
      ifElse(and(lt(v("row"), 5), not(and(eq(mod(v("row"), 2), 1), eq(v("col"), COLS - 1)))),
        [d.addTo("layout", random(1, 4))], [d.addTo("layout", 0)]),
      change("i", 1),
    ]),
  ], { warp: true, x: 520, y: 20 });

  // The Shooter asks for a new bubble at newX, newY with newColor.
  B.script(whenReceive("add bubble"), [
    ifThen(eq(v("isClone"), 0), [
      set("color", v("newColor")), goto(v("newX"), v("newY")),
      set("startMarked", 1), cloneMyself(), set("startMarked", 0),
    ]),
  ], 20, 520);

  // A bubble that has just landed starts the colour chain: it begins with its ring on.
  B.script(whenCloned(), [
    set("isClone", 1), set("marked", 0), set("anchored", 0), costumeTo(v("color")),
    ifThen(eq(v("startMarked"), 1), [set("marked", 1), costumeTo(add(v("color"), 6)), set("markedCount", 1)]),
    show(),
  ], 20, 640);

  // ---- the colour chain
  // Each round has two steps, so the chain grows exactly one ring of bubbles per round, whatever order
  // Scratch runs the clones in: first everyone checks, then those who touched a ring put on their own.
  B.script(whenReceive("check match"), [
    set("pending", 0),
    ifThen(and(and(eq(v("isClone"), 1), eq(v("marked"), 0)), eq(v("color"), v("matchColor"))), [
      ifThen(touchingColor(item("ringColors", v("color"))), [set("pending", 1)]),
    ]),
  ], 20, 860);
  B.script(whenReceive("apply match"), [
    ifThen(eq(v("pending"), 1), [
      set("pending", 0), set("marked", 1), costumeTo(add(v("color"), 6)), change("newMarks", 1), change("markedCount", 1),
    ]),
  ], 20, 980);
  B.script(whenReceive("pop"), [
    ifThen(and(eq(v("isClone"), 1), eq(v("marked"), 1)), [
      repeat(6, [changeSize(8), changeEffect("GHOST", 16)]), deleteClone(),
    ]),
  ], 20, 1040);
  B.script(whenReceive("unmark"), [
    ifThen(and(eq(v("isClone"), 1), eq(v("marked"), 1)), [set("marked", 0), costumeTo(v("color"))]),
  ], 20, 1180);

  // ---- loose bubbles
  B.script(whenReceive("anchor start"), [
    ifThen(eq(v("isClone"), 1), [
      set("anchored", 0),
      ifThen(touching("Ceiling"), [set("anchored", 1), costumeTo(add(v("color"), 12)), change("newMarks", 1)]),
    ]),
  ], 20, 1300);
  B.script(whenReceive("check anchor"), [
    set("pending", 0),
    ifThen(and(eq(v("isClone"), 1), eq(v("anchored"), 0)), [ifThen(touchingColor(ANCHOR), [set("pending", 1)])]),
  ], 20, 1460);
  B.script(whenReceive("apply anchor"), [
    ifThen(eq(v("pending"), 1), [set("pending", 0), set("anchored", 1), costumeTo(add(v("color"), 12)), change("newMarks", 1)]),
  ], 20, 1560);
  B.script(whenReceive("drop loose"), [
    ifThen(eq(v("isClone"), 1), [
      ifElse(eq(v("anchored"), 1), [costumeTo(v("color"))], [
        change("dropped", 1), set("vy2", 1),
        repeat(30, [changeY(v("vy2")), change("vy2", -0.8), ifThen(lt(d.yPos(), -150), [changeEffect("GHOST", 12)])]),
        deleteClone(),
      ]),
    ]),
  ], 20, 1580);
  B.script(d.whenClicked(), [set("clicked", 1)], 520, 520);   // clicks on bubbles shoot too
  void setEffect; void or; void not;
  return B;
}

// ---------------------------------------------------------------- Shooter: aim, fly, snap, then run the chain
function shooterScripts(): Blocks {
  const B = new Blocks(P);
  const d = dsl(B);
  const { v, add, sub, mul, div, lt, gt, eq, or, not, sin, cos, atan, round, random, set, change, repeat, until,
    ifThen, ifElse, whenReceive, key, mouseX, mouseY, goto, costumeTo, show, hide, touching, broadcastWait, mod,
    wait, front } = d;

  B.script(whenReceive("play"), [
    set("phase", "aim"), set("shotColor", random(1, 4)), set("clicked", 0),
    goto(0, LAUNCH_Y), show(), front(),
    d.forever([
      // aim at the mouse; Space, Up or a click shoots
      costumeTo(v("shotColor")), goto(0, LAUNCH_Y),
      set("aimDY", sub(mouseY(), LAUNCH_Y)), ifThen(lt(v("aimDY"), 8), [set("aimDY", 8)]),
      set("aimDir", atan(div(mouseX(), v("aimDY")))),
      ifThen(gt(v("aimDir"), 78), [set("aimDir", 78)]), ifThen(lt(v("aimDir"), -78), [set("aimDir", -78)]),
      ifThen(or(or(key("space"), key("up arrow")), eq(v("clicked"), 1)), [
        set("clicked", 0),
        // fly in small steps until touching a bubble or the ceiling, bouncing off the walls
        set("phase", "fly"), set("vx", mul(sin(v("aimDir")), 4)), set("vy", mul(cos(v("aimDir")), 4)),
        until(or(touching("Bubble"), gt(d.yPos(), TOP - D / 2)), [
          repeat(3, [
            ifThen(not(or(touching("Bubble"), gt(d.yPos(), TOP - D / 2))), [
              d.changeX(v("vx")), d.changeY(v("vy")),
              ifThen(gt(d.xPos(), WALL), [d.setX(WALL), set("vx", mul(v("vx"), -1))]),
              ifThen(lt(d.xPos(), -WALL), [d.setX(-WALL), set("vx", mul(v("vx"), -1))]),
            ]),
          ]),
        ]),
        // snap to the nearest honeycomb slot
        set("row", round(div(sub(TOP - D / 2, d.yPos()), ROW_H))), ifThen(lt(v("row"), 0), [set("row", 0)]),
        set("col", round(div(sub(sub(d.xPos(), LEFT + D / 2), mul(mod(v("row"), 2), D / 2)), D))),
        ifThen(lt(v("col"), 0), [set("col", 0)]),
        ifThen(gt(v("col"), sub(COLS - 1, mod(v("row"), 2))), [set("col", sub(COLS - 1, mod(v("row"), 2)))]),
        set("newX", add(add(LEFT + D / 2, mul(v("col"), D)), mul(mod(v("row"), 2), D / 2))),
        set("newY", sub(TOP - D / 2, mul(v("row"), ROW_H))),
        set("newColor", v("shotColor")), hide(),
        // the new bubble starts with its ring on; the chain spreads until no bubble joins
        set("phase", "chain"), set("matchColor", v("shotColor")), set("markedCount", 0),
        broadcastWait("add bubble"),
        set("newMarks", 1),
        until(eq(v("newMarks"), 0), [set("newMarks", 0), broadcastWait("check match"), broadcastWait("apply match"), wait(0.04)]),
        ifElse(gt(v("markedCount"), 2), [
          broadcastWait("pop"),
          // loose bubbles: anchor rings start at the ceiling and spread; the rest fall
          set("phase", "drop"), set("dropped", 0), set("newMarks", 0),
          broadcastWait("anchor start"),
          until(eq(v("newMarks"), 0), [set("newMarks", 0), broadcastWait("check anchor"), broadcastWait("apply anchor"), wait(0.04)]),
          broadcastWait("drop loose"),
        ], [broadcastWait("unmark")]),
        set("shotColor", random(1, 4)), set("phase", "aim"), show(),
      ]),
    ]),
  ], 20, 20);
  B.script(d.whenStageClicked(), [set("clicked", 1)], 900, 20);
  void front;
  return B;
}

// ---------------------------------------------------------------- project
const backdropCostume = P.costume("night", backdrop, 240, 180);
const sb3 = P.build({
  backdrop: backdropCostume,
  stage: stageScripts(),
  sprites: [
    P.sprite("Ceiling", { blocks: ceilingScripts(), costumes: [P.costume("ceiling", ceiling, (RIGHT - LEFT) / 2, 6)], layer: 1, y: TOP + 5 }),
    P.sprite("Bubble", { blocks: bubbleScripts(), costumes: ART.bubble, layer: 2, visible: false }),
    P.sprite("Shooter", { blocks: shooterScripts(), costumes: ART.bubble, layer: 3, y: LAUNCH_Y }),
  ],
  listValues: { ringColors: RING.map(asNumber), layout: [] },
  shown: [],
});
writeFileSync(new URL("bubble-chain.sb3", import.meta.url), sb3);
console.log(`bubble-chain.sb3: ${sb3.length} bytes`);
