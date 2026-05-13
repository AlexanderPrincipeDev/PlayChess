import "./styles.css";
import { Chess } from "chess.js";
import { classifyLoss, classificationNag, scoreToCp } from "./analysis/moveClassifier.js";
import { GameState } from "./chess/gameState.js";
import { parseSpanishMove } from "./chess/spanishMoveParser.js";
import { ENGINE_PROFILES, resolveEngineProfile, StockfishEngine } from "./engine/stockfishEngine.js";
import { detectOpening } from "./openings/openingBook.js";
import {
  loadRepertoireLines,
  loadSavedGames,
  loadSettings,
  saveGameRecord,
  saveRepertoireLine,
  saveSettings,
} from "./storage/appStorage.js";
import { ChessBoard } from "./ui/board.js";
import { renderAnalysis } from "./ui/analysisPanel.js";
import { renderMoveList } from "./ui/moveList.js";

const app = document.querySelector("#app");

app.innerHTML = `
  <div class="app-frame">
    <header class="site-header">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">♘</span>
        <h1>Play Chess Stockfish</h1>
      </div>
      <nav class="site-nav" aria-label="Secciones">
        <span>Jugar</span>
        <span>Analizar</span>
        <span>Partidas</span>
        <span>Herramientas</span>
      </nav>
      <div class="engine-state" id="engineState">Motor iniciando</div>
    </header>

    <main class="shell">
      <aside class="left-panel" aria-label="Contexto de partida">
        <section class="player-card">
          <div class="player-row">
              <span class="player-dot black"></span>
              <div>
              <strong id="engineProfileName">Stockfish 18 Full</strong>
              <span id="engineProfileDescription">Motor WASM full</span>
              </div>
          </div>
          <div class="player-row">
            <span class="player-dot white"></span>
            <div>
              <strong>Jugador</strong>
              <span>Sesión local</span>
            </div>
          </div>
          <p id="statusText">Cargando...</p>
        </section>

        <section class="panel-group compact-card">
          <h2>Modo actual</h2>
          <div class="mode-tabs" role="tablist" aria-label="Modo">
            <button class="mode-tab active" data-mode="play" type="button">
              <strong>Jugar</strong>
              <span>Partida vs motor</span>
            </button>
            <button class="mode-tab" data-mode="analysis" type="button">
              <strong>Analizar</strong>
              <span>Revisar PGN/FEN</span>
            </button>
          </div>
        </section>

        <section class="panel-group compact-card">
          <h2>Controles</h2>
          <div class="toolbar" aria-label="Controles principales">
            <button id="newGameBtn" type="button">Nueva</button>
            <button id="undoBtn" type="button">Deshacer</button>
            <button id="flipBtn" type="button">Girar</button>
            <button id="analyzeBtn" type="button">Analizar</button>
            <button id="stopBtn" type="button">Detener</button>
            <button id="shareGameBtn" type="button">Compartir</button>
          </div>
          <details class="tool-drawer">
            <summary>Herramientas</summary>
            <div class="toolbar" aria-label="Herramientas avanzadas">
            <button id="analyzeGameBtn" type="button">Analizar partida</button>
            <button id="exportPgnBtn" type="button">Exportar PGN</button>
            <button id="saveGameBtn" type="button">Guardar partida</button>
            <button id="saveRepertoireBtn" type="button">Guardar repertorio</button>
            </div>
          </details>
        </section>

        <section class="panel-group compact-card voice-card">
          <h2>Voz</h2>
          <button id="voiceMoveBtn" class="voice-button" type="button">Escuchar jugada</button>
          <p id="voiceStatus" class="voice-status">Di jugadas como “caballo f3”, “peón e4” o “enroque corto”.</p>
        </section>

        <details class="panel-group compact-card tool-drawer">
          <summary>Biblioteca</summary>
          <div id="savedGamesList" class="library-list"></div>
        </details>

        <details class="panel-group compact-card tool-drawer">
          <summary>Repertorio</summary>
          <div id="repertoireList" class="library-list"></div>
        </details>

      </aside>

      <section class="board-section" aria-label="Tablero de ajedrez">
        <div id="topClockSlot" class="board-clock-slot"></div>
        <div id="board" class="board" aria-label="Tablero"></div>
        <div id="bottomClockSlot" class="board-clock-slot"></div>
        <div class="board-controls" aria-label="Controles del tablero">
          <div class="clock-actions">
            <button id="startClockBtn" type="button">Iniciar reloj</button>
            <button id="pauseClockBtn" type="button">Pausar</button>
            <button id="resetClockBtn" type="button">Reset</button>
          </div>
          <button id="gameSettingsBtn" class="icon-button" type="button" aria-label="Configurar juego">⚙</button>
        </div>
        <div id="clockPool" hidden>
          <div id="blackClockCard" class="player-clock black-clock">
            <div class="clock-player-row">
              <span class="player-dot black"></span>
              <strong id="blackClockName">Stockfish</strong>
              <span id="blackClockMeta" class="clock-rating">SF</span>
            </div>
            <strong id="blackClock" class="clock-time">05:00</strong>
            <div class="clock-progress" aria-hidden="true"><span id="blackClockProgress"></span></div>
          </div>
          <div id="whiteClockCard" class="player-clock white-clock">
            <div class="clock-player-row">
              <span class="player-dot white"></span>
              <strong id="whiteClockName">Jugador</strong>
              <span id="whiteClockMeta" class="clock-rating">Local</span>
            </div>
            <strong id="whiteClock" class="clock-time">05:00</strong>
            <div class="clock-progress" aria-hidden="true"><span id="whiteClockProgress"></span></div>
          </div>
        </div>
      </section>

      <aside class="side-panel" aria-label="Panel de juego y análisis">
        <section class="panel-group analysis-card">
          <div class="panel-heading">
            <h2>Análisis del motor</h2>
            <div class="analysis-actions">
              <span id="engineProfileBadge">SF 18 Full · NNUE</span>
              <button id="engineSettingsBtn" class="icon-button" type="button" aria-label="Configurar motor">⚙</button>
            </div>
          </div>
          <div class="analysis-grid" id="analysisPanel">
            <div class="eval-box">
              <span>Eval</span>
              <strong data-analysis-score>Sin evaluación</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong data-analysis-depth>En espera</strong>
            </div>
            <div>
              <span class="metric-label">NPS <span class="info-tooltip" tabindex="0" aria-label="Nodos por segundo: velocidad a la que el motor analiza posiciones.">i</span></span>
              <strong data-analysis-nps>N/A</strong>
            </div>
            <div>
              <span>Mejor</span>
              <strong data-analysis-best>N/A</strong>
            </div>
            <ol class="analysis-lines" data-analysis-lines></ol>
          </div>
        </section>

        <section class="panel-group context-card">
          <div>
            <h2>Apertura</h2>
            <div id="openingInfo" class="opening-info">Apertura no identificada</div>
          </div>
          <div>
            <h2>Finales</h2>
            <div id="endgameInfo" class="opening-info">No es final técnico todavía</div>
          </div>
        </section>

        <section class="panel-group move-card">
          <h2>Jugadas</h2>
          <div id="moveList" class="move-list"></div>
        </section>

        <details class="panel-group annotation-card tool-drawer">
          <summary>Anotación</summary>
          <select id="nagSelect">
            <option value="">Sin símbolo</option>
            <option value="!">!</option>
            <option value="?">?</option>
            <option value="!!">!!</option>
            <option value="??">??</option>
            <option value="!?">!?</option>
            <option value="?!">?!</option>
          </select>
          <textarea id="moveComment" rows="3" placeholder="Comentario de entrenador para la jugada activa"></textarea>
          <button id="saveAnnotationBtn" type="button">Guardar anotación</button>
        </details>

        <details class="panel-group io-card tool-drawer">
          <summary>FEN</summary>
          <textarea id="fenInput" spellcheck="false" rows="3"></textarea>
          <button id="loadFenBtn" type="button">Cargar FEN</button>
        </details>

        <details class="panel-group io-card tool-drawer">
          <summary>PGN</summary>
          <label class="file-picker">
            Archivo PGN
            <input id="pgnFileInput" type="file" accept=".pgn,.txt,application/x-chess-pgn,text/plain" />
          </label>
          <textarea id="pgnInput" spellcheck="false" rows="5" placeholder="Pega una partida PGN"></textarea>
          <div class="pgn-controls">
            <button id="loadPgnBtn" type="button">Cargar PGN</button>
            <button id="pgnStartBtn" type="button">Inicio</button>
            <button id="pgnPrevBtn" type="button">Atrás</button>
            <button id="pgnNextBtn" type="button">Siguiente</button>
            <button id="pgnEndBtn" type="button">Final</button>
          </div>
        </details>
      </aside>
    </main>

    <div id="engineSettingsModal" class="modal-backdrop" hidden>
      <section class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="engineSettingsTitle">
        <header class="modal-header">
          <div>
            <h2 id="engineSettingsTitle">Configuración del motor</h2>
            <p>Ajusta fuerza, tiempo de respuesta y análisis en vivo.</p>
          </div>
          <button id="closeEngineSettingsBtn" class="icon-button" type="button" aria-label="Cerrar configuración">×</button>
        </header>
        <div class="modal-grid">
          <label class="modal-wide">
            Motor
            <select id="engineProfile">
              ${ENGINE_PROFILES.map((profile) => `
                <option value="${profile.id}">${profile.name} · ${profile.estimatedElo}</option>
              `).join("")}
            </select>
            <span id="engineProfileHelp" class="field-hint"></span>
          </label>
          <label>
            Profundidad de juego
            <input id="engineDepth" type="number" min="1" max="20" />
          </label>
          <label>
            Tiempo por jugada
            <input id="engineMoveTime" type="number" min="100" max="5000" step="100" />
          </label>
          <label>
            Profundidad inicial de análisis
            <input id="analysisDepth" type="number" min="1" max="24" />
          </label>
          <label>
            Líneas de análisis
            <input id="analysisLines" type="number" min="1" max="5" />
          </label>
          <label>
            Skill Level
            <input id="skillLevel" type="number" min="0" max="20" />
          </label>
          <label>
            Limitar fuerza
            <select id="limitStrength">
              <option value="false">No</option>
              <option value="true">Sí</option>
            </select>
          </label>
          <label>
            UCI Elo
            <input id="uciElo" type="number" min="1320" max="3190" step="10" />
          </label>
          <label>
            Hash MB
            <input id="hashMb" type="number" min="16" max="256" step="16" />
          </label>
          <label>
            Reloj minutos
            <input id="clockMinutes" type="number" min="1" max="180" />
          </label>
          <label>
            Incremento segundos
            <input id="incrementSeconds" type="number" min="0" max="60" />
          </label>
        </div>
        <footer class="modal-footer">
          <button id="saveEngineSettingsBtn" class="primary-button" type="button">Guardar</button>
        </footer>
      </section>
    </div>

    <div id="gameSettingsModal" class="modal-backdrop" hidden>
      <section class="settings-modal compact-settings-modal" role="dialog" aria-modal="true" aria-labelledby="gameSettingsTitle">
        <header class="modal-header">
          <div>
            <h2 id="gameSettingsTitle">Configuración del juego</h2>
            <p>Ajusta color, tablero y coordenadas.</p>
          </div>
          <button id="closeGameSettingsBtn" class="icon-button" type="button" aria-label="Cerrar configuración de juego">×</button>
        </header>
        <div class="modal-grid">
          <label>
            Color
            <select id="playerColor">
              <option value="white">Blancas</option>
              <option value="black">Negras</option>
            </select>
          </label>
          <label>
            Tema tablero
            <select id="boardTheme">
              <option value="classic">Clásico</option>
              <option value="green">Verde</option>
              <option value="blue">Azul</option>
              <option value="gray">Gris</option>
            </select>
          </label>
          <label class="modal-wide">
            Coordenadas
            <select id="showCoordinates">
              <option value="true">Mostrar</option>
              <option value="false">Ocultar</option>
            </select>
          </label>
        </div>
        <footer class="modal-footer">
          <button id="saveGameSettingsBtn" class="primary-button" type="button">Guardar</button>
        </footer>
      </section>
    </div>

    <div id="checkmateModal" class="modal-backdrop" hidden>
      <section class="settings-modal checkmate-modal" role="dialog" aria-modal="true" aria-labelledby="checkmateTitle">
        <header class="modal-header">
          <div>
            <h2 id="checkmateTitle">Jaque mate</h2>
            <p id="checkmateMessage">La partida terminó.</p>
          </div>
        </header>
        <footer class="modal-footer">
          <button id="playAgainBtn" class="primary-button" type="button">Volver a jugar</button>
        </footer>
      </section>
    </div>
  </div>
`;

