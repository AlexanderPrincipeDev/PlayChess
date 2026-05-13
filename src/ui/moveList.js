export function renderMoveList(
  container,
  moves,
  { activePly = moves.length, annotations = {}, onSelectPly } = {},
) {
  container.innerHTML = "";

  if (!moves.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Sin jugadas";
    container.append(empty);
    return;
  }

  for (let index = 0; index < moves.length; index += 2) {
    const row = document.createElement("div");
    row.className = "move-row";

    const number = document.createElement("span");
    number.className = "move-number";
    number.textContent = `${index / 2 + 1}.`;

    const white = createMoveButton(moves[index], index + 1, activePly, annotations, onSelectPly);

    const black = createMoveButton(moves[index + 1], index + 2, activePly, annotations, onSelectPly);

    row.append(number, white, black);
    container.append(row);
  }

  if (activePly >= moves.length) {
    container.scrollTop = container.scrollHeight;
  } else {
    container.querySelector(".move-san.active")?.scrollIntoView({ block: "nearest" });
  }
}

function createMoveButton(move, ply, activePly, annotations, onSelectPly) {
  const button = document.createElement("button");
  button.className = "move-san";
  button.type = "button";
  button.disabled = !move;
  button.classList.toggle("active", ply === activePly);
  if (move) {
    const annotation = annotations[ply] || {};
    const evalText = annotation.eval ? ` ${annotation.eval}` : "";
    button.textContent = `${move.san}${annotation.nag || ""}${evalText}`;
    if (annotation.classification) button.dataset.classification = annotation.classification;
  } else {
    button.textContent = "";
  }
  button.addEventListener("click", () => {
    if (move) onSelectPly?.(ply);
  });
  return button;
}
