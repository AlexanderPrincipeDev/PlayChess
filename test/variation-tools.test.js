import test from "node:test";
import assert from "node:assert/strict";
import { pvToSan, uciToMove } from "../src/chess/variationTools.js";

test("convierte UCI a objeto de jugada", () => {
  assert.deepEqual(uciToMove("e7e8q"), { from: "e7", to: "e8", promotion: "q" });
});

test("formatea una línea principal en SAN", () => {
  const san = pvToSan("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [
    "e2e4",
    "e7e5",
    "g1f3",
  ]);

  assert.equal(san, "e4 e5 Nf3");
});