const settings = loadSettings();
const game = new GameState();
const engine = new StockfishEngine();

const elements = {
  board: document.querySelector("#board"),
  topClockSlot: document.querySelector("#topClockSlot"),
  bottomClockSlot: document.querySelector("#bottomClockSlot"),
  status: document.querySelector("#statusText"),
  engineState: document.querySelector("#engineState"),
  modeTabs: [...document.querySelectorAll("[data-mode]")],
  newGame: document.querySelector("#newGameBtn"),
  undo: document.querySelector("#undoBtn"),
  flip: document.querySelector("#flipBtn"),
  analyze: document.querySelector("#analyzeBtn"),
  stop: document.querySelector("#stopBtn"),
  shareGame: document.querySelector("#shareGameBtn"),
  analyzeGame: document.querySelector("#analyzeGameBtn"),
  exportPgn: document.querySelector("#exportPgnBtn"),
  saveGame: document.querySelector("#saveGameBtn"),
  saveRepertoire: document.querySelector("#saveRepertoireBtn"),
  startClock: document.querySelector("#startClockBtn"),
  pauseClock: document.querySelector("#pauseClockBtn"),
  resetClock: document.querySelector("#resetClockBtn"),
  whiteClock: document.querySelector("#whiteClock"),
  blackClock: document.querySelector("#blackClock"),
  whiteClockCard: document.querySelector("#whiteClockCard"),
  blackClockCard: document.querySelector("#blackClockCard"),
  whiteClockProgress: document.querySelector("#whiteClockProgress"),
  blackClockProgress: document.querySelector("#blackClockProgress"),
  whiteClockName: document.querySelector("#whiteClockName"),
  blackClockName: document.querySelector("#blackClockName"),
  whiteClockMeta: document.querySelector("#whiteClockMeta"),
  blackClockMeta: document.querySelector("#blackClockMeta"),
  engineProfileName: document.querySelector("#engineProfileName"),
  engineProfileDescription: document.querySelector("#engineProfileDescription"),
  engineProfileBadge: document.querySelector("#engineProfileBadge"),
  engineProfile: document.querySelector("#engineProfile"),
  engineProfileHelp: document.querySelector("#engineProfileHelp"),
  engineSettings: document.querySelector("#engineSettingsBtn"),
  engineSettingsModal: document.querySelector("#engineSettingsModal"),
  closeEngineSettings: document.querySelector("#closeEngineSettingsBtn"),
  saveEngineSettings: document.querySelector("#saveEngineSettingsBtn"),
  gameSettings: document.querySelector("#gameSettingsBtn"),
  gameSettingsModal: document.querySelector("#gameSettingsModal"),
  closeGameSettings: document.querySelector("#closeGameSettingsBtn"),
  saveGameSettings: document.querySelector("#saveGameSettingsBtn"),
  voiceMove: document.querySelector("#voiceMoveBtn"),
  voiceStatus: document.querySelector("#voiceStatus"),
  playerColor: document.querySelector("#playerColor"),
  engineDepth: document.querySelector("#engineDepth"),
  engineMoveTime: document.querySelector("#engineMoveTime"),
  analysisDepth: document.querySelector("#analysisDepth"),
  analysisLines: document.querySelector("#analysisLines"),
  skillLevel: document.querySelector("#skillLevel"),
  limitStrength: document.querySelector("#limitStrength"),
  uciElo: document.querySelector("#uciElo"),
  hashMb: document.querySelector("#hashMb"),
  clockMinutes: document.querySelector("#clockMinutes"),
  incrementSeconds: document.querySelector("#incrementSeconds"),
  boardTheme: document.querySelector("#boardTheme"),
  showCoordinates: document.querySelector("#showCoordinates"),
  analysisPanel: document.querySelector("#analysisPanel"),
  moveList: document.querySelector("#moveList"),
  openingInfo: document.querySelector("#openingInfo"),
  endgameInfo: document.querySelector("#endgameInfo"),
  savedGamesList: document.querySelector("#savedGamesList"),
  repertoireList: document.querySelector("#repertoireList"),
  nagSelect: document.querySelector("#nagSelect"),
  moveComment: document.querySelector("#moveComment"),
  saveAnnotation: document.querySelector("#saveAnnotationBtn"),
  fenInput: document.querySelector("#fenInput"),
  pgnInput: document.querySelector("#pgnInput"),
  pgnFileInput: document.querySelector("#pgnFileInput"),
  loadFen: document.querySelector("#loadFenBtn"),
  loadPgn: document.querySelector("#loadPgnBtn"),
  pgnStart: document.querySelector("#pgnStartBtn"),
  pgnPrev: document.querySelector("#pgnPrevBtn"),
  pgnNext: document.querySelector("#pgnNextBtn"),
  pgnEnd: document.querySelector("#pgnEndBtn"),
  checkmateModal: document.querySelector("#checkmateModal"),
  checkmateMessage: document.querySelector("#checkmateMessage"),
  playAgain: document.querySelector("#playAgainBtn"),
};

