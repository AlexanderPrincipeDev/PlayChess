import "./styles.css";
import { Chess } from "chess.js";
import { classifyLoss, classificationNag, scoreToCp } from "./analysis/moveClassifier.js";
import { GameState } from "./chess/gameState.js";
import { capturedMaterial, materialRow } from "./chess/material.js";
import { splitPgnGames } from "./chess/pgnTools.js";
import { parseSpanishMove } from "./chess/spanishMoveParser.js";
import { createVariation, pvToSan, uciToMove } from "./chess/variationTools.js";
import { ENGINE_PROFILES, resolveEngineProfile, StockfishEngine } from "./engine/stockfishEngine.js";
import { buildGameRecord, currentGameResult } from "./library/gameMetadata.js";
import { detectOpening, recommendOpeningMoves } from "./openings/openingBook.js";
import {
  deleteGameRecord,
  exportUserData,
  importUserData,
  loadRepertoireLines,
  loadSavedGames,
  loadSettings,
  saveGameRecord,
  saveRepertoireLine,
  saveSettings,
} from "./storage/appStorage.js";
import { ChessBoard } from "./ui/board.js";
import { renderAnalysis } from "./ui/analysisPanel.js";
import { renderAnalysisReport, renderEvaluationGraph } from "./ui/evaluationGraph.js";
import { renderRepertoireLibrary, renderSavedGamesLibrary } from "./ui/libraryPanel.js";
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
        <button class="nav-mode active" data-mode="play" type="button">Jugar</button>
        <button class="nav-mode" data-mode="analysis" type="button">Analizar</button>
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

        <section class="panel-group compact-card voice-card play-workspace">
          <h2>Voz</h2>
          <button id="voiceMoveBtn" class="voice-button" type="button">Escuchar jugada</button>
          <p id="voiceStatus" class="voice-status">Di jugadas como “caballo f3”, “peón e4” o “enroque corto”.</p>
        </section>

        <details class="panel-group compact-card tool-drawer analysis-workspace">
          <summary>Biblioteca</summary>
          <div class="library-filters">
            <input id="gameSearchInput" type="search" placeholder="Buscar partida, apertura, jugador..." />
            <select id="gameResultFilter">
              <option value="all">Todos los resultados</option>
              <option value="1-0">1-0</option>
              <option value="0-1">0-1</option>
              <option value="1/2-1/2">Tablas</option>
              <option value="*">En curso</option>
            </select>
          </div>
          <div id="savedGamesList" class="library-list"></div>
        </details>

        <details class="panel-group compact-card tool-drawer analysis-workspace">
          <summary>Repertorio</summary>
          <div id="repertoireList" class="library-list"></div>
        </details>

      </aside>

      <section class="board-section" aria-label="Tablero de ajedrez">
        <div id="topClockSlot" class="board-clock-slot"></div>
        <div id="board" class="board" aria-label="Tablero"></div>
        <div id="bottomClockSlot" class="board-clock-slot"></div>
        <div class="board-controls" aria-label="Controles del tablero">
          <button id="newGameBtn" class="board-primary-action" type="button">Nueva partida</button>
          <button id="flipBtn" class="icon-button" type="button" aria-label="Girar tablero" title="Girar tablero">⇅</button>
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
            <div id="blackCaptured" class="captured-material"></div>
          </div>
          <div id="whiteClockCard" class="player-clock white-clock">
            <div class="clock-player-row">
              <span class="player-dot white"></span>
              <strong id="whiteClockName">Jugador</strong>
              <span id="whiteClockMeta" class="clock-rating">Local</span>
            </div>
            <strong id="whiteClock" class="clock-time">05:00</strong>
            <div class="clock-progress" aria-hidden="true"><span id="whiteClockProgress"></span></div>
            <div id="whiteCaptured" class="captured-material"></div>
          </div>
        </div>
      </section>

      <aside class="side-panel" aria-label="Panel de juego y análisis">
        <section class="panel-group play-summary-card play-workspace">
          <div class="panel-heading">
            <h2>Partida</h2>
            <div class="analysis-actions">
              <span id="playModeBadge">Contra motor</span>
              <button id="playEngineSettingsBtn" class="small-button" type="button">Elegir motor</button>
            </div>
          </div>
          <div class="play-summary-grid">
            <div>
              <span>Rival</span>
              <strong id="playEngineName">Stockfish</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong id="playEngineStatus">En espera</strong>
            </div>
            <div>
              <span>Color</span>
              <strong id="playColorLabel">Blancas</strong>
            </div>
            <div>
              <span>Resultado</span>
              <strong id="playResultLabel">En curso</strong>
            </div>
          </div>
          <div class="play-actions">
            <button id="shareGameBtn" type="button">Compartir</button>
            <button id="quickResignBtn" type="button">Rendirse</button>
            <button id="quickRematchBtn" type="button">Revancha</button>
          </div>
        </section>

        <section class="panel-group analysis-card analysis-workspace">
          <div class="panel-heading">
            <h2>Análisis del motor</h2>
            <div class="analysis-actions">
              <span id="engineProfileBadge">SF 18 Full · NNUE</span>
              <button id="analysisEngineSettingsBtn" class="small-button" type="button">Elegir motor</button>
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

        <section class="panel-group analysis-progress-card analysis-workspace">
          <div class="panel-heading">
            <h2>Análisis de partida</h2>
            <div class="analysis-run-actions">
              <button id="runGameAnalysisBtn" class="small-button" type="button">Analizar partida</button>
              <button id="cancelAnalysisBtn" class="small-button" type="button">Cancelar</button>
            </div>
          </div>
          <div class="analysis-progress">
            <span id="analysisProgressText">Sin análisis completo</span>
            <div class="progress-track" aria-hidden="true"><span id="analysisProgressBar"></span></div>
          </div>
        </section>

        <section class="panel-group eval-card analysis-workspace">
          <h2>Gráfico de evaluación</h2>
          <div id="evalGraph" class="eval-graph"></div>
        </section>

        <section class="panel-group report-card analysis-workspace">
          <h2>Reporte</h2>
          <div id="analysisReport" class="analysis-report"></div>
        </section>

        <section class="panel-group context-card analysis-workspace">
          <div>
            <h2>Apertura</h2>
            <div id="openingInfo" class="opening-info">Apertura no identificada</div>
          </div>
          <div>
            <h2>Finales</h2>
            <div id="endgameInfo" class="opening-info">No es final técnico todavía</div>
          </div>
        </section>

        <section class="panel-group opening-explorer-card analysis-workspace">
          <h2>Explorador de apertura</h2>
          <div id="openingExplorer" class="opening-explorer"></div>
        </section>

        <section class="panel-group variation-card analysis-workspace">
          <div class="panel-heading">
            <h2>Variantes</h2>
            <button id="saveVariationBtn" class="small-button" type="button">Guardar línea</button>
          </div>
          <div id="variationPreview" class="variation-preview">Selecciona una línea del motor.</div>
          <div id="variationList" class="variation-list"></div>
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
          <div id="pgnDropZone" class="drop-zone">Arrastra aquí un archivo PGN</div>
          <label id="pgnGamePickerLabel" class="pgn-game-picker" hidden>
            Partida detectada
            <select id="pgnGameSelect"></select>
          </label>
          <div class="pgn-controls">
            <button id="loadPgnBtn" type="button">Cargar PGN</button>
            <button id="pgnStartBtn" type="button">Inicio</button>
            <button id="pgnPrevBtn" type="button">Atrás</button>
            <button id="pgnNextBtn" type="button">Siguiente</button>
            <button id="pgnEndBtn" type="button">Final</button>
          </div>
        </details>

        <details class="panel-group io-card tool-drawer analysis-workspace">
          <summary>Guardar y exportar</summary>
          <div class="toolbar" aria-label="Guardar y exportar">
            <button id="exportPgnBtn" type="button">Exportar PGN</button>
            <button id="saveGameBtn" type="button">Guardar partida</button>
            <button id="saveRepertoireBtn" type="button">Guardar repertorio</button>
          </div>
        </details>

        <details class="panel-group io-card tool-drawer analysis-workspace">
          <summary>Backup</summary>
          <div class="toolbar" aria-label="Backup local">
            <button id="exportBackupBtn" type="button">Exportar backup</button>
            <label class="button-like">
              Importar backup
              <input id="importBackupInput" type="file" accept="application/json,.json" />
            </label>
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

    <div id="promotionModal" class="modal-backdrop" hidden>
      <section class="settings-modal promotion-modal" role="dialog" aria-modal="true" aria-labelledby="promotionTitle">
        <header class="modal-header">
          <div>
            <h2 id="promotionTitle">Promoción</h2>
            <p>Elige la pieza para coronar.</p>
          </div>
        </header>
        <div class="promotion-grid" aria-label="Opciones de promoción">
          <button data-promotion="q" type="button">♛<span>Dama</span></button>
          <button data-promotion="r" type="button">♜<span>Torre</span></button>
          <button data-promotion="b" type="button">♝<span>Alfil</span></button>
          <button data-promotion="n" type="button">♞<span>Caballo</span></button>
        </div>
      </section>
    </div>
  </div>
