// Builds dust-hopper.sb3: a single-screen landing game for Scratch 3.
// Physics follow the per-frame model of the 1979 arcade lander:
//   thrust table lookup -> split by sin/cos of angle -> v += thrust - gravity -> pos += v
// Run: node --experimental-strip-types --no-warnings build.ts
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------- block builder
type Ref = { id: string };
type VarRef = { v: string };
type In = number | string | Ref | VarRef;

let uid = 0;
const nid = (p: string) => `${p}${(++uid).toString(36)}`;

const VARS: Record<string, string> = {};
const LISTS: Record<string, string> = {};
const BCASTS: Record<string, string> = {};
const varId = (n: string) => (VARS[n] ??= nid("var"));
const listId = (n: string) => (LISTS[n] ??= nid("list"));
const bcastId = (n: string) => (BCASTS[n] ??= nid("msg"));

class Blocks {
  map: Record<string, any> = {};

  add(opcode: string, inputs: Record<string, any[]> = {}, fields: Record<string, any> = {}, extra: Record<string, any> = {}): Ref {
    const id = nid("b");
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

// Input encoders
const isRef = (x: any): x is Ref => typeof x === "object" && "id" in x;
function num(x: In): any[] {
  if (typeof x === "number") return [1, [4, String(x)]];
  if (typeof x === "string") return [1, [10, x]];
  if ("v" in x) return [3, [12, x.v, varId(x.v)], [4, "0"]];
  return [3, x.id, [4, "0"]];
}
function txt(x: In): any[] {
  if (typeof x === "number" || typeof x === "string") return [1, [10, String(x)]];
  if ("v" in x) return [3, [12, x.v, varId(x.v)], [10, ""]];
  return [3, x.id, [10, ""]];
}
const bool = (r: Ref) => [2, r.id];

// DSL bound to one sprite's block map
function dsl(B: Blocks) {
  const v = (name: string): VarRef => ({ v: name });
  const arith = (op: string) => (a: In, b: In) => B.add(op, { NUM1: num(a), NUM2: num(b) });
  const cmp = (op: string) => (a: In, b: In) => B.add(op, { OPERAND1: txt(a), OPERAND2: txt(b) });
  const logic = (op: string) => (a: Ref, b: Ref) => B.add(op, { OPERAND1: bool(a), OPERAND2: bool(b) });
  const mathop = (fn: string) => (x: In) => B.add("operator_mathop", { NUM: num(x) }, { OPERATOR: [fn, null] });
  const sub = (stmts: Ref[]) => [2, B.chain(stmts)];
  return {
    v,
    add: arith("operator_add"), sub: arith("operator_subtract"),
    mul: arith("operator_multiply"), div: arith("operator_divide"),
    lt: cmp("operator_lt"), gt: cmp("operator_gt"), eq: cmp("operator_equals"),
    and: logic("operator_and"), or: logic("operator_or"),
    not: (a: Ref) => B.add("operator_not", { OPERAND: bool(a) }),
    sin: mathop("sin"), cos: mathop("cos"), abs: mathop("abs"),
    round: (x: In) => B.add("operator_round", { NUM: num(x) }),
    join: (a: In, b: In) => B.add("operator_join", { STRING1: txt(a), STRING2: txt(b) }),
    item: (list: string, idx: In) => B.add("data_itemoflist", { INDEX: num(idx) }, { LIST: [list, listId(list)] }),
    length: (list: string) => B.add("data_lengthoflist", {}, { LIST: [list, listId(list)] }),
    set: (name: string, x: In) => B.add("data_setvariableto", { VALUE: txt(x) }, { VARIABLE: [name, varId(name)] }),
    change: (name: string, x: In) => B.add("data_changevariableby", { VALUE: num(x) }, { VARIABLE: [name, varId(name)] }),
    key: (k: string) => B.add("sensing_keypressed", { KEY_OPTION: [1, B.shadow("sensing_keyoptions", { KEY_OPTION: [k, null] })] }),
    touching: (sprite: string) => B.add("sensing_touchingobject", {
      TOUCHINGOBJECTMENU: [1, B.shadow("sensing_touchingobjectmenu", { TOUCHINGOBJECTMENU: [sprite, null] })] }),
    direction: () => B.add("motion_direction"),
    goto: (x: In, y: In) => B.add("motion_gotoxy", { X: num(x), Y: num(y) }),
    point: (d: number) => B.add("motion_pointindirection", { DIRECTION: [1, [8, String(d)]] }),
    turn: (d: number) => B.add("motion_turnright", { DEGREES: num(d) }),
    costume: (name: string) => B.add("looks_switchcostumeto", { COSTUME: [1, B.shadow("looks_costume", { COSTUME: [name, null] })] }),
    show: () => B.add("looks_show"),
    hide: () => B.add("looks_hide"),
    front: () => B.add("looks_gotofrontback", {}, { FRONT_BACK: ["front", null] }),
    say: (m: In) => B.add("looks_say", { MESSAGE: txt(m) }),
    sayFor: (m: In, s: number) => B.add("looks_sayforsecs", { MESSAGE: txt(m), SECS: num(s) }),
    broadcast: (name: string) => B.add("event_broadcast", { BROADCAST_INPUT: [1, [11, name, bcastId(name)]] }),
    whenFlag: () => B.add("event_whenflagclicked"),
    whenReceive: (name: string) => B.add("event_whenbroadcastreceived", {}, { BROADCAST_OPTION: [name, bcastId(name)] }),
    ifThen: (c: Ref, a: Ref[]) => B.add("control_if", { CONDITION: bool(c), SUBSTACK: sub(a) }),
    ifElse: (c: Ref, a: Ref[], b: Ref[]) => B.add("control_if_else", { CONDITION: bool(c), SUBSTACK: sub(a), SUBSTACK2: sub(b) }),
    repeat: (n: In, a: Ref[]) => B.add("control_repeat", { TIMES: num(n), SUBSTACK: sub(a) }),
    until: (c: Ref, a: Ref[]) => B.add("control_repeat_until", { CONDITION: bool(c), SUBSTACK: sub(a) }),
    stopThis: () => B.add("control_stop", {}, { STOP_OPTION: ["this script", null] },
      { mutation: { tagName: "mutation", children: [], hasnext: "false" } }),
  };
}

// ---------------------------------------------------------------- level data
// Ground outline in Scratch coordinates (x: -240..240, y: -180..180).
const PADS = [
  { l: -150, r: -80, y: -130, mult: 2 },
  { l: 36, r: 68, y: -75, mult: 5 },
  { l: 140, r: 185, y: -110, mult: 3 },
];
const GROUND: [number, number][] = [
  [-240, -60], [-215, -95], [-190, -80], [-165, -120], [-150, -130], [-80, -130], [-60, -100], [-40, -60],
  [-20, -85], [0, -40], [20, -70], [36, -75], [68, -75], [85, -40], [105, -20], [125, -60], [140, -110],
  [185, -110], [205, -80], [225, -50], [240, -70],
];
// Thrust table from the original source (TRSTAB), plus a boost level.
const THRUST_TABLE = [0, 2, 5, 8, 11, 13, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28, 40];

// ---------------------------------------------------------------- artwork (SVG)
const sx = (x: number) => x + 240;
const sy = (y: number) => 180 - y;
const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const stars = Array.from({ length: 70 }, () =>
  `<circle cx="${(rand() * 480).toFixed(1)}" cy="${(rand() * 300).toFixed(1)}" r="${(rand() * 1.2 + 0.3).toFixed(2)}" fill="#ffffff" opacity="${(rand() * 0.6 + 0.3).toFixed(2)}"/>`).join("");

const backdrop = svg(480, 360,
  `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#090b1f"/><stop offset="1" stop-color="#22184a"/></linearGradient></defs>` +
  `<rect width="480" height="360" fill="url(#sky)"/>${stars}` +
  `<circle cx="420" cy="70" r="46" fill="#3d6f8f"/><circle cx="406" cy="58" r="46" fill="#22184a" opacity="0.55"/>` +
  `<ellipse cx="420" cy="70" rx="72" ry="10" fill="none" stroke="#9fc6dc" stroke-width="2" opacity="0.6" transform="rotate(-18 420 70)"/>`);

const groundPts = [...GROUND.map(([x, y]) => `${sx(x)},${sy(y)}`), `480,360`, `0,360`].join(" ");
const craters = [[-200, -150, 14], [-30, -140, 20], [110, -150, 12], [200, -160, 18], [-110, -165, 9]]
  .map(([x, y, r]) => `<ellipse cx="${sx(x)}" cy="${sy(y)}" rx="${r}" ry="${r * 0.45}" fill="#4a3a52"/>`).join("");
const ground = svg(480, 360, `<polygon points="${groundPts}" fill="#6b5468" stroke="#c7a9b8" stroke-width="2" stroke-linejoin="round"/>${craters}`);

const pads = svg(480, 360, PADS.map(p =>
  `<rect x="${sx(p.l)}" y="${sy(p.y + 4)}" width="${p.r - p.l}" height="4" fill="#ffd23f"/>` +
  `<circle cx="${sx(p.l) + 2}" cy="${sy(p.y + 7)}" r="2" fill="#ff4f5e"/><circle cx="${sx(p.r) - 2}" cy="${sy(p.y + 7)}" r="2" fill="#ff4f5e"/>` +
  `<text x="${sx((p.l + p.r) / 2)}" y="${sy(p.y - 16)}" font-family="Sans Serif" font-size="13" font-weight="bold" fill="#ffd23f" text-anchor="middle">x${p.mult}</text>`).join(""));

// Drone: 40 x 50 canvas, centre (20, 20); feet at y = 33.
const droneBody =
  `<g stroke="#c9d1e0" stroke-width="2" stroke-linecap="round"><line x1="13" y1="24" x2="8" y2="33"/><line x1="27" y1="24" x2="32" y2="33"/>` +
  `<line x1="5" y1="33" x2="11" y2="33"/><line x1="29" y1="33" x2="35" y2="33"/><line x1="20" y1="14" x2="20" y2="8"/></g>` +
  `<circle cx="20" cy="7" r="1.8" fill="#ff4f5e"/><rect x="17" y="26" width="6" height="4" fill="#59606e"/>` +
  `<polygon points="12,14 28,14 31,21 25,27 15,27 9,21" fill="#e8833a" stroke="#7a3a12" stroke-width="1.2" stroke-linejoin="round"/>` +
  `<circle cx="20" cy="19.5" r="4" fill="#7fe0ff" stroke="#1f4e63" stroke-width="1"/>`;
const flame = (len: number) =>
  `<polygon points="17,30 23,30 20,${30 + len}" fill="#ffb13b"/><polygon points="18.5,30 21.5,30 20,${30 + len * 0.6}" fill="#fff3b0"/>`;
const drone = svg(40, 50, droneBody);
const droneFlame = svg(40, 50, flame(9) + droneBody);
const droneBoost = svg(40, 50, flame(17) + droneBody);
const spikes = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2, r = i % 2 ? 9 : 19;
  return `${(20 + r * Math.cos(a)).toFixed(1)},${(20 + r * Math.sin(a)).toFixed(1)}`;
}).join(" ");
const boom = svg(40, 50, `<polygon points="${spikes}" fill="#ff7a2f"/><circle cx="20" cy="20" r="7" fill="#ffe066"/>`);

