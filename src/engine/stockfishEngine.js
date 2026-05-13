import stockfishSingleJsUrl from "stockfish/bin/stockfish-18-single.js?url";
import stockfishSingleWasmUrl from "stockfish/bin/stockfish-18-single.wasm?url";
import stockfishLiteSingleJsUrl from "stockfish/bin/stockfish-18-lite-single.js?url";
import stockfishLiteSingleWasmUrl from "stockfish/bin/stockfish-18-lite-single.wasm?url";
import stockfishAsmJsUrl from "stockfish/bin/stockfish-18-asm.js?url";
import { parseBestMove, parseInfoLine } from "./uciParser.js";

export const ENGINE_PROFILES = [
  {
    id: "stockfish18-full",
    name: "Stockfish 18 Full",
    shortName: "SF 18 Full",
    description: "Máxima fuerza estable en navegador",
    estimatedElo: "3300+",
    js: stockfishSingleJsUrl,
    wasm: stockfishSingleWasmUrl,
  },
  {
    id: "stockfish18-lite",
    name: "Stockfish 18 Lite",
    shortName: "SF 18 Lite",
    description: "Carga rápida, muy fuerte",
    estimatedElo: "3000+",
    js: stockfishLiteSingleJsUrl,
    wasm: stockfishLiteSingleWasmUrl,
  },
  {
    id: "stockfish18-master",
    name: "Stockfish Maestro",
    shortName: "SF Maestro",
    description: "Full limitado para nivel maestro",
    estimatedElo: "~2600",
    js: stockfishSingleJsUrl,
    wasm: stockfishSingleWasmUrl,
    forceLimitStrength: true,
    forceUciElo: 2600,
  },
  {
    id: "stockfish18-club",
    name: "Stockfish Club",
    shortName: "SF Club",
    description: "Rival fuerte pero humano",
    estimatedElo: "~2100",
    js: stockfishSingleJsUrl,
    wasm: stockfishSingleWasmUrl,
    forceLimitStrength: true,
    forceUciElo: 2100,
  },
  {
    id: "stockfish18-asm",
    name: "Stockfish ASM",
    shortName: "SF ASM",
    description: "Compatibilidad máxima, más lento",
    estimatedElo: "variable",
    js: stockfishAsmJsUrl,
    wasm: null,
  },
];

export function resolveEngineProfile(profileId) {
  return ENGINE_PROFILES.find((profile) => profile.id === profileId) || ENGINE_PROFILES[0];
}

export class StockfishEngine extends EventTarget {
  constructor() {
    super();
    this.worker = null;
    this.ready = false;
    this.pendingReady = null;
    this.currentMode = null;
    this.lastInfo = null;
    this.analysisLines = new Map();
    this.stopping = false;
    this.pendingStop = null;
    this.currentFen = null;
    this.pendingEvaluation = null;
    this.profile = resolveEngineProfile();
  }

  init(profileId = this.profile.id) {
    if (this.ready) return Promise.resolve();
    if (this.pendingReady) return this.pendingReady;

    this.profile = resolveEngineProfile(profileId);
    this.pendingReady = new Promise((resolve, reject) => {
      const scriptUrl = new URL(this.profile.js, import.meta.url).href;
      const wasmUrl = this.profile.wasm ? new URL(this.profile.wasm, import.meta.url).href : "";
      this.worker = new Worker(this.profile.wasm ? `${scriptUrl}#${encodeURIComponent(wasmUrl)}` : scriptUrl);

      const failTimer = window.setTimeout(() => {
        reject(new Error("Stockfish no respondió a tiempo."));
      }, 15000);

      this.worker.addEventListener("message", (event) => {
        this.handleLine(String(event.data), resolve, failTimer);
      });

      this.worker.addEventListener("error", (event) => {
        const error = new Error(event.message || "Error cargando Stockfish.");
        this.emit("error", { error });
        reject(error);
      });

      this.send("uci");
      this.send("isready");
    });

    return this.pendingReady;
  }

  setPosition(fen) {
    this.send(`position fen ${fen}`);
  }

  async bestMove({ fen, movetime = 700, depth = 10 } = {}) {
    await this.stopAndWait();
    this.currentMode = "bestmove";
    this.currentFen = fen;
    this.lastInfo = null;
    this.setPosition(fen);
    this.send("setoption name MultiPV value 1");
    this.send(`go depth ${depth} movetime ${movetime}`);
  }