`;

const settings = loadSettings();
const game = new GameState();
const engine = new StockfishEngine();

const elements = {
  shell: document.querySelector(".shell"),
  board: document.querySelector("#board"),
  topClockSlot: document.querySelector("#topClockSlot"),
  bottomClockSlot: document.querySelector("#bottomClockSlot"),
  status: document.querySelector("#statusText"),
  engineState: document.querySelector("#engineState"),
  playEngineName: document.querySelector("#playEngineName"),
  playEngineStatus: document.querySelector("#playEngineStatus"),
  playColorLabel: document.querySelector("#playColorLabel"),
  playResultLabel: document.querySelector("#playResultLabel"),
  playEngineSettings: document.querySelector("#playEngineSettingsBtn"),
  analysisEngineSettings: document.querySelector("#analysisEngineSettingsBtn"),
  quickResign: document.querySelector("#quickResignBtn"),
  quickRematch: document.querySelector("#quickRematchBtn"),
  modeTabs: [...document.querySelectorAll("[data-mode]")],
  newGame: document.querySelector("#newGameBtn"),
  flip: document.querySelector("#flipBtn"),
  shareGame: document.querySelector("#shareGameBtn"),
  runGameAnalysis: document.querySelector("#runGameAnalysisBtn"),
  cancelAnalysis: document.querySelector("#cancelAnalysisBtn"),
  exportPgn: document.querySelector("#exportPgnBtn"),
  saveGame: document.querySelector("#saveGameBtn"),
  saveRepertoire: document.querySelector("#saveRepertoireBtn"),
  exportBackup: document.querySelector("#exportBackupBtn"),
  importBackupInput: document.querySelector("#importBackupInput"),
  whiteClock: document.querySelector("#whiteClock"),
  blackClock: document.querySelector("#blackClock"),
  whiteClockCard: document.querySelector("#whiteClockCard"),
  blackClockCard: document.querySelector("#blackClockCard"),
  whiteClockProgress: document.querySelector("#whiteClockProgress"),
  blackClockProgress: document.querySelector("#blackClockProgress"),
  whiteCaptured: document.querySelector("#whiteCaptured"),
  blackCaptured: document.querySelector("#blackCaptured"),
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
  analysisProgressText: document.querySelector("#analysisProgressText"),
  analysisProgressBar: document.querySelector("#analysisProgressBar"),
  evalGraph: document.querySelector("#evalGraph"),
  analysisReport: document.querySelector("#analysisReport"),
  openingExplorer: document.querySelector("#openingExplorer"),
  variationPreview: document.querySelector("#variationPreview"),
  variationList: document.querySelector("#variationList"),
  saveVariation: document.querySelector("#saveVariationBtn"),
  moveList: document.querySelector("#moveList"),
  openingInfo: document.querySelector("#openingInfo"),
  endgameInfo: document.querySelector("#endgameInfo"),
  gameSearchInput: document.querySelector("#gameSearchInput"),
  gameResultFilter: document.querySelector("#gameResultFilter"),
  savedGamesList: document.querySelector("#savedGamesList"),
  repertoireList: document.querySelector("#repertoireList"),
  nagSelect: document.querySelector("#nagSelect"),
  moveComment: document.querySelector("#moveComment"),
  saveAnnotation: document.querySelector("#saveAnnotationBtn"),
  fenInput: document.querySelector("#fenInput"),
  pgnInput: document.querySelector("#pgnInput"),
  pgnFileInput: document.querySelector("#pgnFileInput"),
  pgnDropZone: document.querySelector("#pgnDropZone"),
  pgnGamePickerLabel: document.querySelector("#pgnGamePickerLabel"),
  pgnGameSelect: document.querySelector("#pgnGameSelect"),
  loadFen: document.querySelector("#loadFenBtn"),
  loadPgn: document.querySelector("#loadPgnBtn"),
  pgnStart: document.querySelector("#pgnStartBtn"),
  pgnPrev: document.querySelector("#pgnPrevBtn"),
  pgnNext: document.querySelector("#pgnNextBtn"),
  pgnEnd: document.querySelector("#pgnEndBtn"),
  checkmateModal: document.querySelector("#checkmateModal"),
  checkmateMessage: document.querySelector("#checkmateMessage"),
  playAgain: document.querySelector("#playAgainBtn"),
  promotionModal: document.querySelector("#promotionModal"),
  promotionButtons: [...document.querySelectorAll("[data-promotion]")],
};

const state = {
  mode: settings.mode,
  orientation: settings.orientation,
  playerColor: settings.playerColor,
  engineProfile: settings.engineProfile,
  selected: null,
  legalTargets: [],
  lastMove: null,
  gameResultMessage: "",
  pendingPromotion: null,
  importedPgnGames: [],
  engineThinking: false,
  engineMovePending: false,
  checkmateFenShown: null,
  analysisLines: [],
  analysisBestMove: null,
  analysisFen: null,
  analysisStoppedByUser: false,
  selectedAnalysisLine: 0,
  selectedVariationText: "",
  selectedVariationLine: null,
  variations: Array.isArray(settings.variations) ? settings.variations : [],
  fullAnalysisProgress: {
    current: 0,
    total: 0,
    status: "idle",
  },
  cancelFullAnalysis: false,
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
  document.body.dataset.appMode = state.mode;
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

  initEngineWithFallback(state.engineProfile);

  if (state.playerColor === "black" && state.mode === "play") {
    window.setTimeout(requestEngineMove, 300);
  }
}

function bindUi() {
  elements.modeTabs.forEach((button) => {
    button.addEventListener("click", () => switchMode(button.dataset.mode));
  });

  elements.newGame.addEventListener("click", () => {
    engine.stop();
    game.reset();
    state.engineThinking = false;
    state.engineMovePending = false;
    state.analysisStoppedByUser = state.mode === "play";
    state.lastMove = null;
    state.gameResultMessage = "";
    state.pendingPromotion = null;
    state.selected = null;
    state.legalTargets = [];
    state.analysisLines = [];
    state.analysisBestMove = null;
    state.analysisFen = null;
    state.selectedVariationText = "";
    state.selectedVariationLine = null;
    state.variations = [];
    state.checkmateFenShown = null;
    resetFullAnalysisProgress();
    resetClock();
    persist();
    render();
    if (state.mode === "play" && state.playerColor === "black") requestEngineMove();
  });

  elements.flip.addEventListener("click", () => {
    state.orientation = state.orientation === "white" ? "black" : "white";
    persist();
    render();
  });

  elements.shareGame.addEventListener("click", shareGame);
  elements.runGameAnalysis.addEventListener("click", analyzeFullGame);
  elements.cancelAnalysis.addEventListener("click", cancelFullAnalysis);
  elements.exportPgn.addEventListener("click", exportPgn);
  elements.saveGame.addEventListener("click", saveCurrentGame);
  elements.saveRepertoire.addEventListener("click", saveCurrentRepertoire);
  elements.saveVariation.addEventListener("click", saveSelectedVariation);
  elements.quickResign.addEventListener("click", resignGame);
  elements.quickRematch.addEventListener("click", startRematch);
  elements.exportBackup.addEventListener("click", exportBackup);
  elements.importBackupInput.addEventListener("change", importBackupFile);
  elements.gameSearchInput.addEventListener("input", renderLibrary);
  elements.gameResultFilter.addEventListener("change", renderLibrary);
  elements.playEngineSettings.addEventListener("click", openEngineSettings);
  elements.analysisEngineSettings.addEventListener("click", openEngineSettings);
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
      setMode("analysis");
      state.lastMove = null;
      state.selected = null;
      state.legalTargets = [];
      state.analysisLines = [];
      state.analysisBestMove = null;
      state.analysisFen = null;
      state.gameResultMessage = "";
      persist();
      render();
      restartLiveAnalysis();
    } catch (error) {
      showStatus(error.message || "FEN inválido.");
    }
  });

  elements.loadPgn.addEventListener("click", () => {
    loadSelectedPgnText();
  });

  elements.pgnFileInput.addEventListener("change", async () => {
    const file = elements.pgnFileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      preparePgnImport(text);
    } catch {
      showStatus("No se pudo leer el archivo PGN.");
    } finally {
      elements.pgnFileInput.value = "";
    }
  });
  elements.pgnInput.addEventListener("input", () => {
    preparePgnImport(elements.pgnInput.value, { loadFirst: false });
  });
  elements.pgnDropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.pgnDropZone.classList.add("drag-over");
  });
  elements.pgnDropZone.addEventListener("dragleave", () => {
    elements.pgnDropZone.classList.remove("drag-over");
  });
  elements.pgnDropZone.addEventListener("drop", handlePgnDrop);

  elements.pgnStart.addEventListener("click", () => navigatePgn("start"));
  elements.pgnPrev.addEventListener("click", () => navigatePgn("prev"));
  elements.pgnNext.addEventListener("click", () => navigatePgn("next"));
  elements.pgnEnd.addEventListener("click", () => navigatePgn("end"));
  elements.playAgain.addEventListener("click", () => {
    closeCheckmateModal();
    elements.newGame.click();
  });
  elements.promotionButtons.forEach((button) => {
    button.addEventListener("click", () => completePromotion(button.dataset.promotion));
  });
  elements.promotionModal.addEventListener("click", (event) => {
    if (event.target === elements.promotionModal) closePromotionModal();
  });
  elements.analysisReport.addEventListener("select-ply", (event) => {
    navigateToPly(event.detail.ply);
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
    if (state.mode !== "analysis") return;
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
    if (info && mode === "analysis" && state.mode === "analysis") state.analysisLines = event.detail.lines || [info];
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

function handleMoveAttempt(from, to, promotion = null) {
  if (state.mode === "play" && state.engineThinking) return null;
  if (game.isGameOver()) return null;
  if (state.mode === "play" && sideToMoveName() !== state.playerColor) return null;
  if (!promotion && isPromotionCandidate(from, to)) {
    openPromotionModal(from, to);
    return null;
  }

  const move = game.move(from, to, promotion || "q");
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

  if (state.mode === "play" && !game.isGameOver() && !state.gameResultMessage) {
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
  return state.mode === "play" && !game.isGameOver() && !state.gameResultMessage && sideToMoveName() !== state.playerColor;
}

function isPromotionCandidate(from, to) {
  return game.legalMoves().some((move) => move.from === from && move.to === to && move.promotion);
}

function openPromotionModal(from, to) {
  state.pendingPromotion = { from, to };
  elements.promotionModal.hidden = false;
  elements.promotionButtons[0]?.focus();
}

function closePromotionModal() {
  elements.promotionModal.hidden = true;
  state.pendingPromotion = null;
}

function completePromotion(promotion) {
  const pending = state.pendingPromotion;
  if (!pending) return;
  elements.promotionModal.hidden = true;
  state.pendingPromotion = null;
  handleMoveAttempt(pending.from, pending.to, promotion);
}

function requestAnalysis() {
  if (!engine.ready) {
    showStatus("El motor todavía está cargando.");
    return;
  }

  switchMode("analysis");
}

function loadPgnText(pgn) {
  try {
    engine.stop();
    game.loadPgn(pgn);
    setMode("analysis");
    state.lastMove = null;
    state.selected = null;
    state.legalTargets = [];
    state.analysisLines = [];
    state.analysisBestMove = null;
    state.analysisFen = null;
    state.checkmateFenShown = null;
    state.gameResultMessage = "";
    state.selectedVariationText = "";
    state.selectedVariationLine = null;
    state.variations = [];
    resetFullAnalysisProgress();
    persist();
    render();
    restartLiveAnalysis();
  } catch (error) {
    showStatus(error.message || "PGN inválido.");
  }
}

function preparePgnImport(text, { loadFirst = true } = {}) {
  const trimmed = text.trim();
  elements.pgnInput.value = text;
  state.importedPgnGames = splitPgnGames(trimmed);
  renderPgnGamePicker();

  if (loadFirst && state.importedPgnGames.length) {
    loadPgnText(state.importedPgnGames[0].pgn);
  }
}

function loadSelectedPgnText() {
  const selected = state.importedPgnGames[Number(elements.pgnGameSelect.value)];
  loadPgnText((selected?.pgn || elements.pgnInput.value).trim());
}

function renderPgnGamePicker() {
  const games = state.importedPgnGames;
  elements.pgnGamePickerLabel.hidden = games.length <= 1;
  elements.pgnGameSelect.innerHTML = "";

  games.forEach((gameInfo, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${index + 1}. ${gameInfo.label}`;
    elements.pgnGameSelect.append(option);
  });
}

