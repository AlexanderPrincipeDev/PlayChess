export function splitPgnGames(text) {
  if (!text) return [];
  const starts = [...text.matchAll(/(?=^\s*\[Event\s+)/gm)].map((match) => match.index);
  if (starts.length <= 1) return [{ label: pgnLabel(text, 1), pgn: text }];

  return starts.map((start, index) => {
    const end = starts[index + 1] ?? text.length;
    const pgn = text.slice(start, end).trim();
    return {
      label: pgnLabel(pgn, index + 1),
      pgn,
    };
  }).filter((item) => item.pgn);
}

export function pgnLabel(pgn, fallbackNumber) {
  const white = pgn.match(/\[White\s+"([^"]+)"/)?.[1] || "Blancas";
  const black = pgn.match(/\[Black\s+"([^"]+)"/)?.[1] || "Negras";
  const event = pgn.match(/\[Event\s+"([^"]+)"/)?.[1];
  return `${event ? `${event} · ` : ""}${white} vs ${black}` || `Partida ${fallbackNumber}`;
}
