// Places a sprite's scripts in the Scratch editor the way a tidy person would, so they never overlap:
//   - in columns, left to right: green flag scripts first, then other events (keys, clicks, messages), then
//     "when I start as a clone" scripts, then custom block definitions;
//   - a column ends when it gets tall, or when the next script is of another kind;
//   - small, fixed irregularities in the gaps and in x, so it looks placed by hand (the same on every build).
// Sizes are estimated from each script's scratchblocks text: rows of blocks, with extra height for hats, nested
// reporters and the arms of C blocks, and a width from the text and its inputs. The numbers were fitted to the sizes
// scratchblocks draws in the Scratch 3 style (which match the editor's blocks) for about 300 of our scripts, and are
// slightly generous; the gaps between scripts add more room.
import { scriptsWithIds } from "../tools/scratchblocks/to-scratchblocks.ts";

const HAT = /^(when |define |event_when|control_start_as_clone)/;

function depth(s: string): number {
  let m = 0, c = 0;
  for (const ch of s) { if ("(<[".includes(ch)) m = Math.max(m, ++c); else if (")>]".includes(ch)) c--; }
  return m;
}

/** Estimated size of a script in editor units (zoom 100%), from its scratchblocks text. */
export function scriptSize(text: string): { w: number; h: number } {
  const lines = text.split("\n");
  let w = 0, h = 0;
  lines.forEach((line, i) => {
    const indent = (line.length - line.trimStart().length) / 2, s = line.trim().replace(/\s*::\s*\w+/g, "");
    if (i === 0 && HAT.test(line.trim())) h += 80 + (s.startsWith("define") ? 24 : 0);
    else if (s === "end") h += 32;
    else if (s === "else") h += 40;
    else h += 52 + Math.max(0, depth(s) - 1) * 8;
    // An empty C block mouth still has room for one block.
    const opens = s.endsWith(" then") || s.startsWith("repeat") || s === "forever" || s === "else";
    if (opens && ["end", "else"].includes(lines[i + 1]?.trim() ?? "")) h += 24;
    const bools = (s.match(/</g) ?? []).length, inputs = (s.match(/[([]/g) ?? []).length;
    w = Math.max(w, indent * 16 + s.length * 7.5 + bools * 32 + inputs * 12 + 40);
  });
  return { w: Math.ceil(w), h: Math.ceil(h) };
}

const KIND: Record<string, number> = {
  event_whenflagclicked: 0,
  event_whenkeypressed: 1, event_whenthisspriteclicked: 1, event_whenstageclicked: 1, event_whenbackdropswitchesto: 1,
  event_whengreaterthan: 1, event_whenbroadcastreceived: 2,
  control_start_as_clone: 3, procedures_definition: 4,
};
// Kinds that share columns: all events together; clone scripts; definitions; anything else.
const GROUP = [0, 0, 0, 1, 2];
const COLUMN_HEIGHT = 1500;

/** Sets x and y of every script in a sprite's block map (in place). Scripts keep their order within a kind. */
export function layoutScripts(blocks: Record<string, any>): void {
  const items = scriptsWithIds(blocks).map(([id, text], i) => {
    const b = blocks[id], kind = KIND[b.opcode] ?? 5;
    return { id, i, kind, group: GROUP[kind] ?? 3, hx: b.x ?? 0, hy: b.y ?? 0, ...scriptSize(text) };
  });
  // By kind, then where the author put them (x, then y), then the order they were made.
  items.sort((a, b) => a.kind - b.kind || a.hx - b.hx || a.hy - b.hy || a.i - b.i);
  // Small irregularities that are the same on every build: a number from 0 to 1 per script.
  const wobble = (n: number, salt: number) => ((n * 7919 + salt * 104729) % 1000) / 1000;
  let x = 40, y = 40, colWidth = 0, group = -1, inColumn = 0;
  items.forEach((it, n) => {
    const newColumn = inColumn > 0 && (it.group !== group || y + it.h > COLUMN_HEIGHT);
    if (newColumn) { x += colWidth + 56 + Math.round(wobble(n, 1) * 40); y = 40 + Math.round(wobble(n, 2) * 24); colWidth = 0; inColumn = 0; }
    const dx = Math.round(wobble(n, 3) * 18);
    Object.assign(blocks[it.id], { x: x + dx, y });
    y += it.h + 40 + Math.round(wobble(n, 4) * 32);
    colWidth = Math.max(colWidth, it.w + dx);
    group = it.group; inColumn++;
  });
}