async function handlePgnDrop(event) {
  event.preventDefault();
  elements.pgnDropZone.classList.remove("drag-over");
  const file = event.dataTransfer.files?.[0];
  if (!file) return;

  try {
    preparePgnImport(await file.text());
  } catch {
    showStatus("No se pudo leer el archivo PGN.");
  }
}

function restartLiveAnalysis() {
  if (!engine.ready) {
    setMode("analysis");
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
  setMode("analysis");
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
  document.body.dataset.appMode = state.mode;
  elements.modeTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
  elements.fenInput.value = game.fen();
  elements.status.textContent = state.gameResultMessage || game.status();
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
  renderPlaySummary();
  renderAnalysisProgress();
  renderEvaluation();
  renderOpeningExplorer();
  renderVariations();
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
    selectedLine: state.selectedAnalysisLine,
    onSelectLine: selectAnalysisLine,
  });
  elements.variationPreview.textContent = state.selectedVariationText || "Selecciona una línea del motor.";
  elements.saveVariation.disabled = !state.selectedVariationLine?.pv?.length;
}

function renderPlaySummary() {
  const profile = resolveEngineProfile(state.engineProfile);
  const result = state.gameResultMessage
    || (game.isGameOver() ? game.status() : "En curso");
  elements.playEngineName.textContent = profile.shortName;
  elements.playEngineStatus.textContent = state.engineThinking
    ? "Pensando"
    : engine.ready ? "Listo" : "Cargando";
  elements.playColorLabel.textContent = state.playerColor === "white" ? "Blancas" : "Negras";
  elements.playResultLabel.textContent = result;
  elements.quickResign.disabled = state.mode !== "play" || game.isGameOver() || Boolean(state.gameResultMessage);
}

