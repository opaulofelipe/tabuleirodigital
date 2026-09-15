(() => {
  "use strict";

  const LOGICAL_WIDTH = 1920;
  const LOGICAL_HEIGHT = 1080;
  const STORAGE_KEY = "tabuleiro-digital-v2";

  // Distribuição para 64 casas baseada nas probabilidades exatas de 2d6.
  // Em 36 resultados possíveis, as frequências são 1,2,3,4,5,6,5,4,3,2,1.
  // Para 64 casas, esta é a aproximação inteira simétrica mais próxima:
  // 2/12: 2 cada · 3/11: 4 cada · 4/10: 5 cada · 5/9: 7 cada
  // 6/8: 9 cada · 7: 10. Total = 64.
  const NUMBER_DISTRIBUTION = {
    2: 2,
    3: 4,
    4: 5,
    5: 7,
    6: 9,
    7: 10,
    8: 9,
    9: 7,
    10: 5,
    11: 4,
    12: 2,
  };

  const NUMBER_POOL = Object.entries(NUMBER_DISTRIBUTION).flatMap(([number, count]) =>
    Array.from({ length: count }, () => Number(number))
  );

  const COLORS = {
    red:    { label: "Vermelho", value: "#E5484D" },
    blue:   { label: "Azul",     value: "#3573DC" },
    green:  { label: "Verde",    value: "#2D9F68" },
    yellow: { label: "Amarelo",  value: "#F2C84B" },
    black:  { label: "Preto",    value: "#1E2024" },
    purple: { label: "Roxo",     value: "#8D58D7" },
  };

  const PIECES = {
    village:    { label: "Vilarejo",     short: "Vilarejo" },
    city:       { label: "Cidade",        short: "Cidade" },
    university: { label: "Universidade",  short: "Universidade" },
    rural:      { label: "Zona rural",    short: "Zona rural" },
    metallurgy: { label: "Metalúrgica",   short: "Metalúrgica" },
    port:       { label: "Porto",          short: "Porto" },
  };

  // Coordenadas lógicas do novo tabuleiro 1920x1080.
  // A malha possui 8 colunas x 8 linhas de áreas e, portanto,
  // 7 x 7 interseções clicáveis para construções/portos.
  const GRID_X = [240, 480, 720, 960, 1200, 1440, 1680];
  const GRID_Y = [135, 270, 405, 540, 675, 810, 945];

  // No novo tabuleiro, os quatro círculos vermelhos ficam nos cantos
  // externos da malha de interseções e aceitam apenas Porto.
  const PORT_ONLY = new Set([
    "p-0-0", "p-0-6",
    "p-6-0", "p-6-6",
  ]);

  // Centros dos 64 quadrados semitransparentes (8 x 8).
  // Medidos diretamente na arte 1920x1080 enviada pelo usuário.
  const NUMBER_X = [169, 409, 649, 889, 1129, 1369, 1609, 1849];
  const NUMBER_Y = [70, 205, 340, 475, 610, 745, 880, 1015];

  const dom = {
    stage: document.getElementById("stage"),
    roadsLayer: document.getElementById("roadsLayer"),
    pointsLayer: document.getElementById("pointsLayer"),
    numbersLayer: document.getElementById("numbersLayer"),
    colorPicker: document.getElementById("colorPicker"),
    activeColorBadge: document.getElementById("activeColorBadge"),
    undoButton: document.getElementById("undoButton"),
    newGameButton: document.getElementById("newGameButton"),
    fullscreenButton: document.getElementById("fullscreenButton"),
    contextMenu: document.getElementById("contextMenu"),
    menuEyebrow: document.getElementById("menuEyebrow"),
    menuTitle: document.getElementById("menuTitle"),
    menuItems: document.getElementById("menuItems"),
    dialogBackdrop: document.getElementById("dialogBackdrop"),
    confirmNewGame: document.getElementById("confirmNewGame"),
    cancelNewGame: document.getElementById("cancelNewGame"),
    toast: document.getElementById("toast"),
  };

  let state = loadState();
  let undoStack = [];
  let currentMenuTarget = null;
  let menuOpener = null;
  let toastTimer = null;

  init();

  function init() {
    buildColorPicker();
    renderNumbers();
    renderRoads();
    renderPoints();
    updateColorUI();
    bindGlobalEvents();
  }

  function createFreshState(selectedColor = "red") {
    return {
      version: 2,
      selectedColor,
      numbers: shuffle([...NUMBER_POOL]),
      points: {},
      roads: {},
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const validNumbers = Array.isArray(saved?.numbers)
        && saved.numbers.length === NUMBER_POOL.length
        && sameMultiset(saved.numbers, NUMBER_POOL);

      if (saved?.version === 2 && validNumbers) {
        return {
          version: 2,
          selectedColor: COLORS[saved.selectedColor] ? saved.selectedColor : "red",
          numbers: [...saved.numbers],
          points: saved.points && typeof saved.points === "object" ? saved.points : {},
          roads: saved.roads && typeof saved.roads === "object" ? saved.roads : {},
        };
      }
    } catch (error) {
      console.warn("Não foi possível carregar a partida salva.", error);
    }
    return createFreshState();
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function sameMultiset(a, b) {
    return [...a].sort((x, y) => x - y).join(",") === [...b].sort((x, y) => x - y).join(",");
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function buildColorPicker() {
    dom.colorPicker.replaceChildren();

    Object.entries(COLORS).forEach(([key, color]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "color-chip";
      button.style.setProperty("--chip-color", color.value);
      button.setAttribute("role", "radio");
      button.setAttribute("aria-label", color.label);
      button.setAttribute("aria-checked", String(state.selectedColor === key));
      button.title = color.label;

      button.addEventListener("click", () => selectColor(key));
      button.addEventListener("keydown", (event) => handleColorPickerKeys(event, key));

      dom.colorPicker.append(button);
    });
  }

  function handleColorPickerKeys(event, currentKey) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();

    const keys = Object.keys(COLORS);
    const currentIndex = keys.indexOf(currentKey);
    const delta = (event.key === "ArrowLeft" || event.key === "ArrowUp") ? -1 : 1;
    const nextKey = keys[(currentIndex + delta + keys.length) % keys.length];
    selectColor(nextKey);
    dom.colorPicker.querySelectorAll(".color-chip")[keys.indexOf(nextKey)]?.focus();
  }

  function selectColor(key) {
    if (!COLORS[key]) return;
    state.selectedColor = key;
    saveState();
    updateColorUI();
  }

  function updateColorUI() {
    const selected = COLORS[state.selectedColor];
    dom.colorPicker.querySelectorAll(".color-chip").forEach((chip, index) => {
      const key = Object.keys(COLORS)[index];
      chip.setAttribute("aria-checked", String(key === state.selectedColor));
    });

    dom.activeColorBadge.textContent = `${selected.label} ativo`;
    dom.activeColorBadge.style.setProperty("--active-color", selected.value);
    dom.undoButton.disabled = undoStack.length === 0;
  }

  function renderNumbers() {
    dom.numbersLayer.replaceChildren();
    let index = 0;

    NUMBER_Y.forEach((y) => {
      NUMBER_X.forEach((x) => {
        const number = state.numbers[index];
        const slot = document.createElement("div");
        slot.className = "number-slot";
        slot.style.left = `${(x / LOGICAL_WIDTH) * 100}%`;
        slot.style.top = `${(y / LOGICAL_HEIGHT) * 100}%`;
        slot.textContent = String(number);
        slot.setAttribute("aria-label", `Número ${number}`);
        dom.numbersLayer.append(slot);
        index += 1;
      });
    });
  }

  function renderPoints() {
    dom.pointsLayer.replaceChildren();

    GRID_Y.forEach((y, row) => {
      GRID_X.forEach((x, col) => {
        const id = `p-${row}-${col}`;
        const portOnly = PORT_ONLY.has(id);
        const placement = state.points[id];
        const button = document.createElement("button");

        button.type = "button";
        button.className = `point-hotspot${portOnly ? " port-only" : ""}${placement ? " has-piece" : ""}`;
        button.style.left = `${(x / LOGICAL_WIDTH) * 100}%`;
        button.style.top = `${(y / LOGICAL_HEIGHT) * 100}%`;
        button.dataset.id = id;
        button.dataset.kind = portOnly ? "port" : "build";
        button.setAttribute("aria-haspopup", "menu");
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-label", getPointAriaLabel(id, portOnly));

        if (placement) {
          button.append(createPieceMarker(placement.piece, placement.color));
        }

        button.addEventListener("click", (event) => {
          event.stopPropagation();
          openPointMenu(button, event.clientX, event.clientY);
        });

        button.addEventListener("keydown", (event) => {
          if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            const rect = button.getBoundingClientRect();
            openPointMenu(button, rect.right + 8, rect.top + rect.height / 2, event.key === "ArrowUp");
          }
        });

        dom.pointsLayer.append(button);
      });
    });
  }

  function getPointAriaLabel(id, portOnly) {
    const placement = state.points[id];
    if (!placement) {
      return portOnly ? "Círculo vermelho. Construir porto" : "Círculo branco. Escolher construção";
    }

    const pieceLabel = PIECES[placement.piece]?.label ?? "Construção";
    const colorLabel = COLORS[placement.color]?.label ?? "cor desconhecida";
    return `${pieceLabel}, ${colorLabel}. Clique para substituir ou remover`;
  }

  function renderRoads() {
    dom.roadsLayer.replaceChildren();
    const roads = buildRoadDefinitions();

    roads.forEach((road) => {
      const ns = "http://www.w3.org/2000/svg";
      const group = document.createElementNS(ns, "g");
      group.classList.add("road-group");
      group.dataset.id = road.id;

      const placement = state.roads[road.id];
      if (placement) {
        group.classList.add("has-road");
        const palette = getPiecePalette(placement.color);
        group.style.setProperty("--road-color", palette.fill);
        group.style.setProperty("--road-outline", palette.roadOutline);
      }

      const outline = svgLine("road-outline", road);
      const color = svgLine("road-color", road);
      const hover = svgLine("road-hover", road);
      const hit = svgLine("road-hit", road);

      hit.setAttribute("role", "button");
      hit.setAttribute("tabindex", "0");
      hit.setAttribute("aria-haspopup", "menu");
      hit.setAttribute("aria-label", placement
        ? `Estrada ${COLORS[placement.color]?.label ?? ""}. Clique para alterar ou remover`
        : "Trecho de estrada. Clique para construir");

      hit.addEventListener("click", (event) => {
        event.stopPropagation();
        openRoadMenu(hit, road.id, event.clientX, event.clientY);
      });

      hit.addEventListener("keydown", (event) => {
        if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
          event.preventDefault();
          const stageRect = dom.stage.getBoundingClientRect();
          const midX = ((road.x1 + road.x2) / 2 / LOGICAL_WIDTH) * stageRect.width + stageRect.left;
          const midY = ((road.y1 + road.y2) / 2 / LOGICAL_HEIGHT) * stageRect.height + stageRect.top;
          openRoadMenu(hit, road.id, midX, midY, event.key === "ArrowUp");
        }
      });

      group.append(outline, color, hover, hit);
      dom.roadsLayer.append(group);
    });
  }

  function buildRoadDefinitions() {
    const roads = [];

    GRID_Y.forEach((y, row) => {
      for (let col = 0; col < GRID_X.length - 1; col += 1) {
        roads.push({
          id: `rh-${row}-${col}`,
          x1: GRID_X[col],
          y1: y,
          x2: GRID_X[col + 1],
          y2: y,
        });
      }
    });

    GRID_X.forEach((x, col) => {
      for (let row = 0; row < GRID_Y.length - 1; row += 1) {
        roads.push({
          id: `rv-${col}-${row}`,
          x1: x,
          y1: GRID_Y[row],
          x2: x,
          y2: GRID_Y[row + 1],
        });
      }
    });

    return roads;
  }

  function svgLine(className, road) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", className);
    line.setAttribute("x1", road.x1);
    line.setAttribute("y1", road.y1);
    line.setAttribute("x2", road.x2);
    line.setAttribute("y2", road.y2);
    return line;
  }

  function openPointMenu(button, clientX, clientY, focusLast = false) {
    closeMenu(false);
    const id = button.dataset.id;
    const portOnly = button.dataset.kind === "port";
    const placement = state.points[id];

    currentMenuTarget = { type: "point", id, portOnly };
    menuOpener = button;
    button.setAttribute("aria-expanded", "true");

    dom.menuEyebrow.textContent = portOnly ? "Círculo vermelho" : "Círculo branco";
    dom.menuTitle.textContent = placement
      ? `${PIECES[placement.piece].label} · ${COLORS[placement.color].label}`
      : (portOnly ? "Construir porto" : "Escolha a construção");

    const options = portOnly
      ? [{ action: "piece", piece: "port" }]
      : [
          { action: "piece", piece: "village" },
          { action: "piece", piece: "city" },
          { action: "piece", piece: "university" },
          { action: "piece", piece: "rural" },
          { action: "piece", piece: "metallurgy" },
        ];

    if (placement) options.push({ action: "remove" });
    populateMenu(options);
    showMenuAt(clientX, clientY, focusLast);
  }

  function openRoadMenu(opener, roadId, clientX, clientY, focusLast = false) {
    closeMenu(false);
    const placement = state.roads[roadId];
    currentMenuTarget = { type: "road", id: roadId };
    menuOpener = opener;

    dom.menuEyebrow.textContent = "Estrada";
    dom.menuTitle.textContent = placement
      ? `Estrada · ${COLORS[placement.color].label}`
      : "Construir neste trecho";

    const options = [{ action: "road" }];
    if (placement) options.push({ action: "remove" });
    populateMenu(options);
    showMenuAt(clientX, clientY, focusLast);
  }

  function populateMenu(options) {
    dom.menuItems.replaceChildren();
    const activeColor = COLORS[state.selectedColor];

    options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `menu-item${option.action === "remove" ? " danger" : ""}`;
      button.setAttribute("role", "menuitem");

      let label = "";
      let hint = "";
      let iconName = "";

      if (option.action === "piece") {
        label = PIECES[option.piece].label;
        hint = `Construir em ${activeColor.label.toLowerCase()}`;
        iconName = option.piece;
        button.style.setProperty("--menu-accent", activeColor.value);
      } else if (option.action === "road") {
        label = state.roads[currentMenuTarget.id] ? "Aplicar cor ativa" : "Construir estrada";
        hint = activeColor.label;
        iconName = "road";
        button.style.setProperty("--menu-accent", activeColor.value);
      } else {
        label = "Remover";
        hint = "Deixar o local vazio";
        iconName = "remove";
      }

      button.innerHTML = `
        <span class="menu-icon" aria-hidden="true">${menuIconSvg(iconName)}</span>
        <span class="menu-item-text">
          <span class="menu-item-label">${label}</span>
          <span class="menu-item-hint">${hint}</span>
        </span>
      `;

      button.addEventListener("click", () => applyMenuAction(option));
      dom.menuItems.append(button);
    });
  }

  function showMenuAt(clientX, clientY, focusLast) {
    dom.contextMenu.hidden = false;
    dom.contextMenu.setAttribute("aria-hidden", "false");
    dom.contextMenu.style.left = "0px";
    dom.contextMenu.style.top = "0px";

    requestAnimationFrame(() => {
      const rect = dom.contextMenu.getBoundingClientRect();
      const gap = 10;
      let x = clientX + 10;
      let y = clientY + 8;

      if (x + rect.width + gap > window.innerWidth) x = clientX - rect.width - 10;
      if (y + rect.height + gap > window.innerHeight) y = window.innerHeight - rect.height - gap;
      if (x < gap) x = gap;
      if (y < gap) y = gap;

      dom.contextMenu.style.left = `${x}px`;
      dom.contextMenu.style.top = `${y}px`;

      const items = [...dom.contextMenu.querySelectorAll('[role="menuitem"]')];
      const target = focusLast ? items.at(-1) : items[0];
      target?.focus({ preventScroll: true });
    });
  }

  function closeMenu(returnFocus = true) {
    if (dom.contextMenu.hidden) return;

    if (menuOpener?.setAttribute) menuOpener.setAttribute("aria-expanded", "false");
    dom.contextMenu.hidden = true;
    dom.contextMenu.setAttribute("aria-hidden", "true");
    currentMenuTarget = null;

    if (returnFocus && menuOpener?.focus) {
      menuOpener.focus({ preventScroll: true });
    }
    menuOpener = null;
  }

  function applyMenuAction(option) {
    if (!currentMenuTarget) return;
    pushUndo();

    if (currentMenuTarget.type === "point") {
      const { id } = currentMenuTarget;
      if (option.action === "remove") {
        delete state.points[id];
        showToast("Construção removida.");
      } else if (option.action === "piece") {
        state.points[id] = { piece: option.piece, color: state.selectedColor };
        showToast(`${PIECES[option.piece].label} em ${COLORS[state.selectedColor].label.toLowerCase()}.`);
      }
      saveState();
      closeMenu(false);
      renderPoints();
    } else if (currentMenuTarget.type === "road") {
      const { id } = currentMenuTarget;
      if (option.action === "remove") {
        delete state.roads[id];
        showToast("Estrada removida.");
      } else {
        state.roads[id] = { color: state.selectedColor };
        showToast(`Estrada em ${COLORS[state.selectedColor].label.toLowerCase()}.`);
      }
      saveState();
      closeMenu(false);
      renderRoads();
    }

    updateColorUI();
  }

  function pushUndo() {
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > 50) undoStack.shift();
    dom.undoButton.disabled = false;
  }

  function undo() {
    const previous = undoStack.pop();
    if (!previous) return;
    state = JSON.parse(previous);
    saveState();
    renderNumbers();
    renderRoads();
    renderPoints();
    buildColorPicker();
    updateColorUI();
    showToast("Última alteração desfeita.");
  }

  function openNewGameDialog() {
    closeMenu(false);
    dom.dialogBackdrop.hidden = false;
    requestAnimationFrame(() => dom.confirmNewGame.focus());
  }

  function closeNewGameDialog() {
    dom.dialogBackdrop.hidden = true;
    dom.newGameButton.focus({ preventScroll: true });
  }

  function startNewGame() {
    state = createFreshState(state.selectedColor);
    undoStack = [];
    saveState();
    renderNumbers();
    renderRoads();
    renderPoints();
    buildColorPicker();
    updateColorUI();
    closeNewGameDialog();
    showToast("Nova partida criada e números sorteados.");
  }

  function bindGlobalEvents() {
    dom.undoButton.addEventListener("click", undo);
    dom.newGameButton.addEventListener("click", openNewGameDialog);
    dom.confirmNewGame.addEventListener("click", startNewGame);
    dom.cancelNewGame.addEventListener("click", closeNewGameDialog);
    dom.fullscreenButton.addEventListener("click", toggleFullscreen);

    dom.dialogBackdrop.addEventListener("mousedown", (event) => {
      if (event.target === dom.dialogBackdrop) closeNewGameDialog();
    });

    document.addEventListener("pointerdown", (event) => {
      if (!dom.contextMenu.hidden && !dom.contextMenu.contains(event.target)) {
        closeMenu(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (!dom.dialogBackdrop.hidden) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeNewGameDialog();
          return;
        }
        trapDialogFocus(event);
        return;
      }

      if (!dom.contextMenu.hidden) {
        handleMenuKeyboard(event);
      }
    });

    document.addEventListener("fullscreenchange", () => {
      dom.fullscreenButton.setAttribute(
        "aria-label",
        document.fullscreenElement ? "Sair da tela cheia" : "Alternar tela cheia"
      );
    });
  }

  function handleMenuKeyboard(event) {
    const items = [...dom.contextMenu.querySelectorAll('[role="menuitem"]')];
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement);

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const baseIndex = currentIndex >= 0 ? currentIndex : 0;
      items[(baseIndex + delta + items.length) % items.length].focus();
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      items[0].focus();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      items.at(-1).focus();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const delta = event.shiftKey ? -1 : 1;
      const baseIndex = currentIndex >= 0 ? currentIndex : 0;
      items[(baseIndex + delta + items.length) % items.length].focus();
    }
  }

  function trapDialogFocus(event) {
    if (event.key !== "Tab") return;
    const focusable = [dom.cancelNewGame, dom.confirmNewGame];
    const index = focusable.indexOf(document.activeElement);
    const delta = event.shiftKey ? -1 : 1;
    const next = focusable[(index + delta + focusable.length) % focusable.length];
    event.preventDefault();
    next.focus();
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch (error) {
      console.warn("Tela cheia indisponível.", error);
      showToast("O navegador não permitiu entrar em tela cheia.");
    }
  }

  function createPieceMarker(piece, colorKey) {
    const marker = document.createElement("span");
    marker.className = "piece-marker";
    const palette = getPiecePalette(colorKey);
    marker.style.setProperty("--piece-color", palette.fill);
    marker.style.setProperty("--piece-outline", palette.outline);
    marker.style.setProperty("--piece-detail", palette.detail);
    marker.innerHTML = pieceSvg(piece);
    return marker;
  }

  function getPiecePalette(colorKey) {
    const color = COLORS[colorKey]?.value ?? COLORS.red.value;
    const isDark = colorKey === "black" || colorKey === "purple" || colorKey === "blue";
    const isYellow = colorKey === "yellow";

    return {
      fill: color,
      outline: isDark ? "#F8EEDB" : "#3A2A1D",
      detail: isYellow ? "#3B2A17" : (isDark ? "#FFF4DF" : "#21170F"),
      roadOutline: colorKey === "black" ? "#F7EEDC" : "rgba(46, 33, 22, 0.94)",
    };
  }

  function pieceSvg(piece) {
    const commonStart = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle class="piece-halo" cx="32" cy="32" r="27"/>`;
    const end = `</svg>`;

    const svgs = {
      village: `${commonStart}
        <path class="piece-main" d="M16 31 32 17 48 31v18H16Z"/>
        <path class="piece-detail" d="M12 32 32 14l20 18M27 49V37h10v12"/>
      ${end}`,

      city: `${commonStart}
        <path class="piece-main" d="M13 48V29l8-6 8 6v19Zm22 0V20l8-6 8 6v28ZM27 48V34l5-4 5 4v14Z"/>
        <path class="piece-detail" d="M18 34h6M18 40h6M40 26h6M40 33h6M40 40h6"/>
      ${end}`,

      university: `${commonStart}
        <path class="piece-main" d="M12 22c7-3 13-2 20 3 7-5 13-6 20-3v26c-7-3-13-2-20 3-7-5-13-6-20-3Z"/>
        <path class="piece-detail" d="M32 25v26M17 29c5-1 9 0 12 3M35 32c3-3 7-4 12-3M17 36c5-1 9 0 12 3M35 39c3-3 7-4 12-3"/>
      ${end}`,

      rural: `${commonStart}
        <path class="piece-main" d="M16 46c5-13 13-23 29-29 3 16-3 28-17 33-5 2-9 1-12-4Z"/>
        <path class="piece-detail" d="M18 48c8-10 16-17 25-27M24 40l-2-9M31 34l-1-10M37 29l7 2M30 37l7 4"/>
      ${end}`,

      metallurgy: `${commonStart}
        <path class="piece-main" d="M14 47V31l11 6V27l11 7V22h7v15l8-4v14Z"/>
        <path class="piece-detail" d="M19 43h7v-5M31 43h7v-5M43 43h4v-5M39 22v-8h8v8"/>
      ${end}`,

      port: `${commonStart}
        <path class="piece-main" d="M28 16h8v24c0 7-4 11-10 11s-10-4-10-10h7c0 3 1 5 3 5s2-2 2-6Zm8 0h8v7h-8Z"/>
        <path class="piece-detail" d="M17 33H9m46 0h-8M20 52c4 3 8 4 12 4s8-1 12-4"/>
      ${end}`,
    };

    return svgs[piece] ?? svgs.village;
  }

  function menuIconSvg(name) {
    const icons = {
      village: `<svg viewBox="0 0 24 24"><path d="m3 11 9-7 9 7v9H3Z"/><path d="M9 20v-6h6v6"/></svg>`,
      city: `<svg viewBox="0 0 24 24"><path d="M3 20V9l4-3 4 3v11M13 20V5l4-3 4 3v15"/><path d="M6 12h2M6 16h2M16 8h2M16 12h2M16 16h2"/></svg>`,
      university: `<svg viewBox="0 0 24 24"><path d="M3 5c3-1 6 0 9 2v12c-3-2-6-3-9-2Zm18 0c-3-1-6 0-9 2v12c3-2 6-3 9-2Z"/></svg>`,
      rural: `<svg viewBox="0 0 24 24"><path d="M5 20c2-8 7-13 15-16 1 8-3 15-10 17-2 1-4 0-5-1Z"/><path d="M6 20c4-6 8-10 13-14"/></svg>`,
      metallurgy: `<svg viewBox="0 0 24 24"><path d="M3 20V10l6 4V9l6 4V6h3v7l3-2v9Z"/><path d="M6 17h3M12 17h3M18 17h1"/></svg>`,
      port: `<svg viewBox="0 0 24 24"><path d="M10 3h4v11c0 4-2 6-5 6s-5-2-5-5h3c0 1 1 2 2 2s1-1 1-3Zm4 0h4v3h-4"/><path d="M4 11H1m22 0h-3"/></svg>`,
      road: `<svg viewBox="0 0 24 24"><path d="M4 20 10 4M14 20l6-16M9 8h6M7 14h6"/></svg>`,
      remove: `<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>`,
    };
    return icons[name] ?? icons.village;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.classList.add("show");
    toastTimer = setTimeout(() => dom.toast.classList.remove("show"), 1800);
  }
})();
