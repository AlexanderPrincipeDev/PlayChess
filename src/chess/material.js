export function capturedMaterial(moves) {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const whiteCaptured = [];
  const blackCaptured = [];

  for (const move of moves) {
    if (!move.captured) continue;
    if (move.color === "w") whiteCaptured.push(move.captured);
    else blackCaptured.push(move.captured);
  }

  const whiteValue = whiteCaptured.reduce((sum, piece) => sum + (values[piece] || 0), 0);
  const blackValue = blackCaptured.reduce((sum, piece) => sum + (values[piece] || 0), 0);
  return {
    whiteCaptured,
    blackCaptured,
    balance: whiteValue - blackValue,
  };
}

export function materialRow(pieces, balance) {
  const order = ["q", "r", "b", "n", "p"];
  const glyphs = { q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
  const counts = pieces.reduce((map, piece) => {
    map[piece] = (map[piece] || 0) + 1;
    return map;
  }, {});
  const pieceText = order
    .filter((piece) => counts[piece])
    .map((piece) => `${glyphs[piece]}${counts[piece] > 1 ? counts[piece] : ""}`)
    .join(" ");
  const balanceText = balance > 0 ? `<span class="material-plus">+${balance}</span>` : "";
  return pieceText || balanceText ? `${pieceText} ${balanceText}`.trim() : "<span>Sin capturas</span>";
}
