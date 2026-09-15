# Tabuleiro Digital — 1920×1080

Projeto front-end puro (HTML, CSS e JavaScript), sem bibliotecas externas.

## Como usar

1. Mantenha estes quatro arquivos na mesma pasta:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `tabuleiromaior.png`
2. Abra `index.html` em um navegador moderno.
3. Escolha a cor ativa na barra superior.
4. Clique nos círculos:
   - círculos brancos: Vilarejo, Cidade, Universidade, Zona Rural ou Metalúrgica;
   - círculos vermelhos: somente Porto.
5. Clique em um trecho pontilhado entre dois círculos para construir uma estrada.
6. `Nova partida` limpa construções/estradas e sorteia novamente os 64 números.

## Distribuição dos 64 números

A distribuição foi recalculada a partir das probabilidades de dois dados comuns de seis faces (2d6), mantendo a simetria em torno do 7 e totalizando exatamente 64 posições:

- 2: 2 vezes
- 3: 4 vezes
- 4: 5 vezes
- 5: 7 vezes
- 6: 9 vezes
- 7: 10 vezes
- 8: 9 vezes
- 9: 7 vezes
- 10: 5 vezes
- 11: 4 vezes
- 12: 2 vezes

## Funcionalidades

- Área lógica fixa em 1920×1080, responsivamente redimensionada para a tela.
- 64 posições numéricas alinhadas aos quadrados semitransparentes do novo tabuleiro.
- Malha atualizada para 49 interseções de construção e 84 trechos de estrada.
- 4 círculos vermelhos exclusivos para Porto.
- 6 cores de jogador: vermelho, azul, verde, amarelo, preto e roxo.
- Estado salvo automaticamente no `localStorage` do navegador.
- Botão de desfazer.
- Modo de tela cheia.
- Menus contextuais próximos ao ponto clicado.
- Operação por mouse, toque e teclado.
- `Esc` fecha menus; setas navegam entre opções.

## Publicação no GitHub Pages

Envie os quatro arquivos para a raiz do repositório e habilite o GitHub Pages para a branch principal.
