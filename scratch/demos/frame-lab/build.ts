// Frame Lab: measures in which frame broadcast receivers run. The test sets `case` and `go`, then steps one frame at a
// time and reads the list `log` after each frame. `spin` = 1 keeps a sprite turning, so every frame must be redrawn
// (as in a real game); with spin = 0 nothing moves and Scratch may re-run scripts within one frame.
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl } from "../../lib/sb3.ts";

const P = new Project();
const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const log = (d: ReturnType<typeof dsl>, text: string) => d.addTo("log", text);

function stageScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenReceive("ping"), [log(d, "Stage got ping")], 20, 20);
  B.script(d.whenReceive("ping3"), [log(d, "Stage got ping3")], 20, 120);
  return B;
}

function senderScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, eq, set, ifThen, call, broadcast, broadcastWait, forever, whenFlag, whenReceive } = d;
  const plain = () => [log(d, "send"), broadcast("ping"), log(d, "after send")];
  B.script(whenFlag(), [
    set("go", 0),
    forever([
      ifThen(eq(v("go"), 1), [
        set("go", 0),
        ifThen(eq(v("case"), "plain"), plain()),
        ifThen(eq(v("case"), "wait"), [log(d, "send"), broadcastWait("ping"), log(d, "after wait")]),
        ifThen(eq(v("case"), "warp"), [call("send in warp")]),
        ifThen(eq(v("case"), "chain"), [log(d, "send"), broadcast("ping2")]),
        // Restart: the second broadcast arrives while the Worker's script is still running (2 frames later).
        ifThen(eq(v("case"), "restart"), [
          log(d, "send 1"), broadcast("slow"), d.repeat(2, [d.change("pause", 1)]), log(d, "send 2"), broadcast("slow"),
        ]),
        // Again in the same frame, after the Worker's quick script has already finished: Echo sends it a second time.
        ifThen(eq(v("case"), "again"), [log(d, "send"), broadcast("quick"), broadcast("echo")]),
        // Request / response: 5 responders (a sprite and 4 clones) each answer with their own broadcast.
        ifThen(eq(v("case"), "request"), [
          set("responses", 0), set("direct", 0), log(d, "send"), broadcastWait("request"), log(d, "after wait"),
        ]),
      ]),
    ]),
  ], 20, 20);
  d.define("send in warp", plain(), { warp: true, x: 500, y: 20 });
  B.script(whenReceive("ping"), [log(d, "Sender got ping")], 500, 200);
  B.script(whenReceive("response"), [d.change("responses", 1), log(d, "Sender got response")], 500, 300);
  return B;
}

function receiverScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenReceive("ping"), [log(d, "Receiver got ping")], 20, 20);
  B.script(d.whenReceive("ping2"), [log(d, "Receiver got ping2"), d.broadcast("ping3")], 20, 120);
  return B;
}

function responderScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  // The clones exist only in the request case, so they cannot affect the other measurements.
  B.script(d.whenFlag(), [d.ifThen(d.eq(d.v("case"), "request"), [d.repeat(4, [d.cloneMyself()])])], 20, 20);
  // `direct` is counted by the responders themselves; `responses` by the Sender, one per response broadcast.
  B.script(d.whenReceive("request"), [d.change("direct", 1), d.broadcast("response")], 20, 120);
  return B;
}

function workerScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  // A slow script: a normal loop, so it pauses after each pass and runs over several frames.
  B.script(d.whenReceive("slow"), [
    log(d, "slow start"), d.set("n", 1), d.repeat(3, [d.addTo("log", d.join("slow pass ", d.v("n"))), d.change("n", 1)]), log(d, "slow end"),
  ], 20, 20);
  B.script(d.whenReceive("quick"), [log(d, "quick run")], 20, 200);
  return B;
}

function echoScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenReceive("echo"), [log(d, "echo sends quick"), d.broadcast("quick")], 20, 20);
  return B;
}

function spinnerScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.ifThen(d.eq(d.v("spin"), 1), [d.forever([d.turn(3)])])], 20, 20);
  return B;
}

const box = (fill: string) => svg(40, 40, `<rect width="40" height="40" rx="6" fill="${fill}"/>`);
const sb3 = P.build({
  backdrop: P.costume("plain", svg(480, 360, `<rect width="480" height="360" fill="#eef2f5"/>`), 240, 180),
  stage: stageScripts(),
  sprites: [
    P.sprite("Sender", { blocks: senderScripts(), costumes: [P.costume("box", box("#3f8fd8"), 20, 20)], layer: 1, x: -100 }),
    P.sprite("Receiver", { blocks: receiverScripts(), costumes: [P.costume("box", box("#e8456b"), 20, 20)], layer: 2, x: 0 }),
    P.sprite("Responder", { blocks: responderScripts(), costumes: [P.costume("box", box("#f0a020"), 20, 20)], layer: 4, y: -100 }),
    P.sprite("Worker", { blocks: workerScripts(), costumes: [P.costume("box", box("#8a5cd8"), 20, 20)], layer: 5, x: -100, y: 100 }),
    P.sprite("Echo", { blocks: echoScripts(), costumes: [P.costume("box", box("#666666"), 20, 20)], layer: 6, x: 0, y: 100 }),
    P.sprite("Spinner", { blocks: spinnerScripts(), costumes: [P.costume("box", box("#3fa94d"), 20, 20)], layer: 3, x: 100 }),
  ],
  listValues: { log: [] },
  shown: [],
});
writeFileSync(new URL("frame-lab.sb3", import.meta.url), sb3);
console.log(`frame-lab.sb3: ${sb3.length} bytes`);
