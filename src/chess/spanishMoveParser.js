const PIECE_NAME_WORDS = {
  p: ["peon", "peones"],
  n: ["caballo", "caballos"],
  b: ["alfil", "alfiles"],
  r: ["torre", "torres"],
  q: ["dama", "reina", "damas", "reinas"],
  k: ["rey", "reyes"],
};

const PIECE_INITIAL_WORDS = {
  p: ["p", "pe"],
  n: ["c", "ce", "se"],
  b: ["a"],
  r: ["t", "te"],
  q: ["d", "de"],
  k: ["r", "erre", "ere"],
};

const FILE_WORDS = {
  a: ["a"],
  b: ["b", "be", "ve"],
  c: ["c", "ce", "se"],
  d: ["d", "de"],
  e: ["e"],
  f: ["f", "efe", "fe"],
  g: ["g", "ge", "je", "gue"],
  h: ["h", "hache", "ache"],
};

const RANK_WORDS = {
  1: ["1", "uno", "un"],
  2: ["2", "dos"],
  3: ["3", "tres"],
  4: ["4", "cuatro"],
  5: ["5", "cinco"],
  6: ["6", "seis"],
  7: ["7", "siete"],
  8: ["8", "ocho"],
};

const PROMOTION_WORDS = {
  q: ["dama", "reina"],
  r: ["torre"],
  b: ["alfil"],
  n: ["caballo"],
};

export function parseSpanishMove(transcript, legalMoves) {
  const normalized = normalizeTranscript(transcript);
  const tokens = normalized.split(/\s+/).filter(Boolean);

  if (!tokens.length) {
    return fail("No escuché ninguna jugada.");
  }

  const castle = parseCastle(normalized, legalMoves);
  if (castle) return castle;

  const squares = extractSquares(normalized, tokens);
  const piece = detectPiece(tokens) || detectCompactPiece(tokens);
  const promotion = detectPromotion(tokens);
  const captureRequired = /\b(captura|capturo|toma|tomo|come|comer|por|x|equis)\b/.test(normalized)
    || /\b[acdtr]?x[a-h][1-8]\b/.test(normalized);

  if (!squares.length) {
    return fail("No detecté la casilla de destino.");
  }

  const to = squares.at(-1);
  const from = squares.length > 1 ? squares.at(-2) : null;
  const requestedPiece = piece || (from ? null : "p");

  let candidates = legalMoves.filter((move) => move.to === to);

  if (from) {
    candidates = candidates.filter((move) => move.from === from);
  }

  if (requestedPiece) {
    candidates = candidates.filter((move) => move.piece === requestedPiece);
  }

  if (promotion) {
    candidates = candidates.filter((move) => (move.promotion || "q") === promotion);
  }

  if (captureRequired) {
    candidates = candidates.filter((move) => Boolean(move.captured));
  }

  if (!candidates.length && !piece && !from) {
    candidates = legalMoves.filter((move) => move.to === to);
  }

  if (!candidates.length) {
    return fail(`No hay una jugada legal hacia ${to}.`);
  }

  if (candidates.length > 1) {
    return fail(`Jugada ambigua: ${candidates.map((move) => move.san).join(", ")}.`);
  }

  const move = candidates[0];
  return {
    ok: true,
    move: {
      from: move.from,
      to: move.to,
      promotion: promotion || move.promotion || "q",
    },
    san: move.san,
    transcript,
  };
}

function parseCastle(normalized, legalMoves) {
  const wantsCastle = /\b(enroque|enrocar|enroca|castillo)\b/.test(normalized);
  if (!wantsCastle) return null;

  const longCastle = /\b(largo|larga|grande)\b/.test(normalized);
  const targetSan = longCastle ? "O-O-O" : "O-O";
  const move = legalMoves.find((legalMove) => legalMove.san === targetSan);

  if (!move) {
    return fail(`${longCastle ? "Enroque largo" : "Enroque corto"} no es legal en esta posición.`);
  }

  return {
    ok: true,
    move: { from: move.from, to: move.to, promotion: "q" },
    san: move.san,
  };
}

function detectPiece(tokens) {
  for (const [piece, words] of Object.entries(PIECE_NAME_WORDS)) {
    if (words.some((word) => tokens.includes(word))) return piece;
  }

  const firstToken = tokens[0];
  for (const [piece, words] of Object.entries(PIECE_INITIAL_WORDS)) {
    if (words.includes(firstToken)) return piece;
  }

  return null;
}

function detectCompactPiece(tokens) {
  const algebraicPieces = {
    c: "n",
    a: "b",
    t: "r",
    d: "q",
    r: "k",
  };

  for (const token of tokens) {
    const match = token.match(/^([acdtr])x?([a-h][1-8])$/u);
    if (match) return algebraicPieces[match[1]] || null;
  }

  return null;
}

function detectPromotion(tokens) {
  const hasPromotionWord = tokens.some((token) =>
    ["promociona", "promociono", "promover", "corona", "coronar"].includes(token),
  );
  if (!hasPromotionWord) return null;

  for (const [piece, words] of Object.entries(PROMOTION_WORDS)) {
    if (words.some((word) => tokens.includes(word))) return piece;
  }

  return "q";
}

function extractSquares(normalized, tokens) {
  const found = [];
  for (const match of normalized.matchAll(/\b([a-h])\s*([1-8])\b/g)) {
    found.push(`${match[1]}${match[2]}`);
  }

  for (const match of normalized.matchAll(/\b[acdtr]?x?([a-h][1-8])\b/g)) {
    found.push(match[1]);
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const file = wordToFile(tokens[index]);
    const rank = wordToRank(tokens[index + 1]);
    if (file && rank) found.push(`${file}${rank}`);
  }

  for (const token of tokens) {
    const compactMove = token.match(/^[acdtr]?x?([a-h][1-8])$/u);
    if (compactMove) found.push(compactMove[1]);
  }

  return [...new Set(found)];
}

function wordToFile(word) {
  return Object.entries(FILE_WORDS).find(([, words]) => words.includes(word))?.[0] || null;
}

function wordToRank(word) {
  return Object.entries(RANK_WORDS).find(([, words]) => words.includes(word))?.[0] || null;
}

function normalizeTranscript(transcript) {
  return transcript
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b([acdtr])\s*(?:x|equis)\s*([a-h]\s*[1-8])\b/g, "$1x$2")
    .replace(/\b([acdtr])\s+([a-h]\s*[1-8])\b/g, "$1$2")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b([acdtr])(x?)([a-h])\s+([1-8])\b/g, "$1$2$3$4")
    .replace(/\bal\s+paso\b/g, "alpaso")
    .replace(/\s+/g, " ")
    .trim();
}

function fail(message) {
  return { ok: false, message };
}