function selectAnalysisLine(line, index) {
  state.selectedAnalysisLine = index;
  state.selectedVariationLine = line;
  state.selectedVariationText = pvToSan(state.analysisFen || game.fen(), line.pv);
  renderAnalysisPanel();
}

function saveSelectedVariation() {
  if (!state.selectedVariationLine?.pv?.length) return;
  const basePly = game.activePly();
  const baseFen = state.analysisFen || game.fen();
  const variation = createVariation({
    basePly,
    baseFen,
    line: state.selectedVariationLine,
    index: state.selectedAnalysisLine,
  });
  state.variations.unshift(variation);
  appendVariationComment(basePly, variation.san);
  persist();
  render();
}

function appendVariationComment(basePly, san) {
  const ply = Number(basePly);
  if (!ply || !san) return;
  const annotation = game.getAnnotation(ply);
  const nextComment = [annotation.comment, `Variante: ${san}`].filter(Boolean).join(" ");
  game.setAnnotation(ply, { comment: nextComment });
}

function renderVariations() {
  elements.variationList.innerHTML = "";
  const relevant = state.variations.filter((variation) => variation.basePly === game.activePly());

  if (!relevant.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Sin variantes guardadas en esta posición.";
    elements.variationList.append(empty);
    return;
  }

  for (const variation of relevant) {
    const item = document.createElement("div");
    item.className = "variation-item";

    const text = document.createElement("span");
    text.textContent = variation.san || "Variante sin notación";

    const actions = document.createElement("div");
    actions.className = "variation-actions";

    const use = document.createElement("button");
    use.type = "button";
    use.textContent = "Usar";
    use.addEventListener("click", () => applyVariation(variation.id));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Eliminar";
    remove.addEventListener("click", () => deleteVariation(variation.id));

    actions.append(use, remove);
    item.append(text, actions);
    elements.variationList.append(item);
  }
}

