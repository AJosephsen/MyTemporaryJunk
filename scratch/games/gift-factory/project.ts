// Gift Factory (a Christmas tutorial), as a function of the tutorial step: giftFactory(6) is the whole game, 1..5 are
// the tutorial's checkpoints, 0 is the starter (artwork, no code). Basic blocks only.
//   1  the belt: gifts come out of the hatch and ride the conveyor belt from left to right; at the end they fall off
//   2  grab and toss: drag a gift (follow the mouse while the button is down); let go and it is thrown up in the air,
//      then zigzags gently down onto the belt again
//   3  baskets: let go over the basket of the gift's colour and it goes in (score); the wrong basket throws it back up
//   4  full baskets: a basket holds 5 gifts; then it glides away to be emptied, and gifts dropped on it meanwhile are
//      thrown up (that's when tossing buys time)
//   5  misses: a gift that falls off the end is missed; after 5 the factory closes
//   6  faster: every sorted gift speeds the belt up a little; gold gifts fit any basket and score 50
//
// The baskets share a list, "fill": how many gifts each one holds (item 1 red, 2 green, 3 blue). A basket is busy while
// its item is 5. A gift's kind is its costume number: 1 red, 2 green, 3 blue, 4 gold.
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { art } from "./art.ts";

export const LAST = 6;
export const BELT_Y = 40, RIDE_Y = 72, END_X = 228, START_X = -222, BASKET_Y = -128, BASKET_GAP = 150, FULL = 5;
export const basketX = (slot: number) => (slot - 2) * BASKET_GAP;

