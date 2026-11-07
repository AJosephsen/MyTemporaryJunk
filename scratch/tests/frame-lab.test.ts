// Frame Lab: in which frame do broadcast receivers run? Frame 1 is the frame in which the Sender sends.
import { test, type T } from "../workbench/testing.ts";

const DEMO = "demos/frame-lab/frame-lab.sb3";

// Returns each log entry with the frame it first appeared in, e.g. "1: send".
async function measure(t: T, kase: string, spin: number): Promise<string[]> {
  await t.load(DEMO);
  await t.set("spin", spin);
  await t.set("case", kase);
  await t.greenFlag();
  await t.frames(3);
  await t.set("log", []);
  await t.set("go", 1);
  const out: string[] = [];
  let seen = 0;
  for (let frame = 1; frame <= 5; frame++) {
    await t.frames(1);
    const log = (await t.get("log")) as string[];
    for (; seen < log.length; seen++) out.push(`${frame}: ${log[seen]}`);
  }
  return out;
}

const RECEIVERS = ["Receiver got ping", "Sender got ping", "Stage got ping"];
const frameOf = (out: string[], entry: string) => Number(out.find(o => o.endsWith(": " + entry))?.split(":")[0] ?? 0);

for (const spin of [1, 0]) {
  const how = spin ? "redrawing every frame" : "nothing moving";

  test(`frame lab: broadcast receivers run in the same frame, after the sender continues (${how})`, async t => {
    const out = await measure(t, "plain", spin);
    t.log(out.join(" | "));
    t.expect(out[1] === "1: after send", `the sender did not continue first: ${out}`);
    for (const r of RECEIVERS) t.expect(frameOf(out, r) === 1, `${r}: ${out}`);
  });

  test(`frame lab: a broadcast from a warp block also reaches receivers in the same frame (${how})`, async t => {
    const out = await measure(t, "warp", spin);
    for (const r of RECEIVERS) t.expect(frameOf(out, r) === 1, `${r}: ${out}`);
  });

  test(`frame lab: a chain of broadcasts completes in one frame (${how})`, async t => {
    const out = await measure(t, "chain", spin);
    t.expect(frameOf(out, "Stage got ping3") === 1, `${out}`);
  });

  test(`frame lab: broadcast and wait resumes ${spin ? "in the next frame" : "in the same frame"} (${how})`, async t => {
    const out = await measure(t, "wait", spin);
    t.log(out.join(" | "));
    for (const r of RECEIVERS) t.expect(frameOf(out, r) === 1, `${r}: ${out}`);
    t.expect(frameOf(out, "after wait") === (spin ? 2 : 1), `${out}`);
  });
}
