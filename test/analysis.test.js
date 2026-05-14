import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { classifyLoss, scoreToCp } from "../src/analysis/moveClassifier.js";
import { detectOpening, recommendOpeningMoves } from "../src/openings/openingBook.js";

test("clasifica pérdidas de centipawns", () => {
  assert.equal(classifyLoss(15), "excelente");
  assert.equal(classifyLoss(80), "imprecisión");
  assert.equal(classifyLoss(180), "error");
  assert.equal(classifyLoss(320), "blunder");
});

test("convierte score del motor a centipawns desde el turno", () => {
  assert.equal(scoreToCp({ type: "cp", value: 34 }, "w"), 34);
  assert.equal(scoreToCp({ type: "cp", value: 34 }, "b"), -34);
  assert.equal(scoreToCp({ type: "mate", value: 2 }, "w"), 10000);
});

test("detecta apertura y recomienda continuación", () => {
  const chess = new Chess();
  chess.move("e4");
  chess.move("e5");
  chess.move("Nf3");
  chess.move("Nc6");

  const moves = chess.history({ verbose: true });
  assert.equal(detectOpening(moves).name, "Apertura del Peón de Rey");

  const recommendations = recommendOpeningMoves(moves).map((item) => item.move);
  assert.ok(recommendations.includes("Bb5"));
  assert.ok(recommendations.includes("Bc4"));
});
