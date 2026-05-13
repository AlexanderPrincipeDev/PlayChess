import { Chess } from "chess.js";
import { formatScore } from "../engine/uciParser.js";

export function renderAnalysis(container, { lines, bestMove, turn, thinking, fen }) {
  const orderedLines = lines?.length ? lines : [];
  const mainLine = orderedLines[0];
  const score = mainLine?.score ? formatScore(mainLine.score, turn) : "0.00";
  const depth = mainLine?.depth ? `Profundidad ${mainLine.depth}` : thinking ? "Analizando..." : "En espera";
  const nps = mainLine?.nps ? `${formatCompact(mainLine.nps)} n/s` : "N/A";

  container.querySelector("[data-analysis-score]").textContent = score;
  container.querySelector("[data-analysis-depth]").textContent = depth;
  container.querySelector("[data-analysis-nps]").textContent = nps;
  container.querySelector("[data-analysis-best]").textContent =
    formatBestMove(fen, bestMove || mainLine?.pv?.[0]) || "N/A";

  const list = container.querySelector("[data-analysis-lines]");
  list.innerHTML = "";

  if (!orderedLines.length) {
    const empty = document.createElement("li");
    empty.className = "analysis-line empty-state";
    empty.textContent = thinking ? "Esperando primeras líneas..." : "Sin análisis activo";
    list.append(empty);
    return;
  }

  for (const line of orderedLines.slice(0, 5)) {
    const item = document.createElement("li");
    item.className = "analysis-line";

    const evalNode = document.createElement("span");
    evalNode.className = "line-score";
    evalNode.textContent = formatScore(line.score, turn);

    const depthNode = document.createElement("span");
    depthNode.className = "line-depth";
    depthNode.textContent = line.depth ? `d${line.depth}` : "d?";

    const pvNode = document.createElement("span");
    pvNode.className = "line-pv";
    pvNode.textContent = formatPv(fen, line.pv);

    item.append(evalNode, depthNode, pvNode);
    list.append(item);
  }
}

function formatBestMove(fen, move) {
  if (!move) return null;
  return formatPv(fen, [move]) || move;
}

function formatPv(fen, pv = []) {
  if (!pv.length) return "Sin variante";

  try {
    const chess = new Chess(fen);
    const san = [];
    for (const uci of pv.slice(0, 12)) {
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.slice(4, 5) || "q",
      });
      if (!move) break;
      san.push(move.san);
    }
    return san.join(" ");
  } catch {
    return pv.join(" ");
  }
}

function formatCompact(value) {
  return new Intl.NumberFormat("es", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
