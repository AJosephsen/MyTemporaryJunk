// Shared tutorial builder: writes one checkpoint .sb3 per step and fills the page template.
// In index.template.html, <!--changed:N--> becomes every script that is new or changed in step N compared
// with step N-1, grouped by sprite and tagged "new" or "changed"; scripts that disappeared are listed too.
// The block pictures are generated from the checkpoints, so the page and the downloads always match.
import { readFileSync, writeFileSync } from "node:fs";
import { projectScripts } from "../tools/scratchblocks/to-scratchblocks.ts";

type Scripts = Record<string, Map<string, string>>; // sprite -> (first line of script -> script text)

// Reads project.json back out of a stored (uncompressed) zip built by lib/sb3.ts.
export function projectJson(sb3: Buffer): any {
  const nameLen = sb3.readUInt16LE(26), size = sb3.readUInt32LE(18);
  return JSON.parse(sb3.subarray(30 + nameLen, 30 + nameLen + size).toString());
}

// A script is known by its first line (its hat block). Scripts with the same hat (several "when I start as a clone")
// are known by their first lines up to the first one that differs, so each keeps its own identity between steps.
function scriptKey(script: string, all: string[]): string {
  const lines = script.split("\n"), same = all.filter(s => s !== script && s.split("\n")[0] === lines[0]).map(s => s.split("\n"));
  let n = 1;
  while (n < lines.length && same.some(o => o.slice(0, n).join("\n") === lines.slice(0, n).join("\n"))) n++;
  return lines.slice(0, n).join("\n");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * @param dir      the tutorial folder (URL of its build script's folder)
 * @param last     the last step number
 * @param build    returns the checkpoint for a step (0 = starter with no code)
 * @param targets  sprite names in the order they should be shown (Stage first)
 */
export function buildTutorial(dir: URL, last: number, build: (step: number) => Buffer, targets: string[]) {
  const here = (f: string) => new URL(f, dir);
  const perStep: Scripts[] = [];
  for (let step = 0; step <= last; step++) {
    const sb3 = build(step);
    const name = step === 0 ? "starter.sb3" : `step${step}.sb3`;
    writeFileSync(here(name), sb3);
    const byTarget: Scripts = {};
    for (const [target, list] of Object.entries(projectScripts(projectJson(sb3))))
      byTarget[target] = new Map(list.map(s => [scriptKey(s, list), s]));
    perStep.push(byTarget);
    console.log(`${name}: ${sb3.length} bytes`);
  }

  // What is new or changed in a step. A script that is not exactly as before is "changed" if it continues an old one
  // (same hat and more of the same beginning than any other, or the only one with that hat on both sides), else "new".
  const changed = (step: number): string => {
    const now = perStep[step], before = perStep[step - 1];
    const panels: string[] = [], removed: string[] = [];
    const hat = (s: string) => s.split("\n")[0];
    const common = (a: string, b: string) => { const x = a.split("\n"), y = b.split("\n"); let n = 0; while (n < x.length && n < y.length && x[n] === y[n]) n++; return n; };
    for (const t of targets) {
      const nowList = [...(now[t]?.values() ?? [])], beforeList = [...(before[t]?.values() ?? [])];
      const open = beforeList.filter(s => !nowList.includes(s));
      const fresh = nowList.filter(s => !beforeList.includes(s));
      for (const text of fresh) {
        const sameHat = open.filter(o => hat(o) === hat(text));
        const best = sameHat.sort((a, b) => common(b, text) - common(a, text))[0];
        const only = sameHat.length === 1 && fresh.filter(f => hat(f) === hat(text)).length === 1;
        const tag = best && (common(best, text) >= 2 || only) ? "changed" : "new";
        if (tag === "changed") open.splice(open.indexOf(best), 1);
        panels.push(`<div class="blocks-panel"><div class="label">${t} <span class="tag ${tag}">${tag}</span></div>\n<pre class="blocks">${esc(text)}</pre></div>`);
      }
      for (const o of open) removed.push(`${t}: <code>${esc(o.split("\n").slice(0, 2).join(" … "))}</code>`);
    }
    const note = removed.length ? `<p class="note"><b>Remove</b> ${removed.join(", ")}.</p>\n` : "";
    return `${note}<div class="scripts">\n${panels.join("\n")}\n</div>`;
  };

  let missing = 0;
  const page = readFileSync(here("index.template.html"), "utf8").replace(/<!--changed:(\d+)-->/g, (_, n) => {
    const step = Number(n);
    if (!perStep[step] || step < 1) { missing++; return ""; }
    return changed(step);
  });
  writeFileSync(here("index.html"), page);
  const blockText: Record<string, string> = {};
  perStep.forEach((byTarget, step) => {
    for (const [t, m] of Object.entries(byTarget)) if (m.size) blockText[`${step}:${t}`] = [...m.values()].join("\n\n");
  });
  writeFileSync(here("blocks.json"), JSON.stringify(blockText, null, 1));
  console.log(`index.html written${missing ? `, ${missing} placeholders missing` : ""}`);
  if (missing) process.exit(1);
}

/**
 * Fills a single-page explainer: in the template, <!--script:Sprite:first line--> becomes that sprite's script
 * (the one whose first line matches exactly), drawn as blocks. Fails the build if a script is missing or ambiguous.
 */
export function buildExplainer(template: URL, out: URL, sb3: Buffer) {
  const all = projectScripts(projectJson(sb3));
  let errors = 0;
  const page = readFileSync(template, "utf8").replace(/<!--script:([^:]+):(.+?)-->/g, (_, sprite: string, head: string) => {
    const found = (all[sprite] ?? []).filter(s => s.split("\n")[0] === head);
    if (found.length !== 1) { console.error(`${sprite}: ${found.length} scripts start with "${head}"`); errors++; return ""; }
    return `<pre class="blocks">${esc(found[0])}</pre>`;
  });
  writeFileSync(out, page);
  console.log(`${out.pathname.split("/").pop()} written${errors ? `, ${errors} scripts missing` : ""}`);
  if (errors) process.exit(1);
}
