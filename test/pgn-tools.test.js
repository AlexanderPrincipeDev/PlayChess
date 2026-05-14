import test from "node:test";
import assert from "node:assert/strict";
import { splitPgnGames } from "../src/chess/pgnTools.js";

test("divide un archivo PGN con varias partidas", () => {
  const text = [
    '[Event "Uno"]',
    '[White "A"]',
    '[Black "B"]',
    "",
    "1. e4 e5 *",
    "",
    '[Event "Dos"]',
    '[White "C"]',
    '[Black "D"]',
    "",
    "1. d4 d5 *",
  ].join("\n");

  const games = splitPgnGames(text);
  assert.equal(games.length, 2);
  assert.equal(games[0].label, "Uno · A vs B");
  assert.equal(games[1].label, "Dos · C vs D");
});
