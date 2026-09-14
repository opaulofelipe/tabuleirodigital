(() => {
  "use strict";

  const BOARD_PARTS = [
    "assets/board/board-01.b64",
    "assets/board/board-02.b64",
    "assets/board/board-03.b64",
    "assets/board/board-04.b64",
    "assets/board/board-05.b64",
    "assets/board/board-06.b64",
    "assets/board/board-07.b64",
    "assets/board/board-08.b64",
    "assets/board/board-09.b64",
    "assets/board/board-10.b64",
    "assets/board/board-11.b64",
    "assets/board/board-12.b64",
    "assets/board/board-13.b64",
    "assets/board/board-14.b64",
    "assets/board/board-15.b64"
  ];

  const NUMBER_POOL_64 = [
    2, 2,
    3, 3, 3, 3,
    4, 4, 4, 4, 4,
    5, 5, 5, 5, 5, 5, 5,
    6, 6, 6, 6, 6, 6, 6, 6, 6,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    8, 8, 8, 8, 8, 8, 8, 8, 8,
    9, 9, 9, 9, 9, 9, 9,
    10, 10, 10, 10, 10,
    11, 11, 11, 11,
    12, 12
  ];

  async function loadBoardImage() {
    const parts = await Promise.all(
      BOARD_PARTS.map(async (url) => {
        const response = await fetch(url, { cache: "force-cache" });
        if (!response.ok) throw new Error(`Falha ao carregar ${url}`);
        return (await response.text()).trim();
      })
    );

    const image = document.querySelector(".board-image");
    if (image) image.src = `data:image/webp;base64,${parts.join("")}`;
  }

  function patchApp(source) {
    let code = source;

    code = code.replace(
      'const STORAGE_KEY = "tabuleiro-digital-v1";',
      'const STORAGE_KEY = "tabuleiro-digital-v2";'
    );

    code = code.replace(
      /const NUMBER_POOL = \[[\s\S]*?\];/,
      `const NUMBER_POOL = ${JSON.stringify(NUMBER_POOL_64)};`
    );

    code = code.replace(
      'const GRID_Y = [268, 540, 814];',
      'const GRID_Y = [135, 270, 405, 540, 675, 810, 945];'
    );

    code = code.replace(
      /const PORT_ONLY = new Set\(\[[\s\S]*?\]\);/,
      'const PORT_ONLY = new Set(["p-0-0", "p-0-6", "p-6-0", "p-6-6"]);'
    );

    code = code.replace(
      'const NUMBER_X = [120, 360, 600, 840, 1080, 1320, 1560, 1800];',
      'const NUMBER_X = [169, 409, 649, 889, 1129, 1369, 1609, 1849];'
    );

    code = code.replace(
      'const NUMBER_Y = [213, 484, 756];',
      'const NUMBER_Y = [70, 205, 340, 475, 610, 745, 880, 1015];'
    );

    code = code.replace(/saved\?\.version === 1/g, 'saved?.version === 2');
    code = code.replace(/version: 1/g, 'version: 2');

    return code;
  }

  async function boot() {
    const imagePromise = loadBoardImage().catch((error) => {
      console.warn("Não foi possível carregar o novo tabuleiro; mantendo a imagem de fallback.", error);
    });

    const response = await fetch("app.js", { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível carregar app.js");

    const source = await response.text();
    const patched = patchApp(source);
    new Function(`${patched}\n//# sourceURL=app-v2-runtime.js`)();

    await imagePromise;
  }

  boot().catch((error) => {
    console.error("Falha ao iniciar o tabuleiro digital.", error);
  });
})();