const state = {
  mode: settings.mode,
  orientation: settings.orientation,
  playerColor: settings.playerColor,
  engineProfile: settings.engineProfile,
  selected: null,
  legalTargets: [],
  lastMove: null,
  engineThinking: false,
  engineMovePending: false,
  checkmateFenShown: null,
  analysisLines: [],
  analysisBestMove: null,
  analysisFen: null,
  analysisStoppedByUser: false,
  speechRecognition: null,
  speechListening: false,
  speechEnabled: false,
  speechRestartTimer: null,
  speechPausedForOutput: false,
  speechLastTranscriptAt: 0,
  audioContext: null,
  analyzingGame: false,
  boardMarks: new Set(),
  clock: {
    whiteMs: settings.clockMinutes * 60_000,
    blackMs: settings.clockMinutes * 60_000,
    initialMs: settings.clockMinutes * 60_000,
    running: false,
    started: false,
    timerId: null,
    lastTick: null,
  },
};

const board = new ChessBoard(elements.board, {
  onSquareSelect: handleSquareSelect,
  onMove: handleMoveAttempt,
  onMarkSquare: toggleBoardMark,
});

boot();

function boot() {
  elements.playerColor.value = state.playerColor;
  elements.engineProfile.value = state.engineProfile;
  elements.engineDepth.value = settings.engineDepth;
  elements.engineMoveTime.value = settings.engineMoveTime;
  elements.analysisDepth.value = settings.analysisDepth;
  elements.analysisLines.value = settings.analysisLines;
  elements.skillLevel.value = settings.skillLevel;
  elements.limitStrength.value = String(settings.limitStrength);
  elements.uciElo.value = settings.uciElo;
  elements.hashMb.value = settings.hashMb;
  elements.clockMinutes.value = settings.clockMinutes;
  elements.incrementSeconds.value = settings.incrementSeconds;
  elements.boardTheme.value = settings.boardTheme;
  elements.showCoordinates.value = String(settings.showCoordinates);
  elements.pgnInput.value = settings.pgn || "";
  document.body.dataset.boardTheme = settings.boardTheme;
  if (!settings.fen && !settings.pgn) state.orientation = state.playerColor;
  renderEngineProfile();

  if (settings.fen) {
    try {
      game.loadFen(settings.fen);
    } catch {
      game.reset();
    }
  }

  bindUi();
  bindEngine();
  render();

  engine.init(state.engineProfile).catch((error) => {
    setEngineState("Error del motor");
    showStatus(error.message);
  });

  if (state.playerColor === "black" && state.mode === "play") {
    window.setTimeout(requestEngineMove, 300);
  }
}

