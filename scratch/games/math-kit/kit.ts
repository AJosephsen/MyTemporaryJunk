// The math games' kit: a sprite font that writes numbers and words with clones, and a particle system. Any sprite asks
// for text or particles by adding a request to queue lists (atomic in Scratch: a script runs until it yields); the
// Text and Spark sprites work through their queues on every `tick`.
//
// Text groups: every piece of text belongs to a group number. Lists indexed by group:
//   groupGen    a clone whose `gen` differs from its group's gen deletes itself; increase it to replace or clear a group
//   groupPulse  extra size in percent, shrinking every tick (set it to make the group "pop")
//   groupColor  colour effect for the group's clones
// Text modes: "fixed" (stays put), "follow" (stays on slot `follow` of the lists slotX/slotY, hidden while that slot is
// above the variable hideAbove), "float" (rises and fades, then goes by itself). Everything on screen moves by shakeX/shakeY, for screen shake.
import { readFileSync } from "node:fs";
import { Blocks, dsl, type Project, type In } from "../../lib/sb3.ts";

type D = ReturnType<typeof dsl>;
const font = JSON.parse(readFileSync(new URL("font/font.json", import.meta.url), "utf8")) as {
  glyphs: { char: string; name: string; width: number }[]; words: { text: string; name: string; width: number; game?: string }[] };
const png = (name: string) => readFileSync(new URL(`font/${name}.png`, import.meta.url));
export const GROUPS = 40;
export const SPACING = 0.86;          // glyphs overlap a little: their outlines touch

// ---------------------------------------------------------------- helpers for the games: queue text and particles
export type TextOpts = { text: In; x: In; y: In; size?: In; group: number | In; mode?: "fixed" | "follow" | "float"; follow?: In; replace?: boolean };
/** Blocks that ask the Text sprite to write `text` (a number or symbols, or a banner word as "word-combo" and so on),
 *  centred on x, y. In follow mode x, y are the offset from the slot. */
// A group given as a calculation (a block) is stored in a variable first: a block can only be used in one place.
function groupOf(d: D, group: number | In): [any[], () => any] {
  if (typeof group === "number" || typeof group === "string" || "v" in (group as any)) return [[], () => group];
  return [[d.set("textGroup", group as any)], () => d.v("textGroup")];
}
export function write(d: D, o: TextOpts) {
  const [store, g] = groupOf(d, o.group);
  return [
    ...store,
    ...(o.replace === false ? [] : [d.replace("groupGen", g(), d.add(d.item("groupGen", g()), 1))]),
    d.addTo("qText", o.text), d.addTo("qX", o.x), d.addTo("qY", o.y), d.addTo("qSize", o.size ?? 100),
    d.addTo("qGroup", g()), d.addTo("qMode", o.mode ?? "fixed"), d.addTo("qFollow", o.follow ?? 0),
    // The group's version at the moment of asking: if the group is written again in the same frame, this text is old.
    d.addTo("qGen", d.item("groupGen", g())),
  ];
}
/** Blocks that clear a text group (its clones go on the next tick). */
export function clear(d: D, group: number | In) {
  const [store, g] = groupOf(d, group);
  return [...store, d.replace("groupGen", g(), d.add(d.item("groupGen", g()), 1))];
}
/** Blocks that make a text group pop (grow and shrink back). */
export const pulse = (d: D, group: number | In, amount: In = 30) => d.replace("groupPulse", group, amount);
/** Blocks that ask for `count` particles of a kind at x, y. Kinds: debris, ember, spark, confetti, ring, smoke. */
export const emit = (d: D, kind: string, x: In, y: In, count: In) =>
  [d.addTo("eKind", kind), d.addTo("eX", x), d.addTo("eY", y), d.addTo("eCount", count)];

/** Initial list values the kit needs (merge into the project's listValues). */
export function kitLists() {
  return {
    glyphChars: font.glyphs.map(g => g.char), glyphWidth: font.glyphs.map(g => g.width),
    groupGen: Array(GROUPS).fill(0), groupPulse: Array(GROUPS).fill(0), groupColor: Array(GROUPS).fill(0),
    qText: [], qX: [], qY: [], qSize: [], qGroup: [], qMode: [], qFollow: [], qGen: [],
    eKind: [], eX: [], eY: [], eCount: [], slotX: [0, 0, 0, 0, 0, 0], slotY: [0, 0, 0, 0, 0, 0],
  } as Record<string, (number | string)[]>;
}

