export function currentGameResult(game, fallback = "*") {
  if (game.isCheckmate()) return game.turn() === "w" ? "0-1" : "1-0";
  if (game.isGameOver()) return "1/2-1/2";
  return fallback;
}

export function gameSearchText(record = {}) {
  return [
    record.title,
    record.white,
    record.black,
    record.result,
    record.opening?.eco,
    record.opening?.name,
    record.tags?.join(" "),
    record.pgn,
  ].filter(Boolean).join(" ").toLowerCase();
}

export function buildGameRecord({
  id,
  pgn,
  fen,
  annotations,
  variations,
  opening,
  result,
  playerColor,
  moveCount,
}) {
  const date = new Date().toISOString();
  const title = `${opening?.eco || "?"} · ${opening?.name || "Partida guardada"}`;
  return {
    id,
    title,
    pgn,
    fen,
    annotations,
    variations,
    opening,
    result,
    playerColor,
    moveCount,
    white: playerColor === "white" ? "Jugador" : "Stockfish",
    black: playerColor === "black" ? "Jugador" : "Stockfish",
    tags: [opening?.eco, result, playerColor].filter(Boolean),
    createdAt: date,
  };
}
