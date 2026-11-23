// Floating text sprites (.sprite3): score pop-ups and messages. To use one in a project:
//   set [fx text v] to (join [+] (points))
//   set [fx x v] to (x position)
//   set [fx y v] to (y position)
//   create clone of [FX Float Text v]
// Like the effect sprites, each one hides when the green flag is clicked and plays in a clone. The clone you make
// (the emitter, role empty) copies fx text, plays the sound, and makes one clone per letter (role "letter"): each
// letter knows its place (i of n), so it can move on its own. Then the emitter waits and deletes itself.
// Letters are costumes drawn with Scratch's own Marker font, with a dark outline. A character without a costume (a
// space, or one not in the font) makes no letter, but still takes its place.
import { Project, Blocks, dsl, sprite3 } from "../lib/sb3.ts";
import { FX_X, FX_Y } from "./effects.ts";

export const FX_TEXT = "fx text";
export const CHARS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-!?.,:'%$#*/=()&@"];
/** The distance from one letter to the next, at size 100%. */
export const ADVANCE = 24;

const esc = (c: string) => c.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");
// One letter: the outline first (a thick stroke), then the letter with a top-to-bottom gradient on top.
function glyph(c: string, top: string, bottom: string, id: string): string {
  const t = (extra: string) => `<text x="22" y="44" font-family="Marker" font-size="40" text-anchor="middle" ${extra}>${esc(c)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="56" viewBox="0 0 44 56">` +
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0.25" stop-color="${top}"/><stop offset="0.9" stop-color="${bottom}"/></linearGradient></defs>` +
    t(`fill="#2a2833" stroke="#2a2833" stroke-width="7" stroke-linejoin="round"`) + t(`fill="url(#${id})"`) + `</svg>`;
}
const font = (P: Project, top: string, bottom: string) => CHARS.map((c, i) => P.costume(c, glyph(c, top, bottom, `g${i}`), 22, 30));

type Style = { name: string; title: string; about: string; sound: string; length: number; colours: [string, string];
  letter: (d: ReturnType<typeof dsl>) => any[] };

const STYLES: Style[] = [
  { name: "FX Float Text", title: "Float text", about: "Letters pop in one after another, rise and fade: for points and pick-ups.",
    sound: "chime", length: 1.6, colours: ["#fff3b0", "#f59e0b"],
    letter: ({ v, mul, setSize, changeSize, show, front, wait, repeat, changeY, changeEffect }) => [
      setSize(10), wait(mul(0.03, v("i"))), front(), show(),
      repeat(6, [changeSize(22)]), repeat(3, [changeSize(-14)]),
      repeat(24, [changeY(1.5)]), repeat(10, [changeY(1.5), changeEffect("GHOST", 10)])] },
  { name: "FX Wave Text", title: "Wave text", about: "Letters ripple in a wave while the words float up: for messages like Level up!",
    sound: "blip", length: 2, colours: ["#e0fbff", "#0ea5e9"],
    letter: ({ v, add, mul, sin, set, change, setEffect, changeEffect, show, front, repeat, setY, yPos, ifThen, gt }) => [
      set("vy", yPos()), set("t", 0), setEffect("GHOST", 100), front(), show(),
      repeat(55, [
        // Each letter is a little behind the one before it in the wave (i × 45 degrees).
        setY(add(v("vy"), mul(9, sin(add(mul(v("t"), 20), mul(v("i"), 45)))))), change("vy", 0.6), change("t", 1),
        ifThen(gt(9, v("t")), [changeEffect("GHOST", -12.5)]), ifThen(gt(v("t"), 45), [changeEffect("GHOST", 10)])])] },
  { name: "FX Pop Text", title: "Pop text", about: "Big and bouncy: the word slams in, then the letters fly apart. For combos and KAPOW moments.",
    sound: "boing", length: 1.6, colours: ["#ffd6a5", "#ef4444"],
    letter: ({ v, mul, set, change, setSize, changeSize, show, front, wait, repeat, changeX, changeY, turn, changeEffect, random }) => [
      setSize(260), front(), show(),
      repeat(6, [changeSize(-30)]), repeat(3, [changeSize(7)]), wait(0.4),
      set("vx", mul(0.1, random(-40, 40))), set("vy", mul(0.1, random(30, 60))),
      repeat(20, [changeX(v("vx")), changeY(v("vy")), change("vy", -0.5), turn(mul(3, v("vx"))), changeEffect("GHOST", 5)])] },
];

export function textEffects(P: Project, sounds: Record<string, any>) {
  return STYLES.map(st => {
    const B = new Blocks(P).local("role", "text", "n", "i", "char", "vx", "vy", "t");
    const d = dsl(B);
    const { v, eq, not, sub, div, mul, add, set, change, whenFlag, whenCloned, hide, goto, startSound, wait, deleteClone, ifThen, repeat,
      cloneMyself, define, call, letterOf, textLength, costumeTo, costumeName, changeX, point } = d;
    B.script(whenFlag(), [hide(), set("role", "")], 20, 20);
    // The emitter: copy the text (fx text may change straight away), then spell it.
    B.script(whenCloned(), [ifThen(eq(v("role"), ""), [
      hide(), goto(v(FX_X), v(FX_Y)), point(90), set("text", v(FX_TEXT)), set("n", textLength(v("text"))), set("i", 0),
      startSound(st.sound), call("spell"), wait(st.length), deleteClone()])], 20, 140);
    // One clone per character, each with its own i and char ("run without screen refresh": all at once).
    define("spell", [set("role", "letter"), repeat(v("n"), [change("i", 1), set("char", letterOf(v("i"), v("text"))), cloneMyself()]), set("role", "")],
      { warp: true, x: 20, y: 400 });
    // A letter: move to its place in the word (centred on fx x), wear its costume, and play.
    B.script(whenCloned(), [ifThen(eq(v("role"), "letter"), [
      changeX(mul(sub(v("i"), div(add(v("n"), 1), 2)), ADVANCE)),
      costumeTo(v("char")),
      ifThen(not(eq(costumeName(), v("char"))), [deleteClone()]),
      ...st.letter(d), deleteClone()])], 20, 560);
    const sprite = P.sprite(st.name, { blocks: B, costumes: font(P, ...st.colours), sounds: [sounds[st.sound]], layer: 1, visible: false });
    return { ...st, costumes: [], build: () => {}, sprite, section: "text", file: () => sprite3(P, sprite) };
  });
}