function bindUi() {
  elements.modeTabs.forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      state.selected = null;
      state.legalTargets = [];
      engine.stop();
      if (state.mode === "play") {
        state.engineThinking = false;
        state.engineMovePending = false;
        state.analysisStoppedByUser = true;
        state.analysisLines = [];
        state.analysisBestMove = null;
        state.analysisFen = null;
        setEngineState(engine.ready ? "Motor listo" : "Motor cargando");
      }
      persist();
      render();
      if (state.mode === "analysis") restartLiveAnalysis();
      if (state.mode === "play" && !game.isGameOver() && sideToMoveName() !== state.playerColor) {
        requestEngineMove();
      }
    });
  });

  elements.newGame.addEventListener("click", () => {
    engine.stop();
    game.reset();
    state.engineThinking = false;
    state.engineMovePending = false;
    state.analysisStoppedByUser = state.mode === "play";
    state.lastMove = null;
    state.selected = null;
    state.legalTargets = [];
    state.analysisLines = [];
    state.analysisBestMove = null;
    state.analysisFen = null;
    state.checkmateFenShown = null;
    resetClock();
    persist();
    render();
    if (state.mode === "play" && state.playerColor === "black") requestEngineMove();
  });

  elements.undo.addEventListener("click", () => {
    engine.stop();
    state.engineThinking = false;
    state.engineMovePending = false;
    if (game.undoPair()) {
      state.lastMove = null;
      state.analysisLines = [];
      state.analysisBestMove = null;
      state.analysisFen = null;
      persist();
      render();
      if (state.mode === "analysis") restartLiveAnalysis();
    }
  });

  elements.flip.addEventListener("click", () => {
    state.orientation = state.orientation === "white" ? "black" : "white";
    persist();
    render();
  });

  elements.analyze.addEventListener("click", requestAnalysis);
  elements.shareGame.addEventListener("click", shareGame);
  elements.analyzeGame.addEventListener("click", analyzeFullGame);
  elements.exportPgn.addEventListener("click", exportPgn);
  elements.saveGame.addEventListener("click", saveCurrentGame);
  elements.saveRepertoire.addEventListener("click", saveCurrentRepertoire);
  elements.startClock.addEventListener("click", startClock);
  elements.pauseClock.addEventListener("click", pauseClock);
  elements.resetClock.addEventListener("click", resetClock);
  elements.engineSettings.addEventListener("click", openEngineSettings);
  elements.closeEngineSettings.addEventListener("click", closeEngineSettings);
  elements.saveEngineSettings.addEventListener("click", saveEngineSettings);
  elements.engineProfile.addEventListener("change", renderEngineProfilePreview);
  elements.engineSettingsModal.addEventListener("click", (event) => {
    if (event.target === elements.engineSettingsModal) closeEngineSettings();
  });
  elements.gameSettings.addEventListener("click", openGameSettings);
  elements.closeGameSettings.addEventListener("click", closeGameSettings);
  elements.saveGameSettings.addEventListener("click", saveGameSettings);
  elements.gameSettingsModal.addEventListener("click", (event) => {
    if (event.target === elements.gameSettingsModal) closeGameSettings();
  });
  elements.stop.addEventListener("click", () => {
    engine.stop();
    state.engineThinking = false;
    state.engineMovePending = false;
    state.analysisStoppedByUser = true;
    setEngineState("Motor detenido");
    renderAnalysisPanel();
  });

  elements.saveAnnotation.addEventListener("click", saveActiveAnnotation);

  [
    elements.engineDepth,
    elements.engineMoveTime,
    elements.analysisDepth,
    elements.analysisLines,
    elements.skillLevel,
    elements.limitStrength,
    elements.uciElo,
    elements.hashMb,
    elements.clockMinutes,
    elements.incrementSeconds,
  ].forEach((input) => {
    input.addEventListener("change", () => {
      persist();
      if ([elements.skillLevel, elements.limitStrength, elements.uciElo, elements.hashMb].includes(input)) {
        configureEngine();
      }
      if (input === elements.clockMinutes && !state.clock.started) {
        resetClock();
      }
      if (
        state.mode === "analysis" &&
        (input === elements.analysisDepth || input === elements.analysisLines)
      ) {
        restartLiveAnalysis();
      }
    });
  });

  elements.loadFen.addEventListener("click", () => {
    try {
      engine.stop();
      game.loadFen(elements.fenInput.value.trim());
      state.mode = "analysis";
      state.lastMove = null;
      state.selected = null;
      state.legalTargets = [];
      state.analysisLines = [];
      state.analysisBestMove = null;
      state.analysisFen = null;
      persist();
      render();
      restartLiveAnalysis();
    } catch (error) {
      showStatus(error.message || "FEN inválido.");
    }
  });

  elements.loadPgn.addEventListener("click", () => {
    loadPgnText(elements.pgnInput.value.trim());
  });

  elements.pgnFileInput.addEventListener("change", async () => {
    const file = elements.pgnFileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      elements.pgnInput.value = text;
      loadPgnText(text);
    } catch {
      showStatus("No se pudo leer el archivo PGN.");
    } finally {
      elements.pgnFileInput.value = "";
    }
  });

  elements.pgnStart.addEventListener("click", () => navigatePgn("start"));
  elements.pgnPrev.addEventListener("click", () => navigatePgn("prev"));
  elements.pgnNext.addEventListener("click", () => navigatePgn("next"));
  elements.pgnEnd.addEventListener("click", () => navigatePgn("end"));
  elements.playAgain.addEventListener("click", () => {
    closeCheckmateModal();
    elements.newGame.click();
  });
  setupVoiceInput();

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.engineSettingsModal.hidden) {
      closeEngineSettings();
      return;
    }
    if (event.key === "Escape" && !elements.gameSettingsModal.hidden) {
      closeGameSettings();
      return;
    }

    if (state.mode !== "analysis") return;
    if (isTextInput(event.target)) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      navigatePgn("prev");
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      navigatePgn("next");
    }

  });
}

function bindEngine() {
  engine.addEventListener("ready", () => {
    configureEngine();
    setEngineState("Motor listo");
    if (state.mode === "analysis") restartLiveAnalysis();
    if (shouldEngineMove()) {
      window.setTimeout(requestEngineMove, 0);
    }
  });

  engine.addEventListener("info", (event) => {
    if (event.detail.mode !== "analysis") return;
    if (event.detail.fen !== game.fen()) return;
    state.analysisLines = event.detail.lines;
    state.analysisFen = game.fen();
    setEngineState("Análisis en vivo");
    renderAnalysisPanel();
  });

  engine.addEventListener("bestmove", (event) => {
    const { move, info, mode } = event.detail;
    if (mode === "analysis" && event.detail.fen !== game.fen()) return;
    state.engineThinking = false;
    if (mode === "bestmove") state.engineMovePending = false;
    if (info && mode === "analysis") state.analysisLines = event.detail.lines || [info];
    state.analysisBestMove = move;

    if (mode === "bestmove" && state.mode === "play" && move) {
      const made = game.moveUci(move);
      if (made) {
        state.lastMove = made;
        applyClockIncrement(made.color);
        updateClockAfterMove();
      }
      setEngineState("Motor listo");
      if (state.speechEnabled) {
        elements.voiceStatus.textContent = "Voz activa. Tu turno.";
      }
      persist();
      render();
      if (made) {
        board.animateMove(made);
        playMoveSound(made);
        announceEngineMove(made);
      }
      return;
    }

    if (mode === "analysis" && state.mode === "analysis" && state.analysisStoppedByUser) {
      setEngineState("Análisis pausado");
    } else if (mode !== "analysis") {
      setEngineState("Motor listo");
    }
    renderAnalysisPanel();
  });

  engine.addEventListener("error", (event) => {
    setEngineState("Error del motor");
    showStatus(event.detail.error.message);
  });
}

