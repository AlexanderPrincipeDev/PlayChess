import { Chess } from "chess.js";

export class GameState {
  constructor() {
    this.chess = new Chess();
    this.loadedPgn = "";
    this.lineMoves = [];
    this.currentPly = 0;
    this.annotations = new Map();
  }

  reset() {
    this.chess = new Chess();
    this.loadedPgn = "";
    this.lineMoves = [];
    this.currentPly = 0;
    this.annotations.clear();
  }

  loadFen(fen) {
    const next = new Chess();
    next.load(fen);
    this.chess = next;
    this.loadedPgn = "";
    this.lineMoves = [];
    this.currentPly = 0;
    this.annotations.clear();
  }

  loadPgn(pgn) {
    const parsed = new Chess();
    parsed.loadPgn(pgn);
    this.loadedPgn = pgn;
    this.lineMoves = parsed.history({ verbose: true });
    this.currentPly = this.lineMoves.length;
    this.annotations.clear();
    this.rebuildFromLineMoves();
  }

  goToStart() {
    this.currentPly = 0;
    this.rebuildFromLineMoves();
  }

  goToPreviousPly() {
    if (!this.lineMoves.length) return false;
    this.currentPly = Math.max(0, this.currentPly - 1);
    this.rebuildFromLineMoves();
    return true;
  }

  goToNextPly() {
    if (!this.lineMoves.length) return false;
    this.currentPly = Math.min(this.lineMoves.length, this.currentPly + 1);
    this.rebuildFromLineMoves();
    return true;
  }

  goToEnd() {
    if (!this.lineMoves.length) return false;
    this.currentPly = this.lineMoves.length;
    this.rebuildFromLineMoves();
    return true;
  }

  goToPly(ply) {
    if (!this.lineMoves.length) return false;
    this.currentPly = Math.min(this.lineMoves.length, Math.max(0, Number(ply)));
    this.rebuildFromLineMoves();
    return true;
  }

  move(from, to, promotion = "q") {
    let move = null;
    try {
      move = this.chess.move({ from, to, promotion });
    } catch {
      return null;
    }
    if (!move) return null;
    this.loadedPgn = "";
    if (this.currentPly < this.lineMoves.length) {
      this.lineMoves = this.lineMoves.slice(0, this.currentPly);
      this.pruneAnnotations();
    }
    this.lineMoves.push(move);
    this.currentPly = this.lineMoves.length;
    return move;
  }

  moveUci(uci) {
    if (!uci || uci === "(none)") return null;
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.slice(4, 5) || "q";
    return this.move(from, to, promotion);
  }

  undoPair() {
    if (this.currentPly < this.lineMoves.length) {
      this.lineMoves = this.lineMoves.slice(0, this.currentPly);
    }
    const removed = this.lineMoves.splice(Math.max(0, this.lineMoves.length - 2), 2);
    this.currentPly = this.lineMoves.length;
    this.loadedPgn = "";
    this.pruneAnnotations();
    this.rebuildFromLineMoves();
    return Boolean(removed.length);
  }

  legalTargets(square) {
    return this.chess.moves({ square, verbose: true }).map((move) => move.to);
  }

  legalMoves() {
    return this.chess.moves({ verbose: true });
  }

  materialSummary() {
    const pieces = this.chess.board().flat().filter(Boolean);
    return {
      pieceCount: pieces.length,
      hasQueens: pieces.some((piece) => piece.type === "q"),
      pieces,
    };
  }

  pieceAt(square) {
    return this.chess.get(square);
  }

  fen() {
    return this.chess.fen();
  }

  pgn() {
    return this.chess.pgn();
  }

  history() {
    return this.chess.history({ verbose: true });
  }

  lineHistory() {
    return this.lineMoves;
  }

  linePgn() {
    const next = new Chess();
    const parts = [];
    for (const move of this.lineMoves) {
      next.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
      const ply = parts.length + 1;
      const annotation = this.getAnnotation(ply);
      const moveNumber = Math.ceil(ply / 2);
      const prefix = ply % 2 === 1 ? `${moveNumber}.` : "";
      const nag = annotation.nag || "";
      const evalText = annotation.eval ? ` [%eval ${annotation.eval}]` : "";
      const classText = annotation.classification ? ` ${annotation.classification}` : "";
      const comment = annotation.comment || evalText || classText
        ? ` {${[evalText.trim(), classText.trim(), annotation.comment].filter(Boolean).join(" ")}}`
        : "";
      parts.push(`${prefix} ${move.san}${nag}${comment}`.trim());
    }
    return [
      '[Event "Play Chess Stockfish"]',
      `[Date "${new Date().toISOString().slice(0, 10).replaceAll("-", ".")}"]`,
      '[White "Jugador"]',
      '[Black "Stockfish"]',
      '[Result "*"]',
      "",
      `${parts.join(" ")} *`.trim(),
    ].join("\n");
  }

  setAnnotation(ply, patch) {
    const current = this.getAnnotation(ply);
    this.annotations.set(Number(ply), { ...current, ...patch });
  }

  getAnnotation(ply) {
    return this.annotations.get(Number(ply)) || {
      comment: "",
      nag: "",
      eval: "",
      bestMove: "",
      classification: "",
      loss: null,
    };
  }

  annotationsObject() {
    return Object.fromEntries(this.annotations.entries());
  }

  loadAnnotations(annotations = {}) {
    this.annotations = new Map(
      Object.entries(annotations).map(([ply, value]) => [Number(ply), value]),
    );
  }

  activePly() {
    return this.currentPly;
  }

  turn() {
    return this.chess.turn();
  }

  status() {
    if (this.chess.isCheckmate()) return `Jaque mate. Ganan ${this.turn() === "w" ? "negras" : "blancas"}.`;
    if (this.chess.isStalemate()) return "Tablas por ahogado.";
    if (this.chess.isThreefoldRepetition()) return "Tablas por repetición.";
    if (this.chess.isInsufficientMaterial()) return "Tablas por material insuficiente.";
    if (this.chess.isDraw()) return "Tablas.";
    if (this.chess.isCheck()) return `Jaque a ${this.turn() === "w" ? "blancas" : "negras"}.`;
    return `Turno de ${this.turn() === "w" ? "blancas" : "negras"}.`;
  }

  isGameOver() {
    return this.chess.isGameOver();
  }

  isCheckmate() {
    return this.chess.isCheckmate();
  }

  rebuildFromLineMoves() {
    const next = new Chess();
    for (const move of this.lineMoves.slice(0, this.currentPly)) {
      next.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
    }
    this.chess = next;
  }

  pruneAnnotations() {
    for (const ply of this.annotations.keys()) {
      if (ply > this.lineMoves.length) this.annotations.delete(ply);
    }
  }
}