// ---------------------------------------------------------------- the Text sprite
/** The glyphs and banner words; words made for one game only go into that game. */
export function textCostumes(P: Project, game: string) {
  return [...font.glyphs.map(g => P.bitmap(g.name, png(g.name), g.width / 2, 30)),
    ...font.words.filter(w => !w.game || w.game === game).map(w => P.bitmap(`word-${w.name}`, png(`word-${w.name}`), w.width / 2, 30))];
}
export function textScripts(P: Project): Blocks {
  // Working variables are local too, so they never clash with a game's own variables.
  const B = new Blocks(P).local("isClone", "group", "gen", "mode", "follow", "offX", "offY", "base", "vy", "life",
    "t", "tSize", "w", "i", "k", "cx", "gw", "x0", "y0", "g");
  const d = dsl(B);
  const { v, add, sub, mul, div, eq, gt, lt, not, and, set, change, ifThen, ifElse, until, repeat, whenFlag, whenReceive,
    whenCloned, hide, show, goto, cloneMyself, deleteClone, costume, costumeTo, setSize, setEffect, item, length, itemNum,
    letterOf, textLength, join, deleteOf, define, call } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);

  // The original works through the queue, and makes the groups' pulses shrink.
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 0), [call("work"), call("calm")])], 20, 100);
  define("work", [
    until(eq(length("qText"), 0), [
      set("t", item("qText", 1)), set("tSize", item("qSize", 1)), set("group", item("qGroup", 1)),
      set("gen", item("qGen", 1)), set("mode", item("qMode", 1)), set("follow", item("qFollow", 1)),
      set("x0", item("qX", 1)), set("y0", item("qY", 1)),
      ...["qText", "qX", "qY", "qSize", "qGroup", "qMode", "qFollow", "qGen"].map(l => deleteOf(l, 1)),
      set("base", v("tSize")), set("life", 32), set("vy", 1.6), setSize(v("tSize")), setEffect("GHOST", 0),
      ifElse(eq(letterOf(1, v("t")), "w"), [
        // A banner word ("word-combo" and so on): one clone with that costume.
        costumeTo(v("t")), set("cx", v("x0")), call("place"),
      ], [
        // A number or symbols: measure first, then one clone per character, centred on x0.
        set("w", 0), set("i", 1),
        repeat(textLength(v("t")), [
          set("k", itemNum("glyphChars", letterOf(v("i"), v("t")))),
          ifElse(gt(v("k"), 0), [change("w", mul(mul(item("glyphWidth", v("k")), SPACING), div(v("tSize"), 100)))],
            [change("w", mul(20, div(v("tSize"), 100)))]),
          change("i", 1),
        ]),
        set("cx", sub(v("x0"), div(v("w"), 2))), set("i", 1),
        repeat(textLength(v("t")), [
          set("k", itemNum("glyphChars", letterOf(v("i"), v("t")))),
          ifElse(gt(v("k"), 0), [
            set("gw", mul(mul(item("glyphWidth", v("k")), SPACING), div(v("tSize"), 100))),
            costumeTo(v("k")), change("cx", div(v("gw"), 2)), call("place"), change("cx", div(v("gw"), 2)),
          ], [change("cx", mul(20, div(v("tSize"), 100)))]),
          change("i", 1),
        ]),
      ]),
    ]),
  ], { warp: true, x: 420, y: 20 });
  // One clone at (cx, y0). In follow mode its offset from the slot is kept.
  define("place", [
    set("offX", v("cx")), set("offY", v("y0")),
    ifElse(eq(v("mode"), "follow"),
      [goto(add(v("cx"), item("slotX", v("follow"))), add(v("y0"), item("slotY", v("follow"))))],
      [goto(v("cx"), v("y0"))]),
    cloneMyself(),
  ], { warp: true, x: 420, y: 900 });
  define("calm", [
    set("g", 1),
    repeat(GROUPS, [
      ifThen(gt(item("groupPulse", v("g")), 0.5), [d.replace("groupPulse", v("g"), mul(item("groupPulse", v("g")), 0.8))]),
      change("g", 1),
    ]),
  ], { warp: true, x: 420, y: 1200 });

  B.script(whenCloned(), [set("isClone", 1), show()], 20, 200);
  // Text is often drawn on a button; a click on the text tells the game which group was clicked.
  B.script(d.whenClicked(), [ifThen(eq(v("isClone"), 1), [set("clickedGroup", v("group")), d.broadcast("text click")])], 20, 260);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    ifElse(eq(v("mode"), "float"), [
      // A pop-up: rises, slows down, fades, goes.
      change("offY", v("vy")), set("vy", mul(v("vy"), 0.96)), change("life", -1),
      ifThen(lt(v("life"), 12), [d.changeEffect("GHOST", 8)]),
      goto(add(v("offX"), v("shakeX")), add(v("offY"), v("shakeY"))),
      setSize(mul(v("base"), div(add(100, item("groupPulse", v("group"))), 100))),
      ifThen(lt(v("life"), 1), [deleteClone()]),
    ], [
      ifThen(not(eq(v("gen"), item("groupGen", v("group")))), [deleteClone()]),
      ifElse(eq(v("mode"), "follow"), [
        goto(add(add(v("offX"), item("slotX", v("follow"))), v("shakeX")), add(add(v("offY"), item("slotY", v("follow"))), v("shakeY"))),
        // Hidden while the thing it follows is still above hideAbove (for example behind a score bar).
        ifElse(gt(item("slotY", v("follow")), v("hideAbove")), [d.hide()], [show()]),
      ], [goto(add(v("offX"), v("shakeX")), add(v("offY"), v("shakeY")))]),
      setSize(mul(v("base"), div(add(100, item("groupPulse", v("group"))), 100))),
      setEffect("COLOR", item("groupColor", v("group"))),
    ]),
  ])], 20, 300);
  void and; void costume; void hide;
  return B;
}

