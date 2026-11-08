// Converts the scripts of a Scratch 3 project.json into scratchblocks text,
// the syntax used by the scratchblocks library and the Scratch Wiki to draw blocks.
// CLI: node --experimental-strip-types --no-warnings to-scratchblocks.ts <project.json>
// Covers the blocks used in this repository; unknown opcodes are written as obsolete blocks.
import { readFileSync } from "node:fs";

type Block = { opcode: string; next: string | null; inputs: Record<string, any[]>; fields: Record<string, any[]>;
  topLevel: boolean; shadow: boolean; mutation?: any };

const isNum = (s: unknown) => typeof s === "number" || (typeof s === "string" && s.trim() !== "" && !isNaN(Number(s)));
const BIN: Record<string, string> = {
  operator_add: "+", operator_subtract: "-", operator_multiply: "*", operator_divide: "/", operator_mod: "mod",
};
const CMP: Record<string, string> = { operator_lt: "<", operator_gt: ">", operator_equals: "=" };

export function scripts(blocks: Record<string, Block | any[]>): string[] {
  const get = (id: string) => blocks[id] as Block;
  const field = (b: Block, name: string) => String(b.fields[name]?.[0] ?? "");

  // A value slot: literal, variable, menu shadow or reporter block.
  function value(b: Block, name: string, empty = "()"): string {
    const slot = b.inputs[name];
    if (!slot || slot[1] === null) return empty;
    const v = slot[1];
    if (typeof v === "string") {
      const r = get(v);
      const MENU: Record<string, string> = { _myself_: "myself", _mouse_: "mouse-pointer", _edge_: "edge" };
      if (!r.shadow) return reporter(r);
      const m = String(Object.values(r.fields)[0][0]);
      return `(${MENU[m] ?? m} v)`;
    }
    switch (v[0]) {
      case 9: return `[${v[1]}]`;
      case 11: return `(${v[1]} v)`;
      case 12: case 13: return `(${v[1]})`;
      case 10: return isNum(v[1]) ? `(${v[1]})` : `[${v[1]}]`;
      default: return `(${v[1]})`;
    }
  }
  const cond = (b: Block, name: string) => value(b, name, "<>");

  function reporter(b: Block): string {
    const o = b.opcode;
    if (BIN[o]) return `(${value(b, "NUM1")} ${BIN[o]} ${value(b, "NUM2")})`;
    if (CMP[o]) return `<${value(b, "OPERAND1")} ${CMP[o]} ${value(b, "OPERAND2")}>`;
    switch (o) {
      case "operator_and": return `<${cond(b, "OPERAND1")} and ${cond(b, "OPERAND2")}>`;
      case "operator_or": return `<${cond(b, "OPERAND1")} or ${cond(b, "OPERAND2")}>`;
      case "operator_not": return `<not ${cond(b, "OPERAND")}>`;
      case "operator_round": return `(round ${value(b, "NUM")})`;
      case "operator_mathop": return `([${field(b, "OPERATOR")} v] of ${value(b, "NUM")})`;
      case "operator_join": return `(join ${value(b, "STRING1")} ${value(b, "STRING2")})`;
      case "operator_letter_of": return `(letter ${value(b, "LETTER")} of ${value(b, "STRING")})`;
      case "operator_length": return `(length of ${value(b, "STRING")})`;
      case "operator_random": return `(pick random ${value(b, "FROM")} to ${value(b, "TO")})`;
      case "looks_size": return "(size)";
      case "sensing_mousex": return "(mouse x)";
      case "sensing_mousey": return "(mouse y)";
      case "sensing_mousedown": return "<mouse down?>";
      case "operator_mod": return `(${value(b, "NUM1")} mod ${value(b, "NUM2")})`;
      case "looks_costumenumbername": return `(costume [${field(b, "NUMBER_NAME")} v])`;
      case "sensing_of": return `([${field(b, "PROPERTY")} v] of ${value(b, "OBJECT")})`;
      case "data_itemoflist": return `(item ${value(b, "INDEX")} of [${field(b, "LIST")} v])`;
      case "data_lengthoflist": return `(length of [${field(b, "LIST")} v])`;
      case "data_listcontainsitem": return `<[${field(b, "LIST")} v] contains ${value(b, "ITEM")}?>`;
      case "motion_direction": return "(direction)";
      case "motion_xposition": return "(x position)";
      case "motion_yposition": return "(y position)";
      case "sensing_keypressed": return `<key ${value(b, "KEY_OPTION")} pressed?>`;
      case "sensing_touchingobject": return `<touching ${value(b, "TOUCHINGOBJECTMENU")}?>`;
      case "sensing_touchingcolor": return `<touching color ${value(b, "COLOR")}?>`;
      case "sensing_coloristouchingcolor": return `<color ${value(b, "COLOR")} is touching ${value(b, "COLOR2")}?>`;
      case "argument_reporter_string_number": return `(${field(b, "VALUE")} :: custom)`;
    }
    return `(${o} :: obsolete)`;
  }

  const indent = (lines: string[]) => lines.map(l => "  " + l);

  function stack(id: string | null): string[] {
    const out: string[] = [];
    for (; id; id = get(id).next) out.push(...statement(get(id)));
    return out;
  }
  const sub = (b: Block, name: string) => indent(stack(b.inputs[name]?.[1] ?? null));

  function statement(b: Block): string[] {
    switch (b.opcode) {
      case "event_whenflagclicked": return ["when flag clicked"];
      case "event_whenthisspriteclicked": return ["when this sprite clicked"];
      case "event_whenstageclicked": return ["when stage clicked"];
      case "event_whenbroadcastreceived": return [`when I receive [${field(b, "BROADCAST_OPTION")} v]`];
      case "event_broadcast": return [`broadcast ${value(b, "BROADCAST_INPUT")}`];
      case "event_broadcastandwait": return [`broadcast ${value(b, "BROADCAST_INPUT")} and wait`];
      case "procedures_definition": {
        const m = get(b.inputs.custom_block[1]).mutation, names: string[] = JSON.parse(m.argumentnames ?? "[]");
        let i = 0;
        return [`define ${m.proccode.replace(/%s/g, () => `(${names[i++]} :: custom)`)}`];
      }
      case "procedures_call": {
        const ids: string[] = JSON.parse(b.mutation.argumentids ?? "[]");
        let i = 0;
        return [`${b.mutation.proccode.replace(/%s/g, () => value(b, ids[i++]))} :: custom`];
      }
      case "data_setvariableto": return [`set [${field(b, "VARIABLE")} v] to ${value(b, "VALUE")}`];
      case "data_changevariableby": return [`change [${field(b, "VARIABLE")} v] by ${value(b, "VALUE")}`];
      case "data_deletealloflist": return [`delete all of [${field(b, "LIST")} v]`];
      case "data_addtolist": return [`add ${value(b, "ITEM")} to [${field(b, "LIST")} v]`];
      case "motion_gotoxy": return [`go to x: ${value(b, "X")} y: ${value(b, "Y")}`];
      case "motion_pointindirection": return [`point in direction ${value(b, "DIRECTION")}`];
      case "motion_turnright": return [`turn right ${value(b, "DEGREES")} degrees`];
      case "motion_turnleft": return [`turn left ${value(b, "DEGREES")} degrees`];
      case "motion_changexby": return [`change x by ${value(b, "DX")}`];
      case "motion_movesteps": return [`move ${value(b, "STEPS")} steps`];
      case "motion_pointtowards": return [`point towards ${value(b, "TOWARDS")}`];
      case "data_replaceitemoflist": return [`replace item ${value(b, "INDEX")} of [${field(b, "LIST")} v] with ${value(b, "ITEM")}`];
      case "data_deleteoflist": return [`delete ${value(b, "INDEX")} of [${field(b, "LIST")} v]`];
      case "pen_clear": return ["erase all"];
      case "pen_stamp": return ["stamp"];
      case "pen_penDown": return ["pen down"];
      case "pen_penUp": return ["pen up"];
      case "pen_setPenSizeTo": return [`set pen size to ${value(b, "SIZE")}`];
      case "pen_setPenColorToColor": return [`set pen color to ${value(b, "COLOR")}`];
      case "motion_ifonedgebounce": return ["if on edge, bounce"];
      case "motion_setx": return [`set x to ${value(b, "X")}`];
      case "motion_sety": return [`set y to ${value(b, "Y")}`];
      case "motion_changeyby": return [`change y by ${value(b, "DY")}`];
      case "looks_seteffectto": return [`set [${field(b, "EFFECT").toLowerCase()} v] effect to ${value(b, "VALUE")}`];
      case "looks_changeeffectby": return [`change [${field(b, "EFFECT").toLowerCase()} v] effect by ${value(b, "CHANGE")}`];
      case "looks_cleargraphiceffects": return ["clear graphic effects"];
      case "looks_setsizeto": return [`set size to ${value(b, "SIZE")} %`];
      case "looks_changesizeby": return [`change size by ${value(b, "CHANGE")}`];
      case "looks_goforwardbackwardlayers": return [`go [${field(b, "FORWARD_BACKWARD")} v] ${value(b, "NUM")} layers`];
      case "control_create_clone_of": return [`create clone of ${value(b, "CLONE_OPTION")}`];
      case "control_start_as_clone": return ["when I start as a clone"];
      case "control_delete_this_clone": return ["delete this clone"];
      case "looks_switchcostumeto": return [`switch costume to ${value(b, "COSTUME")}`];
      case "looks_show": return ["show"];
      case "looks_hide": return ["hide"];
      case "looks_gotofrontback": return [`go to [${field(b, "FRONT_BACK")} v] layer`];
      case "looks_say": return [`say ${value(b, "MESSAGE")}`];
      case "looks_sayforsecs": return [`say ${value(b, "MESSAGE")} for ${value(b, "SECS")} seconds`];
      case "control_wait": return [`wait ${value(b, "DURATION")} seconds`];
      case "control_wait_until": return [`wait until ${cond(b, "CONDITION")}`];
      case "control_stop": return [`stop [${field(b, "STOP_OPTION")} v]`];
      case "control_forever": return ["forever", ...sub(b, "SUBSTACK"), "end"];
      case "control_repeat": return [`repeat ${value(b, "TIMES")}`, ...sub(b, "SUBSTACK"), "end"];
      case "control_repeat_until": return [`repeat until ${cond(b, "CONDITION")}`, ...sub(b, "SUBSTACK"), "end"];
      case "control_if": return [`if ${cond(b, "CONDITION")} then`, ...sub(b, "SUBSTACK"), "end"];
      case "control_if_else":
        return [`if ${cond(b, "CONDITION")} then`, ...sub(b, "SUBSTACK"), "else", ...sub(b, "SUBSTACK2"), "end"];
    }
    return [`${b.opcode} :: obsolete`];
  }

  return Object.entries(blocks)
    .filter(([, b]) => !Array.isArray(b) && b.topLevel && !b.shadow)
    .map(([id]) => stack(id).join("\n"));
}

// Scripts of every sprite, keyed by sprite name.
export function projectScripts(project: any): Record<string, string[]> {
  return Object.fromEntries(project.targets.map((t: any) => [t.name, scripts(t.blocks)]));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const project = JSON.parse(readFileSync(process.argv[2], "utf8"));
  for (const [name, list] of Object.entries(projectScripts(project))) {
    if (!list.length) continue;
    console.log(`// ${name}`);
    for (const s of list) console.log(s + "\n");
  }
}
