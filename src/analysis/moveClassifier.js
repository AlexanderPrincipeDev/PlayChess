export function scoreToCp(score, turn) {
  if (!score) return null;
  const sign = turn === "b" ? -1 : 1;
  if (score.type === "mate") return score.value > 0 ? 10000 * sign : -10000 * sign;
  return score.value * sign;
}

export function classifyLoss(loss) {
  if (loss == null) return "";
  if (loss <= 20) return "excelente";
  if (loss <= 50) return "buena";
  if (loss <= 100) return "imprecisión";
  if (loss <= 250) return "error";
  return "blunder";
}

export function classificationNag(classification) {
  return {
    excelente: "!",
    buena: "",
    imprecisión: "?!",
    error: "?",
    blunder: "??",
  }[classification] || "";
}
