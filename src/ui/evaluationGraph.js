export function renderEvaluationGraph(container, moves, annotations = {}, activePly = 0, onSelectPly) {
  container.innerHTML = "";

  if (!moves.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Carga o juega una partida para ver el gráfico.";
    container.append(empty);
    return;
  }

  const graph = document.createElement("div");
  graph.className = "eval-graph-bars";
  graph.style.gridTemplateColumns = `repeat(${moves.length}, minmax(9px, 1fr))`;

  moves.forEach((move, index) => {
    const ply = index + 1;
    const annotation = annotations[ply] || {};
    const cp = evalToCp(annotation.eval);
    const normalized = cp == null ? 50 : Math.max(4, Math.min(96, 50 + cp / 12));
    const bar = document.createElement("button");
    bar.type = "button";
    bar.className = "eval-bar";
    bar.classList.toggle("active", ply === activePly);
    if (annotation.classification) bar.dataset.classification = annotation.classification;
    bar.style.setProperty("--eval-height", `${normalized}%`);
    bar.title = `${ply}. ${move.san}${annotation.eval ? ` · ${annotation.eval}` : ""}`;
    bar.addEventListener("click", () => onSelectPly?.(ply));
    graph.append(bar);
  });

  container.append(graph);
}

export function renderAnalysisReport(container, moves, annotations = {}) {
  container.innerHTML = "";

  if (!moves.length) {
    container.append(reportEmpty("Sin partida para revisar."));
    return;
  }

  const values = moves.map((_, index) => annotations[index + 1] || {});
  const losses = values.map((item) => item.loss).filter((loss) => Number.isFinite(loss));
  if (!losses.length) {
    container.append(reportEmpty("Ejecuta “Analizar partida” para generar el reporte."));
    return;
  }

  const counts = countClassifications(values);
  const avgLoss = average(losses);
  const accuracy = accuracyFromLoss(avgLoss);
  const whiteLosses = values
    .filter((_, index) => index % 2 === 0)
    .map((item) => item.loss)
    .filter((loss) => Number.isFinite(loss));
  const blackLosses = values
    .filter((_, index) => index % 2 === 1)
    .map((item) => item.loss)
    .filter((loss) => Number.isFinite(loss));
  const critical = values
    .map((item, index) => ({ ...item, ply: index + 1, san: moves[index]?.san }))
    .filter((item) => ["blunder", "error", "imprecisión"].includes(item.classification))
    .slice(0, 6);

  const summary = document.createElement("div");
  summary.className = "report-grid";
  summary.append(
    metric("Precisión", `${accuracy.toFixed(0)}%`),
    metric("Blancas", whiteLosses.length ? `${accuracyFromLoss(average(whiteLosses)).toFixed(0)}%` : "N/A"),
    metric("Negras", blackLosses.length ? `${accuracyFromLoss(average(blackLosses)).toFixed(0)}%` : "N/A"),
    metric("Pérdida media", `${avgLoss.toFixed(0)} cp`),
    metric("Errores", String((counts.error || 0) + (counts.blunder || 0))),
    metric("Buenas", String((counts.excelente || 0) + (counts.buena || 0))),
  );

  const list = document.createElement("div");
  list.className = "critical-list";

  if (!critical.length) {
    list.append(reportEmpty("No hay momentos críticos detectados."));
  } else {
    for (const item of critical) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "critical-item";
      row.dataset.classification = item.classification;
      row.textContent = `${item.ply}. ${item.san} · ${item.classification} · mejor ${item.bestMoveSan || item.bestMove || "N/A"}`;
      row.addEventListener("click", () => container.dispatchEvent(new CustomEvent("select-ply", {
        bubbles: true,
        detail: { ply: item.ply },
      })));
      list.append(row);
    }
  }

  container.append(summary, list);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function accuracyFromLoss(loss) {
  return Math.max(0, Math.min(100, 100 - loss / 6));
}

function metric(label, value) {
  const box = document.createElement("div");
  box.className = "report-metric";
  const name = document.createElement("span");
  name.textContent = label;
  const number = document.createElement("strong");
  number.textContent = value;
  box.append(name, number);
  return box;
}

function reportEmpty(text) {
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = text;
  return empty;
}

function countClassifications(values) {
  return values.reduce((counts, item) => {
    if (item.classification) counts[item.classification] = (counts[item.classification] || 0) + 1;
    return counts;
  }, {});
}

function evalToCp(evalText) {
  if (!evalText) return null;
  if (evalText.startsWith("#+")) return 1000;
  if (evalText.startsWith("#-")) return -1000;
  const numeric = Number(evalText);
  return Number.isFinite(numeric) ? numeric * 100 : null;
}