function applyVariation(id) {
  const variation = state.variations.find((item) => item.id === id);
  if (!variation) return;

  engine.stop();
  game.goToPly(variation.basePly);
  for (const uci of variation.pv) {
    const move = game.move(uciToMove(uci).from, uciToMove(uci).to, uciToMove(uci).promotion);
    if (!move) break;
  }
  state.lastMove = game.history().at(-1) || null;
  state.analysisLines = [];
  state.analysisBestMove = null;
  state.analysisFen = null;
  state.selectedVariationText = "";
  state.selectedVariationLine = null;
  persist();
  render();
  restartLiveAnalysis();
}

function deleteVariation(id) {
  state.variations = state.variations.filter((variation) => variation.id !== id);
  persist();
  render();
}

function renderAnalysisProgress() {
  const { current, total, status } = state.fullAnalysisProgress;
  const percent = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const labels = {
    idle: "Sin análisis completo",
    running: `Analizando ${current}/${total}`,
    cancelled: `Análisis cancelado en ${current}/${total}`,
    complete: `Análisis completo: ${total}/${total}`,
  };
  elements.analysisProgressText.textContent = labels[status] || labels.idle;
  elements.analysisProgressBar.style.width = `${percent}%`;
  elements.cancelAnalysis.disabled = status !== "running";
  elements.runGameAnalysis.disabled = status === "running" || !game.lineHistory().length;
}