// ---------------------------------------------------------------- assets
const ASSETS: Record<string, string> = {};
function costume(name: string, content: string, cx: number, cy: number) {
  const md5 = createHash("md5").update(content).digest("hex");
  ASSETS[`${md5}.svg`] = content;
  return { name, dataFormat: "svg", assetId: md5, md5ext: `${md5}.svg`, rotationCenterX: cx, rotationCenterY: cy };
}

// ---------------------------------------------------------------- scripts
function staticSprite(): Blocks {
  const B = new Blocks(), d = dsl(B);
  B.script(d.whenFlag(), [d.goto(0, 0), d.show()]);
  return B;
}

function droneScripts(): Blocks {
  const B = new Blocks();
  const { v, add, sub, mul, div, lt, gt, eq, and, or, not, sin, cos, abs, round, join, item, length, set, change,
    key, touching, direction, goto, point, turn, costume, show, front, say, sayFor, broadcast, whenFlag, whenReceive,
    ifThen, ifElse, repeat, until, stopThis } = dsl(B);

  B.script(whenFlag(), [
    set("gravity", 0.035), set("Score", 0), set("fuelLeft", 1000), set("Fuel", 1000),
    set("Throttle", 0), set("Drift", 0), set("Descent", 0),
    goto(-60, 150), point(90), costume("drone"), show(), front(),
    sayFor("Up/Down: throttle. Left/Right: tilt. Space: boost. Land gently on a yellow pad!", 4),
    broadcast("new round"),
  ], 20, 20);

  // Landing check: find the pad under the drone, then apply the original rules
  // (upright within one rotation step, low sideways speed, descent speed decides good/hard/crash).
  const landingCheck = [
    set("mult", 0), set("i", 1),
    repeat(length("padLeft"), [
      ifThen(and(gt(v("posX"), item("padLeft", v("i"))), lt(v("posX"), item("padRight", v("i")))),
        [set("mult", item("padMult", v("i")))]),
      change("i", 1),
    ]),
    ifElse(or(or(eq(v("mult"), 0), gt(abs(v("angle")), 12)), gt(abs(v("vx")), 1)),
      [set("state", "crash")],
      [ifElse(lt(mul(v("vy"), -1), 1), [set("state", "good")],
        [ifElse(lt(mul(v("vy"), -1), 1.8), [set("state", "hard")], [set("state", "crash")])])]),
  ];

  const frame = [
    // Controls: one step per press, repeating while held.
    ifElse(gt(v("cooldown"), 0), [change("cooldown", -1)], [
      ifThen(and(key("up arrow"), lt(v("Throttle"), 15)), [change("Throttle", 1), set("cooldown", 3)]),
      ifThen(and(key("down arrow"), gt(v("Throttle"), 0)), [change("Throttle", -1), set("cooldown", 3)]),
      ifThen(key("right arrow"), [turn(11.25), set("cooldown", 4)]),
      ifThen(key("left arrow"), [turn(-11.25), set("cooldown", 4)]),
    ]),
    set("level", v("Throttle")),
    ifThen(key("space"), [set("level", 16)]),
    ifThen(lt(v("fuelLeft"), 0.01), [set("level", 0)]),
    // Thrust from the table, scaled so that table value 17 equals gravity.
    set("force", mul(item("thrustTable", add(v("level"), 1)), div(v("gravity"), 17))),
    change("fuelLeft", mul(item("thrustTable", add(v("level"), 1)), -0.05)),
    ifThen(lt(v("fuelLeft"), 0), [set("fuelLeft", 0)]),
    // Angle from upright: 0 = upright, positive = tilted right.
    set("angle", sub(direction(), 90)),
    ifThen(lt(v("angle"), -180), [change("angle", 360)]),
    change("vx", mul(v("force"), sin(v("angle")))),
    change("vy", sub(mul(v("force"), cos(v("angle"))), v("gravity"))),
    change("posX", v("vx")), change("posY", v("vy")),
    // Wrap sideways and cap the top, using our own position variables.
    ifThen(gt(v("posX"), 230), [change("posX", -460)]),
    ifThen(lt(v("posX"), -230), [change("posX", 460)]),
    ifThen(gt(v("posY"), 165), [set("posY", 165), ifThen(gt(v("vy"), 0), [set("vy", 0)])]),
    goto(v("posX"), v("posY")),
    // Test collisions with the plain costume so the flame never counts.
    costume("drone"),
    ifElse(touching("Pads"), landingCheck, [ifThen(touching("Ground"), [set("state", "crash")])]),
    ifThen(and(eq(v("state"), "flying"), gt(v("level"), 0)),
      [ifElse(lt(v("level"), 9), [costume("drone-flame")], [costume("drone-boost")])]),
    set("Fuel", round(v("fuelLeft"))),
    set("Drift", round(mul(v("vx"), 10))),
    set("Descent", round(mul(v("vy"), -10))),
  ];

  B.script(whenReceive("new round"), [
    set("posX", -60), set("posY", 150), set("vx", 1.2), set("vy", 0),
    set("Throttle", 0), set("cooldown", 0), set("state", "flying"),
    point(90), costume("drone"), show(), front(),
    until(not(eq(v("state"), "flying")), frame),
    ifThen(eq(v("state"), "good"), [
      change("Score", mul(50, v("mult"))), change("fuelLeft", 50),
      sayFor(join("Perfect landing! x", v("mult")), 2)]),
    ifThen(eq(v("state"), "hard"), [
      change("Score", mul(15, v("mult"))),
      sayFor(join("Hard landing. x", v("mult")), 2)]),
    ifThen(eq(v("state"), "crash"), [
      costume("boom"), change("fuelLeft", -150),
      ifThen(lt(v("fuelLeft"), 0), [set("fuelLeft", 0)]),
      sayFor("Crashed! -150 fuel", 2)]),
    set("Fuel", round(v("fuelLeft"))),
    ifElse(gt(v("fuelLeft"), 0), [broadcast("new round")],
      [say(join("Out of fuel. Final score: ", v("Score"))), stopThis()]),
  ], 20, 420);

  return B;
}

