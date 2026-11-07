// Shared builder for Scratch 3 projects (.sb3): blocks, variables, costumes, monitors and zip packaging.
// No packages needed; run scripts with: node --experimental-strip-types --no-warnings <script>.ts
import { createHash } from "node:crypto";

export type Ref = { id: string };
export type VarRef = { v: string };
export type In = number | string | Ref | VarRef;

export class Project {
  private uid = 0;
  vars: Record<string, string> = {};
  lists: Record<string, string> = {};
  bcasts: Record<string, string> = {};
  assets: Record<string, string> = {};

  nid(prefix: string) { return `${prefix}${(++this.uid).toString(36)}`; }
  varId(n: string) { return (this.vars[n] ??= this.nid("var")); }
  listId(n: string) { return (this.lists[n] ??= this.nid("list")); }
  bcastId(n: string) { return (this.bcasts[n] ??= this.nid("msg")); }

  costume(name: string, svg: string, cx: number, cy: number) {
    const md5 = createHash("md5").update(svg).digest("hex");
    this.assets[`${md5}.svg`] = svg;
    return { name, dataFormat: "svg", assetId: md5, md5ext: `${md5}.svg`, rotationCenterX: cx, rotationCenterY: cy };
  }

  sprite(name: string, opts: { blocks?: Blocks; costumes: any[]; layer: number; x?: number; y?: number }) {
    // A block with no parent that does not start a script was created but never placed.
    const strays = Object.values(opts.blocks?.map ?? {}).filter((b: any) => b.parent === null && !b.topLevel);
    if (strays.length) throw new Error(`${name}: ${strays.length} stray blocks (${strays.map((b: any) => b.opcode).join(", ")})`);
    return {
      isStage: false, name, variables: {}, lists: {}, broadcasts: {}, blocks: opts.blocks?.map ?? {}, comments: {},
      currentCostume: 0, costumes: opts.costumes, sounds: [], volume: 100, layerOrder: opts.layer, visible: true,
      x: opts.x ?? 0, y: opts.y ?? 0, size: 100, direction: 90, draggable: false, rotationStyle: "all around",
    };
  }

  // Assembles project.json and packs it with the costume files.
  build(opts: { backdrop: any; sprites: any[]; stage?: Blocks; listValues?: Record<string, (number | string)[]>; shown?: string[] }): Buffer {
    const shown = opts.shown ?? [];
    shown.forEach(n => this.varId(n));
    const project = {
      targets: [
        {
          isStage: true, name: "Stage",
          variables: Object.fromEntries(Object.entries(this.vars).map(([n, id]) => [id, [n, 0]])),
          lists: Object.fromEntries(Object.entries(this.lists).map(([n, id]) => [id, [n, opts.listValues?.[n] ?? []]])),
          broadcasts: Object.fromEntries(Object.entries(this.bcasts).map(([n, id]) => [id, n])),
          blocks: opts.stage ? this.sprite("Stage", { blocks: opts.stage, costumes: [], layer: 0 }).blocks : {},
          comments: {}, currentCostume: 0, costumes: [opts.backdrop], sounds: [], volume: 100,
          layerOrder: 0, tempo: 60, videoTransparency: 50, videoState: "on", textToSpeechLanguage: null,
        },
        ...opts.sprites,
      ],
      monitors: shown.map((n, i) => ({
        id: this.vars[n], mode: "default", opcode: "data_variable", params: { VARIABLE: n }, spriteName: null,
        value: 0, width: 0, height: 0, x: i < 3 ? 5 : 375, y: 5 + (i % 3) * 27, visible: true,
        sliderMin: 0, sliderMax: 100, isDiscrete: true,
      })),
      extensions: [],
      meta: { semver: "3.0.0", vm: "0.2.0", agent: "scratch/lib/sb3.ts" },
    };
    const files: Record<string, Buffer> = { "project.json": Buffer.from(JSON.stringify(project)) };
    for (const [name, content] of Object.entries(this.assets)) files[name] = Buffer.from(content);
    return zip(files);
  }
}

export class Blocks {
  map: Record<string, any> = {};
  readonly project: Project;
  constructor(project: Project) { this.project = project; }

  add(opcode: string, inputs: Record<string, any[]> = {}, fields: Record<string, any> = {}, extra: Record<string, any> = {}): Ref {
    const id = this.project.nid("b");
    this.map[id] = { opcode, next: null, parent: null, inputs, fields, shadow: false, topLevel: false, ...extra };
    for (const slot of Object.values(inputs))
      for (const x of slot.slice(1)) if (typeof x === "string" && this.map[x]) this.map[x].parent = id;
    return { id };
  }

  shadow(opcode: string, fields: Record<string, any>): string {
    return this.add(opcode, {}, fields, { shadow: true }).id;
  }

  chain(stmts: Ref[]): string {
    stmts.forEach((s, i) => {
      const b = this.map[s.id];
      if (i > 0) b.parent = stmts[i - 1].id;
      if (i < stmts.length - 1) b.next = stmts[i + 1].id;
    });
    return stmts[0].id;
  }

  script(hat: Ref, stmts: Ref[], x = 0, y = 0) {
    Object.assign(this.map[hat.id], { topLevel: true, x, y });
    this.chain([hat, ...stmts]);
  }
}

