import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { parseSpanishMove } from "../src/chess/spanishMoveParser.js";

test("parsea pieza y casilla en español", () => {
  const chess = new Chess();
  const result = parseSpanishMove("caballo efe tres", chess.moves({ verbose: true }));

  assert.equal(result.ok, true);
  assert.deepEqual(result.move, { from: "g1", to: "f3", promotion: "q" });
});

test("parsea captura algebraica hablada", () => {
  const chess = new Chess("rnbqkbnr/pppppppp/8/8/8/5n2/PPPP1PPP/RNBQKBNR w KQkq - 0 1");
  const result = parseSpanishMove("dama por f3", chess.moves({ verbose: true }));

  assert.equal(result.ok, true);
  assert.deepEqual(result.move, { from: "d1", to: "f3", promotion: "q" });
});

test("rechaza jugadas ambiguas", () => {
  const chess = new Chess("4k3/8/8/8/8/8/2N1N3/4K3 w - - 0 1");
  const result = parseSpanishMove("caballo d4", chess.moves({ verbose: true }));

  assert.equal(result.ok, false);
  assert.match(result.message, /ambigua/i);
});
