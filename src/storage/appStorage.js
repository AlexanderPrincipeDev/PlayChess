const STORAGE_KEY = "playchessstockfish:v1";
const GAMES_KEY = "playchessstockfish:games:v1";
const REPERTOIRE_KEY = "playchessstockfish:repertoire:v1";

export const DEFAULT_SETTINGS = {
  mode: "play",
  orientation: "white",
  playerColor: "white",
  engineProfile: "stockfish18-full",
  engineDepth: 10,
  engineMoveTime: 700,
  analysisDepth: 12,
  analysisLines: 3,
  skillLevel: 20,
  limitStrength: false,
  uciElo: 1800,
  hashMb: 32,
  clockMinutes: 5,
  incrementSeconds: 0,
  showCoordinates: true,
  boardTheme: "classic",
  pieceTheme: "filled",
  fen: null,
  pgn: "",
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return sanitizeSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeSettings(settings)));
  } catch {
    // Storage can be unavailable in private contexts; the app remains usable.
  }
}

function sanitizeSettings(input = {}) {
  const mode = input.mode === "analysis" ? "analysis" : "play";
  const orientation = input.orientation === "black" ? "black" : "white";
  const playerColor = input.playerColor === "black" ? "black" : "white";

  return {
    ...DEFAULT_SETTINGS,
    ...input,
    mode,
    orientation,
    playerColor,
    engineProfile: sanitizeEngineProfile(input.engineProfile),
    engineDepth: clampNumber(input.engineDepth, 1, 20, DEFAULT_SETTINGS.engineDepth),
    engineMoveTime: clampNumber(input.engineMoveTime, 100, 5000, DEFAULT_SETTINGS.engineMoveTime),
    analysisDepth: clampNumber(input.analysisDepth, 1, 24, DEFAULT_SETTINGS.analysisDepth),
    analysisLines: clampNumber(input.analysisLines, 1, 5, DEFAULT_SETTINGS.analysisLines),
    skillLevel: clampNumber(input.skillLevel, 0, 20, DEFAULT_SETTINGS.skillLevel),
    limitStrength: Boolean(input.limitStrength),
    uciElo: clampNumber(input.uciElo, 1320, 3190, DEFAULT_SETTINGS.uciElo),
    hashMb: clampNumber(input.hashMb, 16, 256, DEFAULT_SETTINGS.hashMb),
    clockMinutes: clampNumber(input.clockMinutes, 1, 180, DEFAULT_SETTINGS.clockMinutes),
    incrementSeconds: clampNumber(input.incrementSeconds, 0, 60, DEFAULT_SETTINGS.incrementSeconds),
    showCoordinates: input.showCoordinates !== false,
    boardTheme: ["classic", "blue", "green", "gray"].includes(input.boardTheme)
      ? input.boardTheme
      : DEFAULT_SETTINGS.boardTheme,
    pieceTheme: input.pieceTheme === "filled" ? "filled" : DEFAULT_SETTINGS.pieceTheme,
    fen: typeof input.fen === "string" && input.fen.trim() ? input.fen : null,
    pgn: typeof input.pgn === "string" ? input.pgn : "",
  };
}

function sanitizeEngineProfile(value) {
  const profiles = [
    "stockfish18-full",
    "stockfish18-lite",
    "stockfish18-master",
    "stockfish18-club",
    "stockfish18-asm",
  ];
  return profiles.includes(value) ? value : DEFAULT_SETTINGS.engineProfile;
}

export function loadCollection(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCollection(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Ignore storage failures; the in-memory app remains usable.
  }
}

export function saveGameRecord(record) {
  const games = loadCollection(GAMES_KEY);
  const next = { ...record, updatedAt: new Date().toISOString() };
  const existing = games.findIndex((game) => game.id === next.id);
  if (existing >= 0) games[existing] = next;
  else games.unshift(next);
  saveCollection(GAMES_KEY, games.slice(0, 100));
  return next;
}

export function loadSavedGames() {
  return loadCollection(GAMES_KEY);
}

export function saveRepertoireLine(line) {
  const lines = loadCollection(REPERTOIRE_KEY);
  const next = { ...line, updatedAt: new Date().toISOString() };
  const existing = lines.findIndex((item) => item.id === next.id);
  if (existing >= 0) lines[existing] = next;
  else lines.unshift(next);
  saveCollection(REPERTOIRE_KEY, lines.slice(0, 200));
  return next;
}

export function loadRepertoireLines() {
  return loadCollection(REPERTOIRE_KEY);
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}