function renderEvaluation() {
  const annotations = game.annotationsObject();
  renderEvaluationGraph(elements.evalGraph, game.lineHistory(), annotations, game.activePly(), navigateToPly);
  renderAnalysisReport(elements.analysisReport, game.lineHistory(), annotations);
}

function renderOpeningExplorer() {
  const recommendations = recommendOpeningMoves(game.lineHistory());
  elements.openingExplorer.innerHTML = "";

  if (!recommendations.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Sin sugerencias en el libro actual para esta posición.";
    elements.openingExplorer.append(empty);
    return;
  }

  for (const recommendation of recommendations) {
    const row = document.createElement("div");
    row.className = "opening-option";
    const move = document.createElement("strong");
    move.textContent = recommendation.move;
    const detail = document.createElement("span");
    detail.textContent = `${recommendation.eco} · ${recommendation.name}`;
    row.append(move, detail);
    elements.openingExplorer.append(row);
  }
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
    variations: state.variations,
  });
}

function setEngineState(text) {
  elements.engineState.textContent = text;
}

function showStatus(text) {
  elements.status.textContent = text;
}

function setMode(mode) {
  state.mode = mode === "analysis" ? "analysis" : "play";
  document.body.dataset.appMode = state.mode;
}

function switchMode(mode) {
  const nextMode = mode === "analysis" ? "analysis" : "play";
  state.selected = null;
  state.legalTargets = [];

  if (nextMode === "play") {
    engine.stop();
    state.engineThinking = false;
    state.engineMovePending = false;
    state.analysisStoppedByUser = true;
    state.analysisLines = [];
    state.analysisBestMove = null;
    state.analysisFen = null;
    state.selectedVariationText = "";
    state.selectedVariationLine = null;
    setMode("play");
    setEngineState(engine.ready ? "Motor listo" : "Motor cargando");
    persist();
    render();
    if (shouldEngineMove()) requestEngineMove();
    return;
  }

  setMode("analysis");
  persist();
  render();
  restartLiveAnalysis();
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
  if (state.mode === "play" && state.playerColor !== sideToMoveName()) requestEngineMove();
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
    await initEngineWithFallback("stockfish18-lite", error);
  }
}

