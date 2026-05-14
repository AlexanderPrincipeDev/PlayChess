import { gameSearchText } from "../library/gameMetadata.js";

export function renderSavedGamesLibrary(
  container,
  games,
  { query = "", result = "all", onOpen, onExport, onDelete } = {},
) {
  container.innerHTML = "";
  const filtered = filterGames(games, query, result);

  const stats = document.createElement("div");
  stats.className = "library-stats";
  stats.textContent = `${filtered.length}/${games.length} partidas`;
  container.append(stats);

  if (!filtered.length) {
    container.append(emptyState(games.length ? "Sin resultados para el filtro." : "Sin partidas guardadas"));
    return;
  }

  for (const game of filtered.slice(0, 30)) {
    const card = document.createElement("article");
    card.className = "library-card";

    const title = document.createElement("strong");
    title.textContent = game.title || game.opening?.name || "Partida guardada";

    const meta = document.createElement("span");
    meta.textContent = [
      game.result || "*",
      game.opening?.eco,
      game.moveCount ? `${game.moveCount} jugadas` : "",
      formatDate(game.updatedAt || game.createdAt),
    ].filter(Boolean).join(" · ");

    const actions = document.createElement("div");
    actions.className = "library-actions";
    actions.append(
      actionButton("Abrir", () => onOpen?.(game)),
      actionButton("Exportar", () => onExport?.(game)),
      actionButton("Eliminar", () => onDelete?.(game)),
    );

    card.append(title, meta, actions);
    container.append(card);
  }
}

export function renderRepertoireLibrary(container, lines, onOpen) {
  container.innerHTML = "";
  if (!lines.length) {
    container.append(emptyState("Sin líneas guardadas"));
    return;
  }

  for (const line of lines.slice(0, 20)) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "library-item";
    row.textContent = `${line.color === "black" ? "Negras" : "Blancas"} · ${line.name || "Línea"}`;
    row.addEventListener("click", () => onOpen?.(line));
    container.append(row);
  }
}

function filterGames(games, query, result) {
  const normalized = query.trim().toLowerCase();
  return games.filter((game) => {
    const matchesQuery = !normalized || gameSearchText(game).includes(normalized);
    const matchesResult = result === "all" || (game.result || "*") === result;
    return matchesQuery && matchesResult;
  });
}

function actionButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function emptyState(text) {
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = text;
  return empty;
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("es", { dateStyle: "short" }).format(new Date(value));
  } catch {
    return "";
  }
}
