const OPENINGS = [
  { eco: "C20", name: "Apertura del Peón de Rey", moves: "e4 e5" },
  { eco: "C42", name: "Defensa Petrov", moves: "e4 e5 Nf3 Nf6" },
  { eco: "C50", name: "Juego Italiano", moves: "e4 e5 Nf3 Nc6 Bc4" },
  { eco: "C60", name: "Apertura Española", moves: "e4 e5 Nf3 Nc6 Bb5" },
  { eco: "C65", name: "Española: Defensa Berlinesa", moves: "e4 e5 Nf3 Nc6 Bb5 Nf6" },
  { eco: "C78", name: "Española: Variante Morphy", moves: "e4 e5 Nf3 Nc6 Bb5 a6" },
  { eco: "B20", name: "Defensa Siciliana", moves: "e4 c5" },
  { eco: "B33", name: "Siciliana: Sveshnikov", moves: "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5" },
  { eco: "B90", name: "Siciliana: Najdorf", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6" },
  { eco: "B30", name: "Siciliana: Variante Rossolimo", moves: "e4 c5 Nf3 Nc6 Bb5" },
  { eco: "B12", name: "Defensa Caro-Kann", moves: "e4 c6" },
  { eco: "B18", name: "Caro-Kann: Variante Clásica", moves: "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5" },
  { eco: "C10", name: "Defensa Francesa", moves: "e4 e6" },
  { eco: "C02", name: "Francesa: Variante Avance", moves: "e4 e6 d4 d5 e5" },
  { eco: "D06", name: "Gambito de Dama", moves: "d4 d5 c4" },
  { eco: "D37", name: "Gambito de Dama Declinado", moves: "d4 d5 c4 e6 Nf3 Nf6 Nc3 Be7" },
  { eco: "D85", name: "Defensa Grünfeld", moves: "d4 Nf6 c4 g6 Nc3 d5" },
  { eco: "E60", name: "Defensa India de Rey", moves: "d4 Nf6 c4 g6" },
  { eco: "E97", name: "India de Rey: Línea Principal", moves: "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5" },
  { eco: "A45", name: "Ataque Trompowsky", moves: "d4 Nf6 Bg5" },
  { eco: "A40", name: "Sistema Londres", moves: "d4 Nf6 Bf4" },
];

export function detectOpening(moves) {
  const san = moves.map((move) => move.san.replace(/[+#?!]+/g, ""));
  let best = null;

  for (const opening of OPENINGS) {
    const line = opening.moves.split(" ");
    const matches = line.every((move, index) => san[index] === move);
    if (matches && (!best || line.length > best.moves.split(" ").length)) {
      best = opening;
    }
  }

  return best || { eco: "?", name: "Apertura no identificada", moves: "" };
}

export function recommendOpeningMoves(moves) {
  const san = moves.map((move) => move.san.replace(/[+#?!]+/g, ""));
  const recommendations = new Map();

  for (const opening of OPENINGS) {
    const line = opening.moves.split(" ");
    const matches = san.every((move, index) => line[index] === move);
    if (!matches || san.length >= line.length) continue;

    const nextMove = line[san.length];
    const current = recommendations.get(nextMove);
    const depth = line.length;
    if (!current || depth > current.depth) {
      recommendations.set(nextMove, {
        move: nextMove,
        eco: opening.eco,
        name: opening.name,
        depth,
      });
    }
  }

  return [...recommendations.values()]
    .sort((left, right) => right.depth - left.depth || left.name.localeCompare(right.name))
    .slice(0, 6);
}
