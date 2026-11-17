// Chain Spark (the tutorial), as a function of the tutorial step: chainSpark(6) is the whole game, 1..5 are the
// tutorial's checkpoints, 0 is the starter (artwork, no code). Standard Scratch: drag mode, clones, touching color.
//   1  place: fireworks wait in the tray; drag them into the sky, click one to turn it 45 degrees
//   2  light: Space turns the match into a flare; a shell that touches it explodes: 20 times "turn 18, create clone
//      of myself" (each spark clone copies the direction it was made with)
//   3  chain reaction: a firework goes off when it touches the sparks' yellow (touching color)
//   4  rockets and fountains: a rocket flies its way leaving a trail of sparks; a fountain sprays sparks
//   5  score: points for each firework (rockets few), and show-time points while fireworks burn
//   6  the end of the show: when nothing burns any more, the score; a finale bonus when every firework went off
//
// A firework clone has a role: "firework" (waiting or burning) or "spark". Sparks are clones of the firework that
// made them, so they start where it is and point where it points.
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { art, SPARK_CORE } from "./art.ts";

export const LAST = 6;
export const TRAY_Y = -158;
export const TRAY: [string, number][] = [["rocket", -205], ["rocket", -160], ["rocket", -115], ["shell", -55], ["shell", -5], ["shell", 45],
  ["fountain", 105], ["fountain", 150]];
export const MATCH_X = 205, POINTS = { rocket: 1, shell: 5, fountain: 3 };

export function chainSpark(step: number): Buffer {
  const P = new Project();
  const at = (n: number) => step >= n;
  const when = <T>(n: number, xs: () => T[]): T[] => (at(n) ? xs() : []);

  // ---------------------------------------------------------------- Firework: placed, then goes off
  function fireworkScripts(): Blocks {
    const B = new Blocks(P).local("role", "aim");
    const d = dsl(B);
    const { v, eq, and, or, set, change, ifThen, ifElse, repeat, whenFlag, whenCloned, whenClicked, hide, show, goto, costume,
      cloneMyself, deleteClone, forever, turn, move, changeEffect, changeSize, wait, touching, touchingColor, costumeName, setDragMode,
      point, direction, add, random, define, call, arg, div } = d;
    if (!at(1)) return B;
    // The original stays hidden and puts clones in the tray.
    B.script(whenFlag(), [
      hide(), set("role", "firework"),
      ...TRAY.flatMap(([kind, x]) => [goto(x, TRAY_Y), costume(kind), cloneMyself()]),
    ], 20, 20);
    // How each kind goes off (from step 2 the shell; from step 4 the rocket and the fountain).
    const sparkOut = (colour: string) => [costume(colour), set("role", "spark"), cloneMyself()];
    const goOff = () => [
      set("role", "lit"), setDragMode(false),
      ...when(5, () => [change("burning", 1), change("fired", 1)]),
      ifElse(eq(costumeName(), "shell"), [
        ...when(5, () => [change("score", POINTS.shell)]),
        wait(0.3),
        // The burst: 20 sparks in a ring (see "burst").
        costume("spark-purple"), set("role", "spark"), call("burst %s", 20),
      ], at(4) ? [ifElse(eq(costumeName(), "rocket"), [
        ...when(5, () => [change("score", POINTS.rocket)]),
        // The rocket flies its way, dropping sparks behind it, then pops.
        repeat(30, [move(7), turn(180), ...sparkOut("spark-red"), turn(180), costume("rocket"), set("role", "lit")]),
        costume("spark-red"), set("role", "spark"), call("burst %s", 6),
      ], [
        ...when(5, () => [change("score", POINTS.fountain)]),
        // The fountain sprays sparks its way for a few seconds.
        set("aim", direction()),
        repeat(45, [point(add(v("aim"), random(-20, 20))), ...sparkOut("spark-green"), costume("fountain"), set("role", "lit")]),
      ])] : []),
      ...when(5, () => [change("burning", -1)]),
      deleteClone(),
    ];
    B.script(whenCloned(), [
      ifElse(eq(v("role"), "spark"), [
        // A spark flies out and fades.
        // (They shrink rather than fade: a faded spark is no longer quite the spark yellow, and would not set anything off.)
        show(), repeat(18, [move(6), changeSize(-2.5)]), deleteClone(),
      ], [
        // A firework: it points up; drag it into the sky. From step 2 it waits to be lit.
        point(0), show(), setDragMode(true),
        ...when(2, () => [forever([
          ifThen(at(3) ? touchingColor(SPARK_CORE) : touching("Match"), goOff()),
        ])]),
      ]),
    ], 20, 300);
    // A burst: n sparks, each made after turning 360 / n degrees, so they fly out in a ring. Every clone copies the
    // direction its parent had when it was made. "Run without screen refresh": the whole ring is made at once.
    if (at(2)) define("burst %s", [repeat(arg("n"), [turn(div(360, arg("n"))), cloneMyself()])], { args: ["n"], warp: true, x: 20, y: 1400 });
    // Click (without dragging) turns it.
    B.script(whenClicked(), [ifThen(and(eq(v("role"), "firework"), eq(v("phase"), "build")), [turn(45)])], 20, 1200);
    void or; void forever;
    return B;
  }

  // ---------------------------------------------------------------- Match: drag it next to a firework; Space lights it
  function matchScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, eq, set, ifThen, whenFlag, whenKey, whenReceive, goto, costume, show, hide, setDragMode, wait, broadcast, sayFor, join } = d;
    B.script(whenFlag(), [goto(MATCH_X, TRAY_Y), costume("match"), show(), set("phase", "build"),
      ...when(5, () => [set("score", 0), set("burning", 0), set("fired", 0)]),
      setDragMode(true)], 20, 20);
    if (at(2)) B.script(whenKey("space"), [ifThen(eq(v("phase"), "build"), [
      set("phase", "show"), setDragMode(false), costume("flare"), broadcast("show"), wait(1), hide()])], 20, 200);
    if (at(6)) B.script(whenReceive("over"), [goto(0, 0), costume("match"), show(),
      sayFor(join("Show over! Score: ", v("score")), 4)], 20, 400);
    return B;
  }

  // ---------------------------------------------------------------- Stage: show-time points and the end of the show
  function stageScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, eq, gt, set, change, ifThen, whenReceive, repeatUntil, wait, waitUntil, broadcast, until } = d as any;
    if (!at(5)) return B;
    // While fireworks burn, every half second each one adds a point: a long, busy show scores most.
    B.script(whenReceive("show"), [
      wait(1),
      until(eq(v("burning"), 0), [wait(0.5), change("score", v("burning"))]),
      ...when(6, () => [
        wait(1),
        // Every firework went off: the grand finale bonus.
        ifThen(eq(v("fired"), TRAY.length), [change("score", 50)]),
        set("phase", "over"), broadcast("over"),
      ]),
    ], 20, 20);
    void gt; void repeatUntil; void waitUntil;
    return B;
  }

  const A = art(P);
  return P.build({
    backdrop: A.backdrop,
    stage: stageScripts(),
    sprites: [
      P.sprite("Firework", { blocks: fireworkScripts(), costumes: A.firework, layer: 1, visible: false }),
      P.sprite("Match", { blocks: matchScripts(), costumes: A.match, layer: 2, x: MATCH_X, y: TRAY_Y }),
    ],
    shown: [...(at(5) ? ["score"] : [])],
  });
}