function handleSquareSelect(square) {
  if (state.mode === "play" && state.engineThinking) return;
  if (game.isGameOver()) return;
  if (state.mode === "play" && sideToMoveName() !== state.playerColor) return;

  const piece = game.pieceAt(square);

  if (!state.selected) {
    if (!piece || piece.color !== game.turn()) return;
    state.selected = square;
    state.legalTargets = game.legalTargets(square);
    renderBoard();
    return;
  }

  if (state.selected === square) {
    state.selected = null;
    state.legalTargets = [];
    renderBoard();
    return;
  }

  const move = handleMoveAttempt(state.selected, square);
  if (!move) {
    if (piece && piece.color === game.turn()) {
      state.selected = square;
      state.legalTargets = game.legalTargets(square);
    } else {
      state.selected = null;
      state.legalTargets = [];
    }
    renderBoard();
    return;
  }

}

function handleMoveAttempt(from, to, promotion = "q") {
  if (state.mode === "play" && state.engineThinking) return null;
  if (game.isGameOver()) return null;
  if (state.mode === "play" && sideToMoveName() !== state.playerColor) return null;

  const move = game.move(from, to, promotion);
  if (!move) return null;

  applyClockIncrement(move.color);
  updateClockAfterMove();
  state.lastMove = move;
  state.selected = null;
  state.legalTargets = [];
  state.analysisLines = [];
  state.analysisBestMove = null;
  state.analysisFen = null;
  persist();
  render();
  playMoveSound(move);

  if (state.mode === "play" && !game.isGameOver()) {
    requestEngineMove();
  } else if (state.mode === "analysis") {
    restartLiveAnalysis();
  }

  return move;
}

function requestEngineMove() {
  if (!shouldEngineMove()) {
    state.engineMovePending = false;
    return;
  }
  if (!engine.ready) {
    state.engineMovePending = true;
    setEngineState("Motor cargando");
    return;
  }

  configureEngine();
  state.engineMovePending = false;
  state.engineThinking = true;
  setEngineState("Motor pensando");
  engine.bestMove({
    fen: game.fen(),
    depth: Number(elements.engineDepth.value),
    movetime: Number(elements.engineMoveTime.value),
  });
}

function shouldEngineMove() {
  return state.mode === "play" && !game.isGameOver() && sideToMoveName() !== state.playerColor;
}

function requestAnalysis() {
  if (!engine.ready) {
    showStatus("El motor todavía está cargando.");
    return;
  }

  state.mode = "analysis";
  restartLiveAnalysis();
}

function loadPgnText(pgn) {
  try {
    engine.stop();
    game.loadPgn(pgn);
    state.mode = "analysis";
    state.lastMove = null;
    state.selected = null;
    state.legalTargets = [];
    state.analysisLines = [];
    state.analysisBestMove = null;
    state.analysisFen = null;
    state.checkmateFenShown = null;
    persist();
    render();
    restartLiveAnalysis();
  } catch (error) {
    showStatus(error.message || "PGN inválido.");
  }
}

function restartLiveAnalysis() {
  if (!engine.ready) {
    state.mode = "analysis";
    setEngineState("Motor cargando");
    persist();
    render();
    return;
  }

  engine.stop();
  configureEngine();
  state.engineThinking = true;
  state.analysisStoppedByUser = false;
  state.analysisLines = [];
  state.analysisBestMove = null;
  state.analysisFen = game.fen();
  setEngineState("Análisis en vivo");
  persist();
  render();

  engine.analyze({
    fen: game.fen(),
    depth: Number(elements.analysisDepth.value),
    multiPv: Number(elements.analysisLines.value),
    infinite: true,
  });
}

function navigatePgn(direction) {
  engine.stop();
  if (direction === "start") game.goToStart();
  if (direction === "prev") game.goToPreviousPly();
  if (direction === "next") game.goToNextPly();
  if (direction === "end") game.goToEnd();
  state.lastMove = game.history().at(-1) || null;
  state.analysisLines = [];
  state.analysisBestMove = null;
  state.analysisFen = null;
  persist();
  render();
  restartLiveAnalysis();
}

function navigateToPly(ply) {
  engine.stop();
  game.goToPly(ply);
  state.mode = "analysis";
  state.engineThinking = false;
  state.engineMovePending = false;
  state.analysisLines = [];
  state.analysisBestMove = null;
  state.analysisFen = null;
  state.lastMove = game.history().at(-1) || null;
  persist();
  render();
  restartLiveAnalysis();
}

function render() {
  elements.modeTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
  elements.fenInput.value = game.fen();
  elements.status.textContent = game.status();
  renderOpening();
  renderEndgame();
  renderActiveAnnotation();
  renderClock();
  renderLibrary();
  renderBoard();
  renderMoveList(elements.moveList, game.lineHistory(), {
    activePly: game.activePly(),
    annotations: game.annotationsObject(),
    onSelectPly: navigateToPly,
  });
  renderAnalysisPanel();
  renderCheckmateModal();
  persist();
}

function renderBoard() {
  board.setState({
    game,
    orientation: state.orientation,
    selected: state.selected,
    legalTargets: state.legalTargets,
    lastMove: state.lastMove,
    showCoordinates: elements.showCoordinates.value === "true",
    marks: state.boardMarks,
  });
}

function renderAnalysisPanel() {
  renderAnalysis(elements.analysisPanel, {
    lines: state.analysisLines,
    bestMove: state.analysisBestMove,
    turn: game.turn(),
    thinking: state.engineThinking,
    fen: state.analysisFen || game.fen(),
  });
}

function renderCheckmateModal() {
  if (!game.isCheckmate()) return;
  const fen = game.fen();
  if (state.checkmateFenShown === fen) return;
  state.checkmateFenShown = fen;
  elements.checkmateMessage.textContent = game.status();
  elements.checkmateModal.hidden = false;
  pauseClock();
}

function closeCheckmateModal() {
  elements.checkmateModal.hidden = true;
}

