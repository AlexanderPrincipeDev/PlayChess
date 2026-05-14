import { Chess } from "chess.js";

export function pvToSan(fen, pv = [], limit = 12) {
  if (!pv.length) return "";

  try {
    const chess = new Chess(fen);
    const san = [];
    for (const uci of pv.slice(0, limit)) {
      const move = chess.move(uciToMove(uci));
      if (!move) break;
      san.push(move.san);
    }
    return san.join(" ");
  } catch {
    return pv.join(" ");
  }
}

export function uciToMove(uci) {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.slice(4, 5) || "q",
  };
}

export function createVariation({ basePly, baseFen, line, index }) {
  const pv = line?.pv || [];
  return {
    id: crypto.randomUUID(),
    basePly,
    baseFen,
    index,
    eval: line?.score || null,
    depth: line?.depth || null,
    pv,
    san: pvToSan(baseFen, pv),
    createdAt: new Date().toISOString(),
  };
}