// ---------------------------------------------------------------- the Spark sprite: particles
const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const SPARK_COSTUMES: [string, string, number, number][] = [
  ["debris", svg(14, 12, `<path d="M2 6 L6 1 L12 3 L13 9 L6 11 z" fill="#8b6a52" stroke="#3f2a1c" stroke-width="1.5"/>`), 7, 6],
  ["ember", svg(10, 10, `<circle cx="5" cy="5" r="4" fill="#fdba74"/><circle cx="5" cy="5" r="2" fill="#fff7ed"/>`), 5, 5],
  ["spark", svg(18, 18, `<path d="M9 0 l2.2 6.8 l6.8 2.2 l-6.8 2.2 l-2.2 6.8 l-2.2 -6.8 l-6.8 -2.2 l6.8 -2.2 z" fill="#fde047"/>`), 9, 9],
  ...["#f43f5e", "#22c55e", "#3b82f6", "#eab308", "#a855f7"].map((c, i) =>
    [`confetti${i + 1}`, svg(10, 16, `<rect x="1" y="1" width="8" height="14" rx="2" fill="${c}"/>`), 5, 8] as [string, string, number, number]),
  ["ring", svg(60, 60, `<circle cx="30" cy="30" r="26" fill="none" stroke="#fff7d6" stroke-width="5"/>`), 30, 30],
  ["smoke", svg(30, 30, `<circle cx="15" cy="15" r="13" fill="#9ca3af" opacity="0.7"/>`), 15, 15],
];
export const sparkCostumes = (P: Project) => SPARK_COSTUMES.map(([n, s, x, y]) => P.costume(n, s, x, y));
export function sparkScripts(P: Project): Blocks {
  const B = new Blocks(P).local("isClone", "kind", "vx", "vy", "life", "fade", "spin", "n");
  const d = dsl(B);
  const { v, add, mul, eq, lt, set, change, ifThen, ifElse, repeat, until, whenFlag, whenReceive, whenCloned, hide, show,
    goto, cloneMyself, deleteClone, costume, costumeTo, setSize, setEffect, item, length, random, join, deleteOf, define,
    call, changeX, changeY, turn } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 0), [call("emit all")])], 20, 100);
  const kind = (k: string, body: any[]) => ifThen(eq(v("kind"), k), body);
  define("emit all", [
    until(eq(length("eKind"), 0), [
      set("kind", item("eKind", 1)), goto(item("eX", 1), item("eY", 1)), set("n", item("eCount", 1)),
      ...["eKind", "eX", "eY", "eCount"].map(l => deleteOf(l, 1)),
      repeat(v("n"), [
        setSize(100), setEffect("GHOST", 0), set("spin", 0), costumeTo(v("kind")),
        kind("debris", [set("vx", random(-6, 6)), set("vy", random(2, 9)), set("life", 40), set("spin", random(-20, 20)), setSize(random(70, 150))]),
        kind("ember", [set("vx", random(-1, 1)), set("vy", random(0.5, 2)), set("life", 16), setSize(random(60, 120))]),
        kind("spark", [set("vx", random(-8, 8)), set("vy", random(-8, 8)), set("life", 22)]),
        kind("confetti", [costumeTo(join("confetti", random(1, 5))), set("vx", random(-4, 4)), set("vy", random(2, 10)),
          set("life", 90), set("spin", random(-15, 15))]),
        kind("ring", [set("vx", 0), set("vy", 0), set("life", 14), setSize(40)]),
        kind("smoke", [set("vx", random(-1.5, 1.5)), set("vy", random(0.5, 1.5)), set("life", 30), setSize(random(60, 100))]),
        set("fade", d.div(100, v("life"))),
        cloneMyself(),
      ]),
    ]),
  ], { warp: true, x: 420, y: 20 });
  B.script(whenCloned(), [set("isClone", 1), show()], 20, 200);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    changeX(v("vx")), changeY(v("vy")), turn(v("spin")), d.changeEffect("GHOST", v("fade")), change("life", -1),
    kind("debris", [change("vy", -0.45)]),
    kind("spark", [set("vx", mul(v("vx"), 0.9)), set("vy", mul(v("vy"), 0.9))]),
    kind("confetti", [ifThen(lt(-3, v("vy")), [change("vy", -0.2)]), set("vx", mul(v("vx"), 0.97)), changeX(random(-1, 1))]),
    kind("ring", [d.changeSize(18)]),
    kind("smoke", [d.changeSize(3)]),
    ifThen(lt(v("life"), 1), [deleteClone()]),
  ])], 20, 300);
  void add; void ifElse; void costume; void show;
  return B;
}
