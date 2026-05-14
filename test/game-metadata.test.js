import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { buildGameRecord, currentGameResult, gameSearchText } from "../src/library/gameMetadata.js";

test("detecta resultado de jaque mate", () => {
  const chess = new Chess();
  chess.move("f3");
  chess.move("e5");
  chess.move("g4");
  chess.move("Qh4#");

  assert.equal(currentGameResult(chess), "0-1");
});

test("crea metadatos buscables para biblioteca", () => {
  const record = buildGameRecord({
    id: "game-1",
    pgn: "1. e4 c5 *",
    fen: "fen",
    annotations: {},
    variations: [],
    opening: { eco: "B20", name: "Defensa Siciliana" },
    result: "*",
    playerColor: "white",
    moveCount: 2,
  });

  assert.equal(record.title, "B20 · Defensa Siciliana");
  assert.equal(record.white, "Jugador");
  assert.match(gameSearchText(record), /siciliana/);
});