async function initEngineWithFallback(profileId, previousError = null) {
  state.engineProfile = profileId;
  renderEngineProfile();
  setEngineState("Cargando motor");

  try {
    await engine.useProfile(profileId);
    configureEngine();
    setEngineState("Motor listo");
    persist();
    if (previousError) showStatus(`Se usó motor alternativo por compatibilidad: ${resolveEngineProfile(profileId).name}.`);
    if (shouldEngineMove()) requestEngineMove();
  } catch (error) {
    const nextProfile = profileId === "stockfish18-full"
      ? "stockfish18-lite"
      : profileId === "stockfish18-asm"
        ? null
        : "stockfish18-asm";
    if (nextProfile) {
      showStatus("El motor seleccionado falló. Probando motor compatible.");
      await initEngineWithFallback(nextProfile, error);
      return;
    }
    setEngineState("Error del motor");
    showStatus(previousError?.message || error.message || "No se pudo cargar el motor.");
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
  state.cancelFullAnalysis = false;
  state.fullAnalysisProgress = {
    current: 0,
    total: game.lineHistory().length,
    status: "running",
  };
  setMode("analysis");
  setEngineState("Analizando partida");
  engine.stop();
  configureEngine();
  render();

  const originalPly = game.activePly();
  const chess = new Chess();
  const depth = Math.min(Number(elements.analysisDepth.value) || 10, 12);

  for (let index = 0; index < game.lineHistory().length; index += 1) {
    if (state.cancelFullAnalysis) break;
    const move = game.lineHistory()[index];
    const ply = index + 1;
    const fenBefore = chess.fen();
    const turnBefore = chess.turn();
    const before = await engine.evaluate({ fen: fenBefore, depth });
    const bestMove = before.move || "";
    const bestMoveSan = uciToSan(fenBefore, bestMove);
    const bestCp = scoreToCp(before.info?.score, turnBefore);

    chess.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
    const after = await engine.evaluate({ fen: chess.fen(), depth });
    const afterCpForMover = -scoreToCp(after.info?.score, chess.turn());
    const loss = bestCp == null || afterCpForMover == null ? null : Math.max(0, bestCp - afterCpForMover);
    const classification = classifyLoss(loss);

    game.setAnnotation(ply, {
      eval: formatEngineEval(after.info?.score, chess.turn()),
      bestMove,
      bestMoveSan,
      loss,
      classification,
      nag: classificationNag(classification),
    });

    state.fullAnalysisProgress.current = ply;
    setEngineState(`Analizando ${ply}/${game.lineHistory().length}`);
    renderAnalysisProgress();
    renderEvaluation();
    renderMoveList(elements.moveList, game.lineHistory(), {
      activePly: ply,
      annotations: game.annotationsObject(),
      onSelectPly: navigateToPly,
    });
  }

  game.goToPly(originalPly);
  state.analyzingGame = false;
  state.fullAnalysisProgress.status = state.cancelFullAnalysis ? "cancelled" : "complete";
  state.cancelFullAnalysis = false;
  setEngineState(state.fullAnalysisProgress.status === "complete" ? "Análisis completo" : "Análisis cancelado");
  persist();
  render();
  if (state.mode === "analysis") restartLiveAnalysis();
}

function cancelFullAnalysis() {
  if (!state.analyzingGame) return;
  state.cancelFullAnalysis = true;
  engine.stop();
  setEngineState("Cancelando análisis");
  renderAnalysisProgress();
}

function resetFullAnalysisProgress() {
  state.fullAnalysisProgress = {
    current: 0,
    total: 0,
    status: "idle",
  };
  state.cancelFullAnalysis = false;
}

function formatEngineEval(score, turn) {
  const cp = scoreToCp(score, turn);
  if (cp == null) return "";
  if (Math.abs(cp) >= 10000) return cp > 0 ? "#+" : "#-";
  const pawns = cp / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

function uciToSan(fen, uci) {
  if (!uci || uci === "(none)") return "";
  try {
    const chess = new Chess(fen);
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.slice(4, 5) || "q",
    });
    return move?.san || uci;
  } catch {
    return uci;
  }
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
  downloadText(`partida-${Date.now()}.pgn`, game.linePgn(), "application/x-chess-pgn;charset=utf-8");
}