function persist() {
  saveSettings({
    mode: state.mode,
    orientation: state.orientation,
    playerColor: state.playerColor,
    engineProfile: elements.engineProfile.value || state.engineProfile,
    engineDepth: Number(elements.engineDepth.value || settings.engineDepth),
    engineMoveTime: Number(elements.engineMoveTime.value || settings.engineMoveTime),
    analysisDepth: Number(elements.analysisDepth.value || settings.analysisDepth),
    analysisLines: Number(elements.analysisLines.value || settings.analysisLines),
    skillLevel: Number(elements.skillLevel.value || settings.skillLevel),
    limitStrength: elements.limitStrength.value === "true",
    uciElo: Number(elements.uciElo.value || settings.uciElo),
    hashMb: Number(elements.hashMb.value || settings.hashMb),
    clockMinutes: Number(elements.clockMinutes.value || settings.clockMinutes),
    incrementSeconds: Number(elements.incrementSeconds.value || settings.incrementSeconds),
    boardTheme: elements.boardTheme.value,
    showCoordinates: elements.showCoordinates.value === "true",
    fen: game.fen(),
    pgn: elements.pgnInput.value,
  });
}

function setEngineState(text) {
  elements.engineState.textContent = text;
}

function showStatus(text) {
  elements.status.textContent = text;
}

function sideToMoveName() {
  return game.turn() === "w" ? "white" : "black";
}

function toggleBoardMark(square) {
  if (state.boardMarks.has(square)) state.boardMarks.delete(square);
  else state.boardMarks.add(square);
  renderBoard();
}

function openEngineSettings() {
  elements.engineSettingsModal.hidden = false;
  renderEngineProfilePreview();
  elements.engineProfile.focus();
}

function closeEngineSettings() {
  elements.engineSettingsModal.hidden = true;
  elements.engineSettings.focus();
}

function openGameSettings() {
  elements.playerColor.value = state.playerColor;
  elements.boardTheme.value = document.body.dataset.boardTheme || settings.boardTheme;
  elements.showCoordinates.value = String(elements.showCoordinates.value === "true");
  elements.gameSettingsModal.hidden = false;
  elements.playerColor.focus();
}

function closeGameSettings() {
  elements.gameSettingsModal.hidden = true;
  elements.gameSettings.focus();
}

function saveGameSettings() {
  state.playerColor = elements.playerColor.value;
  state.orientation = state.playerColor;
  document.body.dataset.boardTheme = elements.boardTheme.value;
  persist();
  render();
  closeGameSettings();
  if (state.mode === "play" && state.playerColor === sideToMoveName()) requestEngineMove();
}

async function saveEngineSettings() {
  const previousProfile = state.engineProfile;
  state.engineProfile = elements.engineProfile.value;
  persist();
  if (previousProfile !== state.engineProfile) {
    await switchEngineProfile(state.engineProfile);
  } else {
    configureEngine();
  }
  closeEngineSettings();
  if (state.mode === "analysis") restartLiveAnalysis();
  else setEngineState(engine.ready ? "Motor listo" : "Motor cargando");
}

async function switchEngineProfile(profileId) {
  engine.stop();
  state.engineThinking = false;
  state.analysisLines = [];
  state.analysisBestMove = null;
  state.analysisFen = null;
  renderEngineProfile();
  setEngineState("Cambiando motor");

  try {
    await engine.useProfile(profileId);
    configureEngine();
    setEngineState("Motor listo");
  } catch (error) {
    setEngineState("Error del motor");
    showStatus(error.message || "No se pudo cargar el motor.");
  }
}

function configureEngine() {
  engine.configure({
    skillLevel: Number(elements.skillLevel.value),
    limitStrength: elements.limitStrength.value === "true",
    uciElo: Number(elements.uciElo.value),
    hashMb: Number(elements.hashMb.value),
    threads: preferredEngineThreads(),
  });
}

function renderEngineProfile() {
  const profile = resolveEngineProfile(state.engineProfile);
  elements.engineProfile.value = profile.id;
  elements.engineProfileName.textContent = profile.name;
  elements.engineProfileDescription.textContent = `${profile.description} · ${profile.estimatedElo}`;
  elements.engineProfileBadge.textContent = `${profile.shortName} · ${profile.estimatedElo}`;
  renderEngineProfilePreview();
}

function renderEngineProfilePreview() {
  const profile = resolveEngineProfile(elements.engineProfile.value || state.engineProfile);
  elements.engineProfileHelp.textContent = `${profile.description}. Elo estimado: ${profile.estimatedElo}.`;
}

function preferredEngineThreads() {
  const cores = navigator.hardwareConcurrency || 4;
  return Math.max(1, Math.min(8, cores - 1 || 1));
}

async function analyzeFullGame() {
  if (!engine.ready || state.analyzingGame || !game.lineHistory().length) return;

  state.analyzingGame = true;
  state.mode = "analysis";
  setEngineState("Analizando partida");
  engine.stop();
  configureEngine();

  const originalPly = game.activePly();
  const chess = new Chess();
  const depth = Math.min(Number(elements.analysisDepth.value) || 10, 12);

  for (let index = 0; index < game.lineHistory().length; index += 1) {
    const move = game.lineHistory()[index];
    const ply = index + 1;
    const fenBefore = chess.fen();
    const turnBefore = chess.turn();
    const before = await engine.evaluate({ fen: fenBefore, depth });
    const bestMove = before.move || "";
    const bestCp = scoreToCp(before.info?.score, turnBefore);

    chess.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
    const after = await engine.evaluate({ fen: chess.fen(), depth });
    const afterCpForMover = -scoreToCp(after.info?.score, chess.turn());
    const loss = bestCp == null || afterCpForMover == null ? null : Math.max(0, bestCp - afterCpForMover);
    const classification = classifyLoss(loss);

    game.setAnnotation(ply, {
      eval: formatEngineEval(after.info?.score, chess.turn()),
      bestMove,
      loss,
      classification,
      nag: classificationNag(classification),
    });

    setEngineState(`Analizando ${ply}/${game.lineHistory().length}`);
    renderMoveList(elements.moveList, game.lineHistory(), {
      activePly: ply,
      annotations: game.annotationsObject(),
      onSelectPly: navigateToPly,
    });
  }

  game.goToPly(originalPly);
  state.analyzingGame = false;
  setEngineState("Análisis completo");
  persist();
  render();
  restartLiveAnalysis();
}

