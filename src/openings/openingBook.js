const OPENINGS = [
  { eco: "C20", name: "Apertura del Peón de Rey", moves: "e4 e5" },
  { eco: "C60", name: "Apertura Española", moves: "e4 e5 Nf3 Nc6 Bb5" },
  { eco: "C65", name: "Española: Defensa Berlinesa", moves: "e4 e5 Nf3 Nc6 Bb5 Nf6" },
  { eco: "C78", name: "Española: Variante Morphy", moves: "e4 e5 Nf3 Nc6 Bb5 a6" },
  { eco: "B20", name: "Defensa Siciliana", moves: "e4 c5" },
  { eco: "B30", name: "Siciliana: Variante Rossolimo", moves: "e4 c5 Nf3 Nc6 Bb5" },
  { eco: "B12", name: "Defensa Caro-Kann", moves: "e4 c6" },
  { eco: "C10", name: "Defensa Francesa", moves: "e4 e6" },
  { eco: "D06", name: "Gambito de Dama", moves: "d4 d5 c4" },
  { eco: "E60", name: "Defensa India de Rey", moves: "d4 Nf6 c4 g6" },
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