  configure(options = {}) {
    if (!this.worker) return;
    const limitStrength = this.profile.forceLimitStrength ?? options.limitStrength;
    const uciElo = this.profile.forceUciElo ?? options.uciElo ?? 1800;
    this.send(`setoption name Skill Level value ${options.skillLevel ?? 20}`);
    this.send(`setoption name Hash value ${options.hashMb ?? 32}`);
    this.send(`setoption name UCI_LimitStrength value ${limitStrength ? "true" : "false"}`);
    if (limitStrength) {
      this.send(`setoption name UCI_Elo value ${uciElo}`);
    }
  }

  async useProfile(profileId) {
    const nextProfile = resolveEngineProfile(profileId);
    if (this.profile.id === nextProfile.id && this.ready) return;
    this.quit();
    this.profile = nextProfile;
    await this.init(nextProfile.id);
  }

  async analyze({ fen, depth = 12, multiPv = 3, infinite = true } = {}) {
    await this.stopAndWait();
    this.currentMode = "analysis";
    this.currentFen = fen;
    this.lastInfo = null;
    this.analysisLines.clear();
    this.setPosition(fen);
    this.send(`setoption name MultiPV value ${multiPv}`);
    this.send(infinite ? "go infinite" : `go depth ${depth}`);
  }

  async evaluate({ fen, depth = 10 } = {}) {
    await this.stopAndWait();
    this.currentMode = "evaluate";
    this.currentFen = fen;
    this.lastInfo = null;
    this.analysisLines.clear();
    this.setPosition(fen);
    this.send("setoption name MultiPV value 1");

    return new Promise((resolve) => {
      this.pendingEvaluation = resolve;
      this.send(`go depth ${depth}`);
    });
  }

  stop() {
    if (this.worker) this.send("stop");
  }

  stopAndWait() {
    if (!this.worker || !this.currentMode) return Promise.resolve();
    if (this.pendingStop) return this.pendingStop;

    this.stopping = true;
    this.pendingStop = new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        this.stopping = false;
        this.currentMode = null;
        this.pendingStop = null;
        resolve();
      }, 1000);

      this.pendingStopResolver = () => {
        window.clearTimeout(timeout);
        this.stopping = false;
        this.currentMode = null;
        this.pendingStop = null;
        resolve();
      };

      this.send("stop");
    });

    return this.pendingStop;
  }

  quit() {
    if (!this.worker) return;
    this.send("quit");
    this.worker.terminate();
    this.worker = null;
    this.ready = false;
    this.pendingReady = null;
  }

  send(command) {
    if (this.worker) this.worker.postMessage(command);
  }

  handleLine(line, resolveReady, failTimer) {
    if (!line) return;

    if (line === "uciok" || line === "readyok") {
      if (!this.ready && line === "readyok") {
        this.ready = true;
        window.clearTimeout(failTimer);
        this.emit("ready", {});
        resolveReady();
      }
      return;
    }

    if (line.startsWith("info ")) {
      if (this.stopping) return;
      const info = parseInfoLine(line);
      if (info.score || info.pv) this.lastInfo = info;
      if (this.currentMode === "analysis" && (info.score || info.pv)) {
        this.analysisLines.set(info.multipv || 1, info);
      }
      this.emit("info", {
        info,
        mode: this.currentMode,
        fen: this.currentFen,
        lines: [...this.analysisLines.entries()]
          .sort(([left], [right]) => left - right)
          .map(([, value]) => value),
      });
      return;
    }

    if (line.startsWith("bestmove")) {
      if (this.stopping) {
        this.pendingStopResolver?.();
        this.pendingStopResolver = null;
        return;
      }
      const best = parseBestMove(line);
      if (this.currentMode === "evaluate" && this.pendingEvaluation) {
        this.pendingEvaluation({
          ...best,
          info: this.lastInfo,
          fen: this.currentFen,
        });
        this.pendingEvaluation = null;
      }
      this.emit("bestmove", {
        ...best,
        info: this.lastInfo,
        mode: this.currentMode,
        fen: this.currentFen,
        lines: [...this.analysisLines.entries()]
          .sort(([left], [right]) => left - right)
          .map(([, value]) => value),
      });
      this.currentMode = null;
      return;
    }

    this.emit("line", { line });
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