function formatEngineEval(score, turn) {
  const cp = scoreToCp(score, turn);
  if (cp == null) return "";
  if (Math.abs(cp) >= 10000) return cp > 0 ? "#+" : "#-";
  const pawns = cp / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

function saveActiveAnnotation() {
  const ply = game.activePly();
  if (!ply) return;
  game.setAnnotation(ply, {
    nag: elements.nagSelect.value,
    comment: elements.moveComment.value.trim(),
  });
  persist();
  render();
}

function renderActiveAnnotation() {
  const annotation = game.getAnnotation(game.activePly());
  elements.nagSelect.value = annotation.nag || "";
  elements.moveComment.value = annotation.comment || "";
}

function renderOpening() {
  const opening = detectOpening(game.lineHistory());
  elements.openingInfo.textContent = `${opening.eco} · ${opening.name}`;
}

function renderEndgame() {
  const material = game.materialSummary();
  if (material.pieceCount <= 7) {
    elements.endgameInfo.textContent = `Final técnico: ${material.pieceCount} piezas. Practica conversión contra Stockfish.`;
  } else if (!material.hasQueens && material.pieceCount <= 12) {
    elements.endgameInfo.textContent = `Final probable sin damas: ${material.pieceCount} piezas.`;
  } else {
    elements.endgameInfo.textContent = "No es final técnico todavía.";
  }
}

function exportPgn() {
  const blob = new Blob([game.linePgn()], { type: "application/x-chess-pgn;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `partida-${Date.now()}.pgn`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function saveCurrentGame() {
  saveGameRecord({
    id: crypto.randomUUID(),
    pgn: game.linePgn(),
    fen: game.fen(),
    annotations: game.annotationsObject(),
    opening: detectOpening(game.lineHistory()),
    createdAt: new Date().toISOString(),
  });
  showStatus("Partida guardada.");
  renderLibrary();
}

function saveCurrentRepertoire() {
  saveRepertoireLine({
    id: crypto.randomUUID(),
    color: state.playerColor,
    name: detectOpening(game.lineHistory()).name,
    moves: game.lineHistory().map((move) => move.san),
    pgn: game.linePgn(),
    createdAt: new Date().toISOString(),
  });
  showStatus("Línea guardada en repertorio.");
  renderLibrary();
}

function renderLibrary() {
  renderLibraryList(elements.savedGamesList, loadSavedGames(), "Sin partidas guardadas");
  renderLibraryList(elements.repertoireList, loadRepertoireLines(), "Sin líneas guardadas");
}

function renderLibraryList(container, items, emptyText) {
  container.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }

  for (const item of items.slice(0, 5)) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "library-item";
    row.textContent = item.opening?.name || item.name || new Date(item.updatedAt).toLocaleDateString();
    row.addEventListener("click", () => {
      if (!item.pgn) return;
      try {
        game.loadPgn(item.pgn);
        game.loadAnnotations(item.annotations);
        state.mode = "analysis";
        persist();
        render();
        restartLiveAnalysis();
      } catch {
        showStatus("No se pudo abrir el registro guardado.");
      }
    });
    container.append(row);
  }
}

function startClock() {
  if (state.clock.running) return;
  if (!game.lineHistory().length) {
    state.clock.started = false;
    showStatus("El reloj arrancará después de la primera jugada.");
    renderClock();
    return;
  }
  state.clock.started = true;
  state.clock.running = true;
  state.clock.lastTick = performance.now();
  state.clock.timerId = window.setInterval(tickClock, 250);
  renderClock();
}

function pauseClock() {
  state.clock.running = false;
  if (state.clock.timerId) window.clearInterval(state.clock.timerId);
  state.clock.timerId = null;
  state.clock.lastTick = null;
  renderClock();
}

function resetClock() {
  pauseClock();
  const base = Number(elements.clockMinutes.value || 5) * 60_000;
  state.clock.initialMs = base;
  state.clock.whiteMs = base;
  state.clock.blackMs = base;
  state.clock.started = false;
  renderClock();
}

function updateClockAfterMove() {
  if (state.mode !== "play") return;
  if (game.isGameOver()) {
    pauseClock();
    return;
  }
  if (!state.clock.started) {
    startClock();
    return;
  }
  if (state.clock.running) state.clock.lastTick = performance.now();
  renderClock();
}

function tickClock() {
  if (!state.clock.running || !state.clock.lastTick) return;
  const now = performance.now();
  const elapsed = now - state.clock.lastTick;
  state.clock.lastTick = now;
  if (game.turn() === "w") state.clock.whiteMs -= elapsed;
  else state.clock.blackMs -= elapsed;

  if (state.clock.whiteMs <= 0 || state.clock.blackMs <= 0) {
    pauseClock();
    showStatus(`${state.clock.whiteMs <= 0 ? "Blancas" : "Negras"} pierden por tiempo.`);
  }
  renderClock();
}

function applyClockIncrement(color) {
  const increment = Number(elements.incrementSeconds.value || 0) * 1000;
  if (!increment) return;
  if (color === "w") state.clock.whiteMs += increment;
  else state.clock.blackMs += increment;
}

function renderClock() {
  renderClockPlacement();
  elements.whiteClock.textContent = formatClock(state.clock.whiteMs);
  elements.blackClock.textContent = formatClock(state.clock.blackMs);
  const playerIsWhite = state.playerColor === "white";
  elements.whiteClockName.textContent = playerIsWhite ? "Jugador" : "Stockfish";
  elements.blackClockName.textContent = playerIsWhite ? "Stockfish" : "Jugador";
  elements.whiteClockMeta.textContent = playerIsWhite ? "Local" : "SF";
  elements.blackClockMeta.textContent = playerIsWhite ? "SF" : "Local";
  const whiteActive = state.clock.running && game.turn() === "w";
  const blackActive = state.clock.running && game.turn() === "b";
  elements.whiteClockCard.classList.toggle("active", whiteActive);
  elements.blackClockCard.classList.toggle("active", blackActive);
  elements.whiteClockCard.classList.toggle("flagged", state.clock.whiteMs <= 0);
  elements.blackClockCard.classList.toggle("flagged", state.clock.blackMs <= 0);
  elements.whiteClockProgress.style.width = `${clockProgress(state.clock.whiteMs)}%`;
  elements.blackClockProgress.style.width = `${clockProgress(state.clock.blackMs)}%`;
}

function renderClockPlacement() {
  const topClock = state.orientation === "white" ? elements.blackClockCard : elements.whiteClockCard;
  const bottomClock = state.orientation === "white" ? elements.whiteClockCard : elements.blackClockCard;
  if (elements.topClockSlot.firstElementChild !== topClock) elements.topClockSlot.replaceChildren(topClock);
  if (elements.bottomClockSlot.firstElementChild !== bottomClock) elements.bottomClockSlot.replaceChildren(bottomClock);
}

function clockProgress(ms) {
  const base = Math.max(1, state.clock.initialMs);
  return Math.max(0, Math.min(100, (ms / base) * 100));
}

function formatClock(ms) {
  const safe = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function shareGame() {
  const pgn = game.linePgn() || game.pgn();
  const text = [
    "Partida de Play Chess Stockfish",
    "",
    pgn ? `PGN:\n${pgn}` : "PGN: sin jugadas todavía",
    "",
    `FEN actual:\n${game.fen()}`,
  ].join("\n");

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Partida de ajedrez",
        text,
      });
      showStatus("Partida compartida.");
      return;
    }

    await navigator.clipboard.writeText(text);
    showStatus("Partida copiada al portapapeles.");
  } catch {
    showStatus("No se pudo compartir la partida.");
  }
}