export function giftFactory(step: number): Buffer {
  const P = new Project();
  const at = (n: number) => step >= n;
  const when = <T>(n: number, xs: () => T[]): T[] => (at(n) ? xs() : []);

  // ---------------------------------------------------------------- Belt: runs, and (from step 5) runs the game
  function beltScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, eq, set, whenFlag, whenReceive, forever, wait, nextCostume, goto, div, waitUntil, sayFor, join, stopAll, broadcast } = d;
    if (!at(1)) return B;
    // Start the game: set everything up first, then tell the others to start (so nobody reads a speed of 0).
    // From step 5 the same script then waits for the fifth miss.
    B.script(whenFlag(), [goto(0, BELT_Y), set("speed", 1), ...when(3, () => [set("score", 0)]), ...when(5, () => [set("missed", 0)]),
      broadcast("start"),
      ...when(5, () => [waitUntil(eq(v("missed"), 5)), sayFor(join("The factory is closed! Score: ", v("score")), 3), stopAll()])], 20, 20);
    // The stripes move: three costumes, one after the other (faster when the belt is faster).
    B.script(whenReceive("start"), [forever([wait(div(0.08, v("speed"))), nextCostume()])], 20, 200);
    return B;
  }

  // ---------------------------------------------------------------- Gift: the hatch makes them; each one rides
  function giftScripts(): Blocks {
    const B = new Blocks(P).local("kind", "state", "t", "base", "zone");
    const d = dsl(B);
    const { v, add, sub, mul, div, eq, lt, gt, and, or, not, set, change, ifThen, ifElse, whenFlag, whenReceive, whenCloned, whenClicked, hide, show, goto, goTo,
      forever, cloneMyself, deleteClone, wait, random, repeat, until, mouseDown, costumeTo, changeX, changeY, setX, setY, xPos, yPos, sin, abs,
      round, item, replace, glide, front, changeEffect, define, call, say, min } = d;
    if (!at(1)) return B;
    // The original stays hidden at the hatch and sends out gifts of a random colour (from step 6, now and then gold).
    B.script(whenFlag(), [hide()], 20, 20);
    B.script(whenReceive("start"), [forever([
      wait(at(6) ? div(random(1.4, 2.4), v("speed")) : random(1.6, 2.6)),
      set("kind", random(1, 3)), ...when(6, () => [ifThen(eq(random(1, 10), 1), [set("kind", 4)])]),
      costumeTo(v("kind")), goto(START_X, RIDE_Y), cloneMyself(),
    ])], 20, 20);
    // A gift rides the belt. At the end it falls off (from step 5 that is a miss).
    B.script(whenCloned(), [set("state", "belt"), show(), forever([
      ifThen(eq(v("state"), "belt"), [changeX(mul(1.2, v("speed"))),
        ifThen(gt(xPos(), END_X), [set("state", "fall"), repeat(12, [changeY(-6), changeX(2), changeEffect("GHOST", 8)]),
          ...when(5, () => [change("missed", 1)]), deleteClone()])]),
    ])], 20, 260);
    if (!at(2)) return B;

    // Thrown up in the air: up a bit, then gently down in a zigzag until it lands on the belt again.
    define("toss", [
      set("state", "air"),
      until(gt(yPos(), add(RIDE_Y, 30)), [changeY(8)]), repeat(6, [changeY(6)]),
      set("base", xPos()), set("t", 0),
      until(lt(yPos(), RIDE_Y), [change("t", 1), setX(add(v("base"), mul(18, sin(mul(v("t"), 8))))), changeY(-1.2)]),
      setY(RIDE_Y), say(""), set("state", "belt"),
    ], { x: 20, y: 900 });

    // Grab it (on the belt or in the air): follow the mouse while the button is down, then let go.
    const busy = () => eq(item("fill", v("zone")), FULL);
    const sorted = () => [
      set("state", "in"), replace("fill", v("zone"), add(item("fill", v("zone")), 1)),
      ...(at(6) ? [ifElse(eq(v("kind"), 4), [change("score", 50)], [change("score", 10)]), set("speed", min(2.5, add(v("speed"), 0.04)))] : [change("score", 10)]),
      glide(0.15, sub(mul(v("zone"), BASKET_GAP), 2 * BASKET_GAP), BASKET_Y + 20), deleteClone(),
    ];
    B.script(whenClicked(), [ifThen(or(eq(v("state"), "belt"), eq(v("state"), "air")), [
      set("state", "held"), front(),
      until(not(mouseDown()), [goTo("_mouse_")]),
      ...(at(3) ? [
        // Which basket is under it? Baskets are 150 apart: round((x + 150) / 150) + 1 gives 1, 2 or 3.
        set("zone", add(round(div(add(xPos(), BASKET_GAP), BASKET_GAP)), 1)),
        ifElse(and(lt(yPos(), -50), and(and(gt(v("zone"), 0), lt(v("zone"), 4)), lt(abs(sub(xPos(), sub(mul(v("zone"), BASKET_GAP), 2 * BASKET_GAP))), 70))), [
          ...(at(4) ? [ifElse(busy(), [say("Busy!"), call("toss")], [
            ifElse(at(6) ? or(eq(v("kind"), v("zone")), eq(v("kind"), 4)) : eq(v("kind"), v("zone")), sorted(), [say("Oops!"), call("toss")])])]
            : [ifElse(eq(v("kind"), v("zone")), sorted(), [say("Oops!"), call("toss")])]),
        ], [call("toss")]),
      ] : [call("toss")]),
    ])], 20, 560);
    return B;
  }

  // ---------------------------------------------------------------- Basket: three of them; they fill up and empty
  function basketScripts(): Blocks {
    const B = new Blocks(P).local("slot");
    const d = dsl(B);
    const { v, add, sub, mul, eq, set, change, whenFlag, whenCloned, hide, show, goto, repeat, cloneMyself, forever, costumeTo, item,
      deleteAll, addTo, ifThen, wait, glide, replace, xPos } = d;
    if (!at(3)) return B;
    // The original makes three baskets: red, green, blue. "fill" says how many gifts each one holds.
    B.script(whenFlag(), [hide(), deleteAll("fill"), set("slot", 0), repeat(3, [
      addTo("fill", 0), change("slot", 1), goto(sub(mul(v("slot"), BASKET_GAP), 2 * BASKET_GAP), BASKET_Y), cloneMyself()])], 20, 20);
    // The costume shows how full it is: red0..red5 are costumes 1..6, green 7..12, blue 13..18.
    B.script(whenCloned(), [show(), forever([
      costumeTo(add(add(mul(sub(v("slot"), 1), 6), item("fill", v("slot"))), 1)),
      // Full: it glides away to be emptied, and comes back empty. It stays "full" (busy) until it is back.
      ...when(4, () => [ifThen(eq(item("fill", v("slot")), FULL), [
        wait(0.4), glide(0.8, xPos(), -250), wait(1.5), replace("fill", v("slot"), 0), costumeTo(add(mul(sub(v("slot"), 1), 6), 1)),
        glide(0.8, xPos(), BASKET_Y)])]),
    ])], 20, 220);
    return B;
  }

  const A = art(P);
  return P.build({
    backdrop: A.backdrop,
    sprites: [
      P.sprite("Belt", { blocks: beltScripts(), costumes: A.belt, layer: 1, x: 0, y: BELT_Y }),
      P.sprite("Basket", { blocks: basketScripts(), costumes: A.basket, layer: 2, visible: !at(3), x: 0, y: BASKET_Y }),
      P.sprite("Gift", { blocks: giftScripts(), costumes: A.gift, layer: 3, visible: !at(1), x: START_X, y: RIDE_Y }),
    ],
    listValues: { fill: [0, 0, 0] },
    shown: [...(at(3) ? ["score"] : []), ...(at(5) ? ["missed"] : [])],
  });
}
