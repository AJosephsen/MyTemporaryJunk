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
  for (let frame = 1; frame <= 6; frame++) {
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

for (const spin of [1, 0]) {
  test(`frame lab: request / response with 5 responders (${spin ? "redrawing every frame" : "nothing moving"})`, async t => {
    const out = await measure(t, "request", spin);
    const v = await t.vars();
    t.log({ direct: v.direct, responses: v.responses, log: out.join(" | ") });
    t.expect(v.direct === 5, `direct ${v.direct}`);
    // Five "response" broadcasts in one frame start the Sender's script once: the others restart the same script.
    t.expect(v.responses === 1, `responses ${v.responses}`);
  });
}

const count = (out: string[], entry: string) => out.filter(o => o.endsWith(": " + entry)).length;

for (const spin of [1, 0]) {
  const how = spin ? "redrawing every frame" : "nothing moving";
  test(`frame lab: a broadcast to a script that is still running restarts it; the first run never finishes (${how})`, async t => {
    const out = await measure(t, "restart", spin);
    t.log(out.join(" | "));
    t.expect(count(out, "slow start") === 2, `starts: ${out}`);
    t.expect(count(out, "slow pass 3") === 1 && count(out, "slow end") === 1, `the first run went on: ${out}`);
    const restart = out.findIndex(o => o.endsWith("send 2"));
    t.expect(out[restart + 1]?.endsWith("slow start") && frameOf([out[restart + 1]], "slow start") === Number(out[restart].split(":")[0]),
      `the restart did not begin in the same frame as the second broadcast: ${out}`);
  });
  test(`frame lab: a broadcast to a script that already finished runs it again, ${spin ? "in the next frame" : "in the same frame"} (${how})`, async t => {
    const out = await measure(t, "again", spin);
    t.log(out.join(" | "));
    const runs = out.filter(o => o.endsWith(": quick run"));
    t.expect(runs.length === 2, `runs: ${out}`);
    t.expect(runs[1]?.startsWith(spin ? "2:" : "1:"), `second run: ${out}`);
  });
}