// Block-building helpers bound to one sprite's block map.
export function dsl(B: Blocks) {
  const P = B.project;
  const num = (x: In): any[] => {
    if (typeof x === "number") return [1, [4, String(x)]];
    if (typeof x === "string") return [1, [10, x]];
    if ("v" in x) return [3, [12, x.v, P.varId(x.v)], [4, "0"]];
    return [3, x.id, [4, "0"]];
  };
  const txt = (x: In): any[] => {
    if (typeof x === "number" || typeof x === "string") return [1, [10, String(x)]];
    if ("v" in x) return [3, [12, x.v, P.varId(x.v)], [10, ""]];
    return [3, x.id, [10, ""]];
  };
  const bool = (r: Ref) => [2, r.id];
  const arith = (op: string) => (a: In, b: In) => B.add(op, { NUM1: num(a), NUM2: num(b) });
  const cmp = (op: string) => (a: In, b: In) => B.add(op, { OPERAND1: txt(a), OPERAND2: txt(b) });
  const logic = (op: string) => (a: Ref, b: Ref) => B.add(op, { OPERAND1: bool(a), OPERAND2: bool(b) });
  const mathop = (fn: string) => (x: In) => B.add("operator_mathop", { NUM: num(x) }, { OPERATOR: [fn, null] });
  const sub = (stmts: Ref[]) => [2, B.chain(stmts)];
  return {
    v: (name: string): VarRef => ({ v: name }),
    add: arith("operator_add"), sub: arith("operator_subtract"),
    mul: arith("operator_multiply"), div: arith("operator_divide"),
    lt: cmp("operator_lt"), gt: cmp("operator_gt"), eq: cmp("operator_equals"),
    and: logic("operator_and"), or: logic("operator_or"),
    not: (a: Ref) => B.add("operator_not", { OPERAND: bool(a) }),
    sin: mathop("sin"), cos: mathop("cos"), abs: mathop("abs"),
    round: (x: In) => B.add("operator_round", { NUM: num(x) }),
    join: (a: In, b: In) => B.add("operator_join", { STRING1: txt(a), STRING2: txt(b) }),
    item: (list: string, idx: In) => B.add("data_itemoflist", { INDEX: num(idx) }, { LIST: [list, P.listId(list)] }),
    length: (list: string) => B.add("data_lengthoflist", {}, { LIST: [list, P.listId(list)] }),
    set: (name: string, x: In) => B.add("data_setvariableto", { VALUE: txt(x) }, { VARIABLE: [name, P.varId(name)] }),
    change: (name: string, x: In) => B.add("data_changevariableby", { VALUE: num(x) }, { VARIABLE: [name, P.varId(name)] }),
    key: (k: string) => B.add("sensing_keypressed", { KEY_OPTION: [1, B.shadow("sensing_keyoptions", { KEY_OPTION: [k, null] })] }),
    touching: (sprite: string) => B.add("sensing_touchingobject", {
      TOUCHINGOBJECTMENU: [1, B.shadow("sensing_touchingobjectmenu", { TOUCHINGOBJECTMENU: [sprite, null] })] }),
    direction: () => B.add("motion_direction"),
    goto: (x: In, y: In) => B.add("motion_gotoxy", { X: num(x), Y: num(y) }),
    point: (d: number) => B.add("motion_pointindirection", { DIRECTION: [1, [8, String(d)]] }),
    turn: (d: number) => B.add("motion_turnright", { DEGREES: num(d) }),
    turnLeft: (d: number) => B.add("motion_turnleft", { DEGREES: num(d) }),
    deleteAll: (list: string) => B.add("data_deletealloflist", {}, { LIST: [list, P.listId(list)] }),
    addTo: (list: string, x: In) => B.add("data_addtolist", { ITEM: txt(x) }, { LIST: [list, P.listId(list)] }),
    costume: (name: string) => B.add("looks_switchcostumeto", { COSTUME: [1, B.shadow("looks_costume", { COSTUME: [name, null] })] }),
    show: () => B.add("looks_show"),
    hide: () => B.add("looks_hide"),
    front: () => B.add("looks_gotofrontback", {}, { FRONT_BACK: ["front", null] }),
    say: (m: In) => B.add("looks_say", { MESSAGE: txt(m) }),
    sayFor: (m: In, s: number) => B.add("looks_sayforsecs", { MESSAGE: txt(m), SECS: num(s) }),
    broadcast: (name: string) => B.add("event_broadcast", { BROADCAST_INPUT: [1, [11, name, P.bcastId(name)]] }),
    whenFlag: () => B.add("event_whenflagclicked"),
    whenReceive: (name: string) => B.add("event_whenbroadcastreceived", {}, { BROADCAST_OPTION: [name, P.bcastId(name)] }),
    ifThen: (c: Ref, a: Ref[]) => B.add("control_if", { CONDITION: bool(c), SUBSTACK: sub(a) }),
    ifElse: (c: Ref, a: Ref[], b: Ref[]) => B.add("control_if_else", { CONDITION: bool(c), SUBSTACK: sub(a), SUBSTACK2: sub(b) }),
    repeat: (n: In, a: Ref[]) => B.add("control_repeat", { TIMES: num(n), SUBSTACK: sub(a) }),
    until: (c: Ref, a: Ref[]) => B.add("control_repeat_until", { CONDITION: bool(c), SUBSTACK: sub(a) }),
    stopThis: () => B.add("control_stop", {}, { STOP_OPTION: ["this script", null] },
      { mutation: { tagName: "mutation", children: [], hasnext: "false" } }),
  };
}

// ---------------------------------------------------------------- zip (store only, no compression)
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function zip(files: Record<string, Buffer>): Buffer {
  const local: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const n = Buffer.from(name), crc = crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    local.push(h, n, data); central.push(c, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, end]);
}
