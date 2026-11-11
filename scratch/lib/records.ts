// Records: a table kept as parallel lists, one list per field ("meteor.x", "meteor.y", ...).
// Row i is item i of every list. Field names are checked by TypeScript, so a typo does not build.
//
//   const meteor = record(d, "meteor", ["x", "y", "ans"]);
//   meteor.add({ x: 0, y: 180, ans: 12 }), meteor.change("y", i, -2), meteor.get("ans", i), meteor.remove(i)
//   meteor.each("i", [ ...statements using { v: "i" } ... ])
import type { dsl, In, Ref } from "./sb3.ts";

type D = ReturnType<typeof dsl>;

export function record<F extends string>(d: D, name: string, fields: readonly F[]) {
  const list = (f: F) => `${name}.${f}`;
  const first = fields[0];
  return {
    name, fields,
    list,
    /** The number of rows. */
    count: (): Ref => d.length(list(first)),
    /** Field f of row i. */
    get: (f: F, i: In): Ref => d.item(list(f), i),
    set: (f: F, i: In, x: In): Ref => d.replace(list(f), i, x),
    change: (f: F, i: In, by: In): Ref => d.replace(list(f), i, d.add(d.item(list(f), i), by)),
    /** A new row at the end; fields left out are empty. */
    add: (row: Partial<Record<F, In>>): Ref[] => fields.map(f => d.addTo(list(f), row[f] ?? "")),
    remove: (i: In): Ref[] => fields.map(f => d.deleteOf(list(f), i)),
    clear: (): Ref[] => fields.map(f => d.deleteAll(list(f))),
    /** The first row whose field f is x, or 0. */
    find: (f: F, x: In): Ref => d.itemNum(list(f), x),
    /** Runs stmts for every row, with the row number in variable `index`. Rows removed inside are skipped
     *  correctly: it walks from the last row to the first. */
    each: (index: string, stmts: Ref[]): Ref[] => [
      d.set(index, d.length(list(first))),
      d.repeat(d.length(list(first)), [...stmts, d.change(index, -1)]),
    ],
  };
}
export type Record_<F extends string> = ReturnType<typeof record<F>>;