function resignGame() {
  if (state.mode !== "play" || game.isGameOver() || state.gameResultMessage) return;
  engine.stop();
  pauseClock();
  state.engineThinking = false;
  state.engineMovePending = false;
  state.gameResultMessage = `${state.playerColor === "white" ? "Blancas" : "Negras"} abandonan.`;
  showStatus(state.gameResultMessage);
  render();
}

function startRematch() {
  elements.newGame.click();
}

function saveCurrentGame() {
  const opening = detectOpening(game.lineHistory());
  saveGameRecord(buildGameRecord({
    id: crypto.randomUUID(),
    pgn: game.linePgn(),
    fen: game.fen(),
    annotations: game.annotationsObject(),
    variations: state.variations,
    opening,
    result: currentGameResult(game),
    playerColor: state.playerColor,
    moveCount: game.lineHistory().length,
  }));
  showStatus("Partida guardada.");
  renderLibrary();
}

function exportBackup() {
  const data = JSON.stringify(exportUserData(), null, 2);
  downloadText(`playchess-backup-${Date.now()}.json`, data, "application/json;charset=utf-8");
  showStatus("Backup exportado.");
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importBackupFile() {
  const file = elements.importBackupInput.files?.[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    importUserData(data);
    renderLibrary();
    showStatus("Backup importado.");
  } catch (error) {
    showStatus(error.message || "No se pudo importar el backup.");
  } finally {
    elements.importBackupInput.value = "";
  }
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
  renderSavedGamesLibrary(elements.savedGamesList, loadSavedGames(), {
    query: elements.gameSearchInput.value,
    result: elements.gameResultFilter.value,
    onOpen: openSavedGame,
    onExport: exportSavedGame,
    onDelete: removeSavedGame,
  });
  renderRepertoireLibrary(elements.repertoireList, loadRepertoireLines(), openSavedGame);
}

function openSavedGame(item) {
  if (!item.pgn) return;
  try {
    engine.stop();
    game.loadPgn(item.pgn);
    game.loadAnnotations(item.annotations);
    state.variations = Array.isArray(item.variations) ? item.variations : [];
    setMode("analysis");
    persist();
    render();
    restartLiveAnalysis();
  } catch {
    showStatus("No se pudo abrir el registro guardado.");
  }
}

function exportSavedGame(item) {
  if (!item.pgn) return;
  downloadText(`${item.title || "partida"}.pgn`, item.pgn, "application/x-chess-pgn;charset=utf-8");
}

function removeSavedGame(item) {
  deleteGameRecord(item.id);
  showStatus("Partida eliminada.");
  renderLibrary();
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
  renderCapturedMaterial();
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

function renderCapturedMaterial() {
  const material = capturedMaterial(game.lineHistory());
  elements.whiteCaptured.innerHTML = materialRow(material.whiteCaptured, material.balance);
  elements.blackCaptured.innerHTML = materialRow(material.blackCaptured, -material.balance);
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