function playMoveSound(move) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  if (!state.audioContext) state.audioContext = new AudioContext();
  const context = state.audioContext;
  if (context.state === "suspended") context.resume().catch(() => {});

  const now = context.currentTime;
  const gain = context.createGain();
  const tone = context.createOscillator();
  const click = context.createOscillator();

  const isCapture = Boolean(move?.captured);
  const isCheck = typeof move?.san === "string" && move.san.includes("+");
  const baseFrequency = isCapture ? 260 : isCheck ? 520 : 390;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

  tone.type = "sine";
  tone.frequency.setValueAtTime(baseFrequency, now);
  tone.frequency.exponentialRampToValueAtTime(baseFrequency * 1.18, now + 0.08);
  tone.connect(gain);

  click.type = "triangle";
  click.frequency.setValueAtTime(baseFrequency * 2, now);
  click.connect(gain);

  gain.connect(context.destination);
  tone.start(now);
  click.start(now);
  tone.stop(now + 0.14);
  click.stop(now + 0.06);
}

function announceEngineMove(move) {
  if (!state.speechEnabled || !("speechSynthesis" in window)) return;

  const text = moveToSpanish(move);
  pauseVoiceRecognitionForOutput();

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-ES";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 0.95;

  utterance.addEventListener("end", resumeVoiceRecognitionAfterOutput);
  utterance.addEventListener("error", resumeVoiceRecognitionAfterOutput);

  window.setTimeout(() => {
    if (!state.speechEnabled) return;
    window.speechSynthesis.speak(utterance);
  }, 120);
}

function moveToSpanish(move) {
  if (!move) return "";
  if (move.san === "O-O" || move.san === "O-O+") return "enroque corto";
  if (move.san === "O-O-O" || move.san === "O-O-O+") return "enroque largo";

  const pieceNames = {
    p: "peón",
    n: "caballo",
    b: "alfil",
    r: "torre",
    q: "dama",
    k: "rey",
  };
  const parts = [pieceNames[move.piece] || "pieza"];
  if (move.captured) parts.push("captura en");
  parts.push(squareToSpanish(move.to));
  if (move.promotion) parts.push(`corona ${pieceNames[move.promotion] || "dama"}`);
  if (move.san?.includes("#")) parts.push("jaque mate");
  else if (move.san?.includes("+")) parts.push("jaque");
  return parts.join(" ");
}

function squareToSpanish(square) {
  if (!square || square.length < 2) return "";
  return `${square[0]} ${square[1]}`;
}

function pauseVoiceRecognitionForOutput() {
  if (!state.speechRecognition || !state.speechEnabled) return;
  state.speechPausedForOutput = true;
  window.clearTimeout(state.speechRestartTimer);
  try {
    state.speechRecognition.abort();
  } catch {
    // El navegador puede cerrar el reconocimiento por su cuenta.
  }
}

function resumeVoiceRecognitionAfterOutput() {
  if (!state.speechEnabled) return;
  state.speechPausedForOutput = false;
  elements.voiceStatus.textContent = "Voz activa. Tu turno.";
  scheduleVoiceRestart(120);
}

function setupVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    elements.voiceMove.disabled = true;
    elements.voiceStatus.textContent = "Reconocimiento de voz no disponible en este navegador.";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "es-PE";
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 8;
  state.speechRecognition = recognition;

  recognition.addEventListener("start", () => {
    state.speechListening = true;
    elements.voiceMove.classList.add("listening");
    elements.voiceMove.textContent = "Detener voz";
    elements.voiceStatus.textContent = "Voz activa. Di tu jugada cuando sea tu turno.";
  });

  recognition.addEventListener("end", () => {
    state.speechListening = false;
    if (state.speechPausedForOutput) return;
    if (state.speechEnabled) {
      scheduleVoiceRestart(120);
      return;
    }
    setVoiceIdle();
  });

  recognition.addEventListener("error", (event) => {
    if (event.error === "aborted" && state.speechEnabled) return;
    elements.voiceStatus.textContent = voiceErrorMessage(event.error);
    if (event.error === "not-allowed" || event.error === "audio-capture") {
      state.speechEnabled = false;
      return;
    }
    if (state.speechEnabled) scheduleVoiceRestart(120);
  });

  recognition.addEventListener("result", (event) => {
    state.speechLastTranscriptAt = Date.now();
    const result = event.results[event.resultIndex] || event.results[event.results.length - 1];
    const alternatives = [...result].map((item) => item.transcript);
    handleVoiceTranscripts(alternatives);
  });

  elements.voiceMove.addEventListener("click", () => {
    if (state.speechEnabled) {
      state.speechEnabled = false;
      state.speechPausedForOutput = false;
      window.clearTimeout(state.speechRestartTimer);
      window.speechSynthesis?.cancel();
      recognition.stop();
      setVoiceIdle();
      return;
    }

    state.speechEnabled = true;
    playMoveSound();
    startVoiceRecognition();
  });
}

function handleVoiceTranscripts(transcripts) {
  if (state.mode === "play" && state.engineThinking) {
    elements.voiceStatus.textContent = "Voz activa. Esperando la respuesta del motor.";
    return;
  }

  const legalMoves = game.legalMoves();
  let lastResult = null;

  for (const transcript of transcripts) {
    const result = parseSpanishMove(transcript, legalMoves);
    if (result.ok) {
      const move = handleMoveAttempt(result.move.from, result.move.to, result.move.promotion);
      if (!move) {
        elements.voiceStatus.textContent = `Escuché “${transcript}”, pero no se puede jugar ahora.`;
        scheduleVoiceRestart(120);
        return;
      }

      elements.voiceStatus.textContent = `Escuché “${transcript}” → ${move.san}.`;
      return;
    }
    lastResult = result;
  }

  elements.voiceStatus.textContent = lastResult?.message || "No pude detectar una jugada legal.";
  restartVoiceRecognition(100);
}

function startVoiceRecognition() {
  if (!state.speechRecognition || state.speechListening) return;
  try {
    state.speechRecognition.start();
  } catch {
    scheduleVoiceRestart(120);
  }
}

function scheduleVoiceRestart(delay = 250) {
  window.clearTimeout(state.speechRestartTimer);
  state.speechRestartTimer = window.setTimeout(() => {
    if (state.speechEnabled && !state.speechListening) startVoiceRecognition();
  }, delay);
}

function restartVoiceRecognition(delay = 120) {
  if (!state.speechEnabled || !state.speechRecognition) return;
  window.clearTimeout(state.speechRestartTimer);
  try {
    if (state.speechListening) state.speechRecognition.abort();
  } catch {
    // El siguiente arranque cubre cierres prematuros del navegador.
  }
  scheduleVoiceRestart(delay);
}

function setVoiceIdle() {
  elements.voiceMove.classList.remove("listening");
  elements.voiceMove.textContent = "Escuchar jugada";
  elements.voiceStatus.textContent = "Voz detenida.";
}

function voiceErrorMessage(error) {
  if (error === "not-allowed") return "Permiso de micrófono denegado.";
  if (error === "no-speech") return "No escuché ninguna jugada.";
  if (error === "aborted") return "Escucha reiniciada.";
  if (error === "audio-capture") return "No se encontró micrófono.";
  return "No pude usar el reconocimiento de voz.";
}

function isTextInput(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}
