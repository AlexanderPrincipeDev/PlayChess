export function parseInfoLine(line) {
  const tokens = line.trim().split(/\s+/);
  const info = { raw: line };

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "depth") info.depth = Number(tokens[++index]);
    else if (token === "seldepth") info.seldepth = Number(tokens[++index]);
    else if (token === "multipv") info.multipv = Number(tokens[++index]);
    else if (token === "nodes") info.nodes = Number(tokens[++index]);
    else if (token === "nps") info.nps = Number(tokens[++index]);
    else if (token === "time") info.time = Number(tokens[++index]);
    else if (token === "score") {
      const type = tokens[++index];
      const value = Number(tokens[++index]);
      info.score = { type, value };
    } else if (token === "pv") {
      info.pv = tokens.slice(index + 1);
      break;
    }
  }

  return info;
}

export function parseBestMove(line) {
  const parts = line.trim().split(/\s+/);
  return {
    move: parts[1] || null,
    ponder: parts.includes("ponder") ? parts[parts.indexOf("ponder") + 1] : null,
  };
}

export function formatScore(score, turn) {
  if (!score) return "Sin evaluación";
  const multiplier = turn === "b" ? -1 : 1;
  if (score.type === "mate") {
    const mate = score.value * multiplier;
    return `M${mate > 0 ? "+" : ""}${mate}`;
  }
  const pawns = (score.value * multiplier) / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}
