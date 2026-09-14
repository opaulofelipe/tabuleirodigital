# Tabuleiro Digital — 1920×1080

Projeto front-end puro (HTML, CSS e JavaScript), sem bibliotecas externas.

## Como usar

1. Mantenha estes quatro arquivos na mesma pasta:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `tabuleirodigital.png`
2. Abra `index.html` em um navegador moderno.
3. Escolha a cor ativa na barra superior.
4. Clique nos círculos:
   - círculos brancos: Vilarejo, Cidade, Universidade, Zona Rural ou Metalúrgica;
   - círculos vermelhos: somente Porto.
5. Clique em um trecho pontilhado entre dois círculos para construir uma estrada.
6. `Nova partida` limpa construções/estradas e sorteia novamente os 24 números.

## Funcionalidades

- Área lógica fixa em 1920×1080, responsivamente redimensionada para a tela.
- 6 cores de jogador: vermelho, azul, verde, amarelo, preto e roxo.
- 24 números sorteados a partir da distribuição exata solicitada.
- Estado salvo automaticamente no `localStorage` do navegador.
- Botão de desfazer.
- Modo de tela cheia.
- Menus contextuais próximos ao ponto clicado.
- Operação por mouse, toque e teclado.
- `Esc` fecha menus; setas navegam entre opções.

## Publicação no GitHub Pages

Envie os quatro arquivos para a raiz do repositório e habilite o GitHub Pages para a branch principal.
