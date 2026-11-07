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
      byTarget[target] = new Map(list.map(s => [s.split("\n")[0], s]));
    perStep.push(byTarget);
    console.log(`${name}: ${sb3.length} bytes`);
  }

  const changed = (step: number): string => {
    const now = perStep[step], before = perStep[step - 1];
    const panels: string[] = [], removed: string[] = [];
    for (const t of targets) {
      for (const [head, text] of now[t] ?? new Map()) {
        const old = before[t]?.get(head);
        if (old === text) continue;
        const tag = old === undefined ? "new" : "changed";
        panels.push(`<div class="blocks-panel"><div class="label">${t} <span class="tag ${tag}">${tag}</span></div>\n<pre class="blocks">${esc(text)}</pre></div>`);
      }
      for (const head of before[t]?.keys() ?? []) if (!now[t]?.has(head)) removed.push(`${t}: <code>${esc(head)}</code>`);
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