// ---------------------------------------------------------------- project
const droneB = droneScripts();
const groundB = staticSprite();
const padsB = staticSprite();

const SHOWN = ["Score", "Fuel", "Throttle", "Drift", "Descent"];
for (const n of [...SHOWN, "fuelLeft", "gravity"]) varId(n);
for (const n of ["thrustTable", "padLeft", "padRight", "padMult"]) listId(n);
const listValues: Record<string, number[]> = {
  thrustTable: THRUST_TABLE,
  padLeft: PADS.map(p => p.l), padRight: PADS.map(p => p.r), padMult: PADS.map(p => p.mult),
};

const sprite = (name: string, B: Blocks, costumes: any[], layerOrder: number) => ({
  isStage: false, name, variables: {}, lists: {}, broadcasts: {}, blocks: B.map, comments: {},
  currentCostume: 0, costumes, sounds: [], volume: 100, layerOrder, visible: true,
  x: 0, y: 0, size: 100, direction: 90, draggable: false, rotationStyle: "all around",
});

const project = {
  targets: [
    {
      isStage: true, name: "Stage",
      variables: Object.fromEntries(Object.entries(VARS).map(([n, id]) => [id, [n, 0]])),
      lists: Object.fromEntries(Object.entries(LISTS).map(([n, id]) => [id, [n, listValues[n]]])),
      broadcasts: Object.fromEntries(Object.entries(BCASTS).map(([n, id]) => [id, n])),
      blocks: {}, comments: {}, currentCostume: 0,
      costumes: [costume("space", backdrop, 240, 180)], sounds: [], volume: 100, layerOrder: 0,
      tempo: 60, videoTransparency: 50, videoState: "on", textToSpeechLanguage: null,
    },
    sprite("Ground", groundB, [costume("ground", ground, 240, 180)], 1),
    sprite("Pads", padsB, [costume("pads", pads, 240, 180)], 2),
    {
      ...sprite("Drone", droneB, [
        costume("drone", drone, 20, 20), costume("drone-flame", droneFlame, 20, 20),
        costume("drone-boost", droneBoost, 20, 20), costume("boom", boom, 20, 20)], 3),
      x: -60, y: 150,
    },
  ],
  monitors: SHOWN.map((n, i) => ({
    id: VARS[n], mode: "default", opcode: "data_variable", params: { VARIABLE: n }, spriteName: null,
    value: 0, width: 0, height: 0, x: i < 3 ? 5 : 375, y: 5 + (i % 3) * 27, visible: true,
    sliderMin: 0, sliderMax: 100, isDiscrete: true,
  })),
  extensions: [],
  meta: { semver: "3.0.0", vm: "0.2.0", agent: "dust-hopper build.ts" },
};

// ---------------------------------------------------------------- zip (store only)
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function zip(files: Record<string, Buffer>): Buffer {
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

const dir = new URL(".", import.meta.url).pathname;
const files: Record<string, Buffer> = { "project.json": Buffer.from(JSON.stringify(project)) };
for (const [name, content] of Object.entries(ASSETS)) files[name] = Buffer.from(content);
writeFileSync(dir + "dust-hopper.sb3", zip(files));
console.log(`dust-hopper.sb3: ${Object.keys(droneB.map).length} drone blocks, ${Object.keys(ASSETS).length} costumes`);
