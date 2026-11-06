// Converts a Scratch 3 project.json into readable pseudocode.
import { readFileSync } from "node:fs";

type Block = {
  opcode: string; next: string | null; parent: string | null;
  inputs: Record<string, any[]>; fields: Record<string, any[]>;
  topLevel: boolean; shadow: boolean; mutation?: any;
};
type Blocks = Record<string, Block | any[]>;

const project = JSON.parse(readFileSync(process.argv[2], "utf8"));

const BIN: Record<string, string> = {
  operator_add: "+", operator_subtract: "-", operator_multiply: "*", operator_divide: "/",
  operator_mod: "mod", operator_lt: "<", operator_gt: ">", operator_equals: "=",
  operator_and: "and", operator_or: "or",
};

function render(blocks: Blocks, target: any): string {
  const blk = (id: string) => blocks[id] as Block;

  // Value of an input slot: literal, variable, or reporter block.
  function input(b: Block, name: string): string {
    const slot = b.inputs[name];
    if (!slot) return "?";
    const v = slot[1];
    if (v === null) return "?";
    if (typeof v === "string") return expr(v);
    switch (v[0]) {
      case 10: case 11: return JSON.stringify(String(v[1]));
      case 12: return v[1];          // variable
      case 13: return `list ${v[1]}`;
      default: return String(v[1]);   // numbers, colours
    }
  }
  const field = (b: Block, name: string) => String(b.fields[name]?.[0] ?? "?");

  function expr(id: string): string {
    const b = blocks[id];
    if (Array.isArray(b)) return b[0] === 12 ? b[1] : String(b[1]);
    if (!b) return "?";
    const o = b.opcode;
    if (b.shadow && Object.keys(b.fields).length) return String(Object.values(b.fields)[0][0]);
    if (BIN[o]) return `(${input(b, "NUM1") !== "?" ? input(b, "NUM1") : input(b, "OPERAND1")} ${BIN[o]} ${input(b, "NUM2") !== "?" ? input(b, "NUM2") : input(b, "OPERAND2")})`;
    switch (o) {
      case "operator_not": return `not ${input(b, "OPERAND")}`;
      case "operator_join": return `join(${input(b, "STRING1")}, ${input(b, "STRING2")})`;
      case "operator_letter_of": return `letter ${input(b, "LETTER")} of ${input(b, "STRING")}`;
      case "operator_length": return `length(${input(b, "STRING")})`;
      case "operator_round": return `round(${input(b, "NUM")})`;
      case "operator_random": return `random(${input(b, "FROM")}, ${input(b, "TO")})`;
      case "operator_mathop": return `${field(b, "OPERATOR")}(${input(b, "NUM")})`;
      case "argument_reporter_string_number":
      case "argument_reporter_boolean": return field(b, "VALUE");
      case "data_itemoflist": return `${field(b, "LIST")}[${input(b, "INDEX")}]`;
      case "data_lengthoflist": return `length(${field(b, "LIST")})`;
      case "motion_xposition": return "x";
      case "motion_yposition": return "y";
      case "motion_direction": return "direction";
      case "sensing_timer": return "timer";
      case "sensing_keypressed": return `key ${input(b, "KEY_OPTION")} pressed?`;
      case "looks_costumenumbername": return `costume ${field(b, "NUMBER_NAME")}`;
    }
    return generic(b);
  }

  // Fallback: opcode(INPUT=value, FIELD=value)
  function generic(b: Block): string {
    const args = [
      ...Object.keys(b.inputs).filter(k => !k.startsWith("SUBSTACK")).map(k => `${k.toLowerCase()}=${input(b, k)}`),
      ...Object.keys(b.fields).map(k => `${k.toLowerCase()}=${field(b, k)}`),
    ];
    return `${b.opcode}(${args.join(", ")})`;
  }

  function stmt(b: Block): string {
    switch (b.opcode) {
      case "data_setvariableto": return `${field(b, "VARIABLE")} = ${input(b, "VALUE")}`;
      case "data_changevariableby": return `${field(b, "VARIABLE")} += ${input(b, "VALUE")}`;
      case "data_addtolist": return `${field(b, "LIST")}.add(${input(b, "ITEM")})`;
      case "data_deletealloflist": return `${field(b, "LIST")}.clear()`;
      case "data_deleteoflist": return `${field(b, "LIST")}.delete(${input(b, "INDEX")})`;
      case "data_replaceitemoflist": return `${field(b, "LIST")}[${input(b, "INDEX")}] = ${input(b, "ITEM")}`;
      case "motion_gotoxy": return `go to (${input(b, "X")}, ${input(b, "Y")})`;
      case "motion_setx": return `x = ${input(b, "X")}`;
      case "motion_sety": return `y = ${input(b, "Y")}`;
      case "motion_changexby": return `x += ${input(b, "DX")}`;
      case "motion_changeyby": return `y += ${input(b, "DY")}`;
      case "motion_movesteps": return `move ${input(b, "STEPS")} steps`;
      case "motion_turnright": return `turn right ${input(b, "DEGREES")}°`;
      case "motion_turnleft": return `turn left ${input(b, "DEGREES")}°`;
      case "motion_pointindirection": return `point in direction ${input(b, "DIRECTION")}`;
      case "pen_clear": return "pen.clear()";
      case "pen_penDown": return "pen.down()";
      case "pen_penUp": return "pen.up()";
      case "pen_stamp": return "pen.stamp()";
      case "pen_setPenSizeTo": return `pen.size = ${input(b, "SIZE")}`;
      case "pen_changePenSizeBy": return `pen.size += ${input(b, "SIZE")}`;
      case "pen_setPenColorToColor": return `pen.color = ${input(b, "COLOR")}`;
      case "pen_setPenColorParamTo": return `pen.${input(b, "COLOR_PARAM")} = ${input(b, "VALUE")}`;
      case "pen_changePenColorParamBy": return `pen.${input(b, "COLOR_PARAM")} += ${input(b, "VALUE")}`;
      case "looks_switchcostumeto": return `costume = ${input(b, "COSTUME")}`;
      case "looks_show": return "show";
      case "looks_hide": return "hide";
      case "looks_setsizeto": return `size = ${input(b, "SIZE")}%`;
      case "control_wait": return `wait ${input(b, "DURATION")}s`;
      case "control_stop": return `stop ${field(b, "STOP_OPTION")}`;
      case "event_broadcast": return `broadcast ${input(b, "BROADCAST_INPUT")}`;
      case "procedures_call": {
        const m = b.mutation; const ids: string[] = JSON.parse(m.argumentids);
        return `call ${m.proccode.replace(/%[snb]/g, "_").trim()}(${ids.map(i => b.inputs[i] ? input(b, i) : "?").join(", ")})`;
      }
    }
    return generic(b);
  }

  function seq(id: string | null, ind: string): string[] {
    const out: string[] = [];
    for (; id; id = blk(id).next) {
      const b = blk(id);
      const sub = (k: string) => seq(b.inputs[k]?.[1] ?? null, ind + "  ");
      switch (b.opcode) {
        case "control_repeat": out.push(`${ind}repeat ${input(b, "TIMES")} times:`, ...sub("SUBSTACK")); break;
        case "control_forever": out.push(`${ind}forever:`, ...sub("SUBSTACK")); break;
        case "control_repeat_until": out.push(`${ind}repeat until ${input(b, "CONDITION")}:`, ...sub("SUBSTACK")); break;
        case "control_if": out.push(`${ind}if ${input(b, "CONDITION")}:`, ...sub("SUBSTACK")); break;
        case "control_if_else": out.push(`${ind}if ${input(b, "CONDITION")}:`, ...sub("SUBSTACK"), `${ind}else:`, ...sub("SUBSTACK2")); break;
        default: out.push(ind + stmt(b));
      }
    }
    return out;
  }

  function hat(b: Block): string {
    switch (b.opcode) {
      case "event_whenflagclicked": return "when green flag clicked:";
      case "event_whenkeypressed": return `when key "${field(b, "KEY_OPTION")}" pressed:`;
      case "event_whenbroadcastreceived": return `when I receive "${field(b, "BROADCAST_OPTION")}":`;
      case "procedures_definition": {
        const proto = blk(b.inputs.custom_block[1]);
        const names: string[] = JSON.parse(proto.mutation.argumentnames);
        const warp = proto.mutation.warp === "true" ? "  # run without screen refresh" : "";
        return `define ${proto.mutation.proccode.replace(/%[snb]/g, "_").trim()}(${names.join(", ")}):${warp}`;
      }
    }
    return `${b.opcode}:`;
  }

  const lines: string[] = [];
  const vars = Object.values(target.variables).map((v: any) => `${v[0]}=${JSON.stringify(v[1])}`);
  if (vars.length) lines.push(`# variables: ${vars.join(", ")}`);
  const lists = Object.values(target.lists).map((l: any) => `${l[0]} (${l[1].length} items)`);
  if (lists.length) lines.push(`# lists: ${lists.join(", ")}`);
  for (const [id, b] of Object.entries(blocks)) {
    if (Array.isArray(b) || !b.topLevel || b.shadow) continue;
    lines.push("", hat(b), ...seq(b.next, "  "));
  }
  return lines.join("\n");
}

for (const t of project.targets) {
  console.log(`\n===== ${t.isStage ? "STAGE" : "SPRITE"}: ${t.name} =====`);
  console.log(render(t.blocks, t));
}
