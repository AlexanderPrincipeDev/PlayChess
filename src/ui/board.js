const PIECES = {
  wp: "♟",
  wn: "♞",
  wb: "♝",
  wr: "♜",
  wq: "♛",
  wk: "♚",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];

export class ChessBoard {
  constructor(container, { onSquareSelect, onMove, onMarkSquare }) {
    this.container = container;
    this.onSquareSelect = onSquareSelect;
    this.onMove = onMove;
    this.onMarkSquare = onMarkSquare;
    this.orientation = "white";
    this.selected = null;
    this.legalTargets = [];
    this.lastMove = null;
    this.squares = new Map();
    this.pointerFrom = null;
    this.suppressNextClick = false;
    this.showCoordinates = true;
    this.marks = new Set();
    this.animationFrame = null;
  }

  setState({ game, orientation, selected, legalTargets, lastMove, showCoordinates = true, marks = new Set() }) {
    this.game = game;
    this.orientation = orientation;
    this.selected = selected;
    this.legalTargets = legalTargets || [];
    this.lastMove = lastMove || null;
    this.showCoordinates = showCoordinates;
    this.marks = marks;
    this.render();
  }

  render() {
    this.container.innerHTML = "";
    this.squares.clear();

    const ranks = this.orientation === "white" ? [...RANKS].reverse() : [...RANKS];
    const files = this.orientation === "white" ? FILES : [...FILES].reverse();

    for (const rank of ranks) {
      for (const file of files) {
        const square = `${file}${rank}`;
        const piece = this.game.pieceAt(square);
        const tile = document.createElement("button");
        tile.className = this.classNameFor(square, file, rank);
        tile.type = "button";
        tile.dataset.square = square;
        tile.setAttribute("aria-label", square);
        tile.draggable = false;

        const pieceNode = document.createElement("span");
        pieceNode.className = piece ? `piece ${piece.color === "w" ? "white" : "black"}` : "piece";
        pieceNode.textContent = piece ? PIECES[`${piece.color}${piece.type}`] : "";
        pieceNode.draggable = Boolean(piece);
        tile.append(pieceNode);

        if (this.showCoordinates) {
          if (file === files[0]) {
            const rankNode = document.createElement("span");
            rankNode.className = "coord rank";
            rankNode.textContent = rank;
            tile.append(rankNode);
          }
          if (rank === ranks.at(-1)) {
            const fileNode = document.createElement("span");
            fileNode.className = "coord file";
            fileNode.textContent = file;
            tile.append(fileNode);
          }
        }

        tile.addEventListener("pointerdown", () => {
          this.pointerFrom = piece ? square : null;
        });
        tile.addEventListener("pointerup", () => {
          if (this.pointerFrom && this.pointerFrom !== square) {
            this.suppressNextClick = true;
            this.onMove(this.pointerFrom, square);
          }
          this.pointerFrom = null;
        });
        tile.addEventListener("click", () => {
          if (this.suppressNextClick) {
            this.suppressNextClick = false;
            return;
          }
          this.onSquareSelect(square);
        });
        tile.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          this.onMarkSquare?.(square);
        });
        pieceNode.addEventListener("dragstart", (event) => {
          if (!piece) return;
          event.stopPropagation();
          event.dataTransfer.setData("text/plain", square);
          event.dataTransfer.effectAllowed = "move";
        });
        tile.addEventListener("dragover", (event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        });
        tile.addEventListener("drop", (event) => {
          event.preventDefault();
          const from = event.dataTransfer.getData("text/plain");
          if (from) {
            this.onMove(from, square);
          }
        });

        this.container.append(tile);
        this.squares.set(square, tile);
      }
    }
  }

  classNameFor(square, file, rank) {
    const light = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 1;
    const classes = ["square", light ? "light" : "dark"];

    if (this.selected === square) classes.push("selected");
    if (this.legalTargets.includes(square)) classes.push("legal");
    if (this.lastMove && (this.lastMove.from === square || this.lastMove.to === square)) {
      classes.push("last-move");
    }
    if (this.marks.has(square)) classes.push("marked");

    return classes.join(" ");
  }

  animateMove(move) {
    if (!move?.from || !move?.to) return;

    const fromTile = this.squares.get(move.from);
    const toTile = this.squares.get(move.to);
    const targetPiece = toTile?.querySelector(".piece");
    if (!fromTile || !toTile || !targetPiece?.textContent) return;

    const fromRect = fromTile.getBoundingClientRect();
    const toRect = toTile.getBoundingClientRect();
    if (!fromRect.width || !toRect.width) return;

    window.cancelAnimationFrame(this.animationFrame);

    const flyingPiece = targetPiece.cloneNode(true);
    flyingPiece.classList.add("piece-flight");
    flyingPiece.style.left = `${fromRect.left}px`;
    flyingPiece.style.top = `${fromRect.top}px`;
    flyingPiece.style.width = `${fromRect.width}px`;
    flyingPiece.style.height = `${fromRect.height}px`;
    flyingPiece.style.fontSize = window.getComputedStyle(targetPiece).fontSize;
    document.body.append(flyingPiece);

    targetPiece.style.opacity = "0";

    this.animationFrame = window.requestAnimationFrame(() => {
      flyingPiece.style.transform = `translate(${toRect.left - fromRect.left}px, ${toRect.top - fromRect.top}px)`;
    });

    window.setTimeout(() => {
      targetPiece.style.opacity = "";
      flyingPiece.remove();
    }, 260);
  }
}
