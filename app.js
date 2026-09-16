(() => {
  "use strict";

  const LOGICAL_WIDTH = 1920;
  const LOGICAL_HEIGHT = 1080;
  const STORAGE_KEY = "tabuleiro-digital-v2";

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
    village: {
      label: "Vilarejo",
      short: "Vilarejo",
      image: "assets/construcoes/vilarejo.png",
    },
    city: {
      label: "Cidade",
      short: "Cidade",
      image: "assets/construcoes/cidade.png",
    },
    university: {
      label: "Universidade",
      short: "Universidade",
      image: "assets/construcoes/universidade.png",
    },
    rural: {
      label: "Zona rural",
      short: "Zona rural",
      image: "assets/construcoes/zona-rural.png",
    },
    metallurgy: {
      label: "Metalúrgica",
      short: "Metalúrgica",
      image: "assets/construcoes/metalurgica.png",
    },
    port: {
      label: "Porto",
      short: "Porto",
      image: "assets/construcoes/porto.png",
    },
  };

  const GRID_X = [240, 480, 720, 960, 1200, 1440, 1680];
  const GRID_Y = [135, 270, 405, 540, 675, 810, 945];

  const PORT_ONLY = new Set([
    "p-0-0", "p-0-6",
    "p-6-0", "p-6-6",
  ]);

  const NUMBER_X = [169, 409, 649, 889, 1129, 1369, 1609, 1849];
  const NUMBER_Y = [70, 205, 340, 475, 610, 745, 880, 1015];

  const dom = {
    stage: document.getElementById("stage"),
    roadsLayer: document.getElementById("roadsLayer"),
    pointsLayer: document.getElementById("pointsLayer"),
    numbersLayer: document.getElementById("numbersLayer"),

    colorPicker: document.getElementById("colorPicker"),
    undoButton: document.getElementById("undoButton"),
    newGameButton: document.getElementById("newGameButton"),
    fullscreenButton: document.getElementById("fullscreenButton"),
    rollDiceButton: document.getElementById("rollDiceButton"),
    diceResult: document.getElementById("diceResult"),
    diceOverlay: document.getElementById("diceOverlay"),

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
  let diceCleanupTimer = null;
  let diceRollInProgress = false;

  init();

  function init() {
    preloadPieceImages();
    buildColorPicker();
    renderNumbers();
    renderRoads();
    renderPoints();
    updateColorUI();
    bindGlobalEvents();
  }

  function preloadPieceImages() {
    Object.values(PIECES).forEach((piece) => {
      const image = new Image();
      image.src = piece.image;
    });
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
      return portOnly
        ? "Círculo vermelho. Construir porto"
        : "Círculo branco. Escolher construção";
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
      hit.setAttribute(
        "aria-label",
        placement
          ? `Estrada ${COLORS[placement.color]?.label ?? ""}. Clique para alterar ou remover`
          : "Trecho de estrada. Clique para construir"
      );

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
      let iconMarkup = "";

      if (option.action === "piece") {
        const piece = PIECES[option.piece];
        label = piece.label;
        hint = `Construir em ${activeColor.label.toLowerCase()}`;
        button.style.setProperty("--menu-accent", activeColor.value);
        iconMarkup = `
          <span class="menu-icon menu-icon-piece" aria-hidden="true">
            <span class="menu-piece-ring"></span>
            <img class="menu-piece-image" src="${piece.image}" alt="" draggable="false">
          </span>
        `;
      } else if (option.action === "road") {
        label = state.roads[currentMenuTarget.id] ? "Aplicar cor ativa" : "Construir estrada";
        hint = activeColor.label;
        button.style.setProperty("--menu-accent", activeColor.value);
        iconMarkup = `
          <span class="menu-icon" aria-hidden="true">${menuUtilitySvg("road")}</span>
        `;
      } else {
        label = "Remover";
        hint = "Deixar o local vazio";
        iconMarkup = `
          <span class="menu-icon" aria-hidden="true">${menuUtilitySvg("remove")}</span>
        `;
      }

      button.innerHTML = `
        ${iconMarkup}
        <span class="menu-item-text">
          <span class="menu-item-label">${label}</span>
          <span class="menu-item-hint">${hint}</span>
        </span>
      `;

      const menuImage = button.querySelector(".menu-piece-image");
      if (menuImage) {
        menuImage.addEventListener("error", () => {
          menuImage.hidden = true;
          menuImage.closest(".menu-icon-piece")?.classList.add("image-error");
        });
      }

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

    if (menuOpener?.setAttribute) {
      menuOpener.setAttribute("aria-expanded", "false");
    }

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
        state.points[id] = {
          piece: option.piece,
          color: state.selectedColor,
        };
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
    clearDiceResult(true);
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
    dom.rollDiceButton.addEventListener("click", rollDice);

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
      const isFullscreen = Boolean(document.fullscreenElement);
      dom.fullscreenButton.setAttribute(
        "aria-label",
        isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"
      );
      dom.fullscreenButton.title = isFullscreen ? "Sair da tela cheia" : "Tela cheia";
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

  function rollD6() {
    if (globalThis.crypto?.getRandomValues) {
      const range = 0x100000000;
      const limit = Math.floor(range / 6) * 6;
      const buffer = new Uint32Array(1);
      let value;

      do {
        globalThis.crypto.getRandomValues(buffer);
        value = buffer[0];
      } while (value >= limit);

      return (value % 6) + 1;
    }

    return Math.floor(Math.random() * 6) + 1;
  }

  function setDieFace(die, value) {
    const layouts = {
      1: [5],
      2: [1, 9],
      3: [1, 5, 9],
      4: [1, 3, 7, 9],
      5: [1, 3, 5, 7, 9],
      6: [1, 3, 4, 6, 7, 9],
    };

    const active = new Set(layouts[value] ?? layouts[1]);
    die.replaceChildren();

    for (let position = 1; position <= 9; position += 1) {
      const pip = document.createElement("span");
      pip.className = `die-pip${active.has(position) ? " visible" : ""}`;
      die.append(pip);
    }

    die.dataset.value = String(value);
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function createRollingDie(size) {
    const die = document.createElement("div");
    die.className = "rolling-die";
    die.style.width = `${size}px`;
    die.style.height = `${size}px`;
    setDieFace(die, rollD6());
    dom.diceOverlay.append(die);
    return die;
  }

  function animateDie(die, start, finish, boardRect, finalValue, index) {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const duration = reducedMotion ? 360 : 1850 + index * 120;
    const size = die.getBoundingClientRect().width || 64;
    const margin = Math.max(12, size * 0.25);
    const minX = boardRect.left + margin;
    const maxX = boardRect.right - size - margin;
    const minY = boardRect.top + margin;
    const maxY = boardRect.bottom - size - margin;

    const bounce1 = {
      x: randomBetween(minX, maxX),
      y: randomBetween(minY, maxY),
    };
    const bounce2 = {
      x: randomBetween(minX, maxX),
      y: randomBetween(minY, maxY),
    };
    const bounce3 = {
      x: randomBetween(minX, maxX),
      y: randomBetween(minY, maxY),
    };

    const r1 = randomBetween(-420, 420);
    const r2 = r1 + randomBetween(360, 760);
    const r3 = r2 + randomBetween(-700, 700);
    const r4 = r3 + randomBetween(420, 900);

    const frame = (point, rotation, scale = 1) => ({
      transform: `translate3d(${point.x}px, ${point.y}px, 0) rotate(${rotation}deg) scale(${scale})`,
    });

    const keyframes = reducedMotion
      ? [frame(start, 0, 0.82), frame(finish, r4, 1)]
      : [
          { ...frame(start, 0, 0.76), offset: 0 },
          { ...frame(bounce1, r1, 1.08), offset: 0.22 },
          { ...frame(bounce2, r2, 0.93), offset: 0.46 },
          { ...frame(bounce3, r3, 1.06), offset: 0.68 },
          { ...frame({ x: finish.x, y: finish.y - size * 0.16 }, r4 - 70, 1.04), offset: 0.88 },
          { ...frame(finish, r4, 1), offset: 1 },
        ];

    if (typeof die.animate !== "function") {
      die.style.transform = `translate3d(${finish.x}px, ${finish.y}px, 0)`;
      setDieFace(die, finalValue);
      die.classList.add("settled");
      return Promise.resolve();
    }

    const faceTimer = setInterval(() => setDieFace(die, rollD6()), reducedMotion ? 120 : 85);
    const animation = die.animate(keyframes, {
      duration,
      easing: reducedMotion ? "ease-out" : "cubic-bezier(.16,.72,.22,1)",
      fill: "forwards",
    });

    return animation.finished.catch(() => null).then(() => {
      clearInterval(faceTimer);
      setDieFace(die, finalValue);
      die.classList.add("settled");
    });
  }

  function clearDiceResult(immediate = false) {
    if (diceCleanupTimer) {
      clearTimeout(diceCleanupTimer);
      diceCleanupTimer = null;
    }

    if (!dom.diceOverlay.children.length && dom.diceResult.hidden) return;

    const finish = () => {
      dom.diceOverlay.replaceChildren();
      dom.diceOverlay.classList.remove("is-clearing");
      dom.diceResult.hidden = true;
      dom.diceResult.classList.remove("is-clearing");
      dom.diceResult.textContent = "";
    };

    if (immediate) {
      finish();
      return;
    }

    dom.diceOverlay.classList.add("is-clearing");
    dom.diceResult.classList.add("is-clearing");
    setTimeout(finish, 320);
  }

  async function rollDice() {
    if (diceRollInProgress) return;

    diceRollInProgress = true;
    dom.rollDiceButton.disabled = true;
    clearDiceResult(true);
    closeMenu(false);

    const resultA = rollD6();
    const resultB = rollD6();
    const total = resultA + resultB;

    const boardRect = dom.stage.getBoundingClientRect();
    const buttonRect = dom.rollDiceButton.getBoundingClientRect();
    const dieSize = Math.min(54, Math.max(34, boardRect.width * 0.03));

    const startCenterX = buttonRect.left + buttonRect.width / 2 - dieSize / 2;
    const startCenterY = buttonRect.top + buttonRect.height / 2 - dieSize / 2;

    const dieA = createRollingDie(dieSize);
    const dieB = createRollingDie(dieSize);

    const startA = { x: startCenterX - dieSize * 0.18, y: startCenterY };
    const startB = { x: startCenterX + dieSize * 0.18, y: startCenterY };

    const finalA = {
      x: boardRect.left + boardRect.width * randomBetween(0.18, 0.40) - dieSize / 2,
      y: boardRect.top + boardRect.height * randomBetween(0.28, 0.72) - dieSize / 2,
    };
    const finalB = {
      x: boardRect.left + boardRect.width * randomBetween(0.60, 0.82) - dieSize / 2,
      y: boardRect.top + boardRect.height * randomBetween(0.28, 0.72) - dieSize / 2,
    };

    try {
      await Promise.all([
        animateDie(dieA, startA, finalA, boardRect, resultA, 0),
        animateDie(dieB, startB, finalB, boardRect, resultB, 1),
      ]);

      dom.diceResult.hidden = false;
      dom.diceResult.textContent = `${resultA} + ${resultB} = ${total}`;
      dom.diceResult.setAttribute("aria-label", `Resultado dos dados: ${resultA} mais ${resultB}, total ${total}`);

      diceCleanupTimer = setTimeout(() => {
        clearDiceResult(false);
      }, 10000);
    } finally {
      diceRollInProgress = false;
      dom.rollDiceButton.disabled = false;
    }
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
      showToast("O navegador não permitiu alterar a tela cheia.");
    }
  }

  function createPieceMarker(pieceKey, colorKey) {
    const piece = PIECES[pieceKey] ?? PIECES.village;
    const playerColor = COLORS[colorKey]?.value ?? COLORS.red.value;

    const marker = document.createElement("span");
    marker.className = "piece-marker piece-marker-image";
    marker.style.setProperty("--player-color", playerColor);

    const image = document.createElement("img");
    image.className = "piece-image";
    image.src = piece.image;
    image.alt = "";
    image.draggable = false;

    const fallback = document.createElement("span");
    fallback.className = "piece-fallback";
    fallback.textContent = piece.short.slice(0, 1).toUpperCase();
    fallback.setAttribute("aria-hidden", "true");

    const ownerDot = document.createElement("span");
    ownerDot.className = "piece-owner-dot";
    ownerDot.setAttribute("aria-hidden", "true");

    image.addEventListener("error", () => {
      marker.classList.add("image-error");
      image.hidden = true;
    });

    marker.append(image, fallback, ownerDot);
    return marker;
  }

  function getPiecePalette(colorKey) {
    const color = COLORS[colorKey]?.value ?? COLORS.red.value;

    return {
      fill: color,
      roadOutline: colorKey === "black"
        ? "#F7EEDC"
        : "rgba(46, 33, 22, 0.94)",
    };
  }

  function menuUtilitySvg(name) {
    const icons = {
      road: `
        <svg viewBox="0 0 24 24">
          <path d="M4 20 10 4M14 20l6-16M9 8h6M7 14h6"/>
        </svg>
      `,
      remove: `
        <svg viewBox="0 0 24 24">
          <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>
        </svg>
      `,
    };

    return icons[name] ?? icons.road;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.classList.add("show");
    toastTimer = setTimeout(() => dom.toast.classList.remove("show"), 1800);
  }
})();
