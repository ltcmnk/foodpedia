# Pack de Ilustrações SVG — Redesenho & Expansão (House Style)

**Data:** 2026-06-28
**Status:** Direção travada (via grilling) — desenho do pack em andamento, aguardando OK final antes da integração
**Substitui:** parcialmente `2026-06-28-botanical-svg-redesign-design.md` (mesmo diretório de SVGs, novo padrão visual)

## Contexto

O Foodpedia ilustra cada receita com um SVG botânico (`recipe.illustration_key` → `templates/svg/botanical/botanical_<key>.svg`). Hoje há 14 SVGs, com problemas:

1. **Estilo inconsistente** — traço fino geométrico, pouco caráter.
2. **Keys genéricas demais** — `grain` cobre lasanha + mac&cheese + shepherd's pie; `vanilla` cobre 3 sobremesas; etc. Muitas receitas recebem ilustração só aproximada.
3. **Duas fontes de verdade divergentes** — os arquivos `.svg` (renderizados via Jinja nos cards base) e um mapa inline `illustrationSVG` no `book.js` (cópias dos SVGs **antigos**, usado nos cards de resultado/favoritados). Receitas dinâmicas mostram arte velha.

## Objetivo

Redesenhar e expandir o pack para ~32 ícones num **house style coeso, desenhado à mão (gravura)**, corrigir o mapeamento receita→ícone, e unificar a fonte de verdade (Flask injeta os SVGs).

## House Style (travado via grilling)

Padrão visual de TODOS os ícones:

- **Linha dourada** (`stroke="var(--c-gold)"`, `#B07D2A`) sobre papel envelhecido. **Sem preenchimentos sólidos.**
- **Espessura variável** (~0.7 a ~1.8) — vibe de gravura desenhada à mão, não vetor frio.
- **Desenho coeso e integrado** — uma peça só; partes nascem da linha do contorno, nada flutuando solto (sem bolhas, juncos, contornos-fantasma avulsos).
- **Espaço negativo limpo** — vazios fazem parte do desenho (ex.: cauda bifurcada aberta), sem linhas internas desnecessárias.
- **Maduro, não infantil** — sem bocas/sorrisos cartoon; detalhe de gravura (ex.: olho em anel duplo).
- **Textura sugerida, não densa** — detalhe (escamas, veios, estrias) como *insinuação*, cobrindo parcialmente, deixando o corpo respirar.
- **`viewBox="0 0 120 120"`** quadrado para todos, desenho centralizado. `fill="none"`, `stroke-linecap="round"`, `stroke-linejoin="round"`.

### Referência canônica: o peixe

O peixe é o template aprovado. Características que definem o padrão: silhueta contínua, cauda bifurcada aberta (vazio negativo, sem linhas internas), sem dorsal, peitoral pequena ancorada no flanco atrás da guelra, guelra + olho de anel duplo sem boca, 3 fileiras curtas de escamas só no terço superior.

## Lista de ícones (~32)

Mantém os reaproveitáveis e adiciona especificidade. Keys em inglês, kebab/single-word.

**Frutos do mar & peixe:** `fish` · `shrimp` · `lobster` · `crab` · `octopus` · `mussels` · `fish-plate`
**Carnes:** `steak` · `sausage` · `drumstick` · `ham`
**Massas, grãos & pães:** `pasta-fork` · `noodle-bowl` · `bread` · `croissant` · `rice-bowl` · `cheese-wedge`
**Vegetais & aromáticos:** `onion` · `tomato` · `olive-branch` · `artichoke` · `corn` · `garlic` (manter) · `herbs` (manter) · `pepper` (manter) · `citrus` (manter)
**Doces:** `cake-slice` · `cupcake` · `gelato` · `donut` · `pudding-mold` · `chocolate` · `pie` · `vanilla` (manter)
**Bebidas:** `cocktail` · `tumbler` · `pitcher` · `moka` · `espresso-cup` · `wine-bottle` · `glass` (manter)
**Ferramentas & ornamentos (também enriquecem heirloom/filler pages):** `whisk` · `pot` · `rolling-pin` · `plate-setting` · `candle` · `bow` · `sun-face` · `column` · `mortar` (manter) · `cutlery` (manter)

> Lista de trabalho; a contagem final pode variar levemente. Todos no house style + 120×120.

## Mapeamento receita→ícone (corrigir)

Exemplos de correção (mapa completo definido na implementação):

| Receita | Antes | Depois |
|---|---|---|
| Lasagna, Mac & Cheese | `grain` | `cheese-wedge` / `pasta-fork` |
| Shepherd's Pie | `grain` | `pie` |
| Negroni Sbagliato | `glass` | `cocktail` |
| Whisky com Coca | `glass` | `tumbler` |
| Clericot | `glass` | `pitcher` |
| Brigadeiro | `vanilla` | `chocolate` |
| French Onion Soup | `garlic` | `onion` |
| Pho Bo, Tom Yum | `bowl` | `noodle-bowl` |

## Unificação da fonte de verdade

Eliminar o mapa `illustrationSVG` divergente do `book.js`. O Flask carrega todos os `botanical_*.svg` e os injeta na página (ex.: `<template data-illustration-key="...">` num `#svg-library` oculto). O JS lê de lá ao montar cards de resultado/favoritados. Fonte de verdade única = os arquivos `.svg`. Cobre as keys novas automaticamente.

## Fluxo de entrega (acordado com a usuária)

1. Desenhar **todos** os ícones no house style.
2. Apresentar **todos os SVGs completos numa página de preview** (como a de comparação do peixe).
3. Só após **OK final explícito**, integrar no livro: substituir/expandir os arquivos, ajustar slot do card para quadrado, mapear receitas, implementar a injeção via Flask, remover o mapa antigo.

## Não-objetivos

- Não usar bitmap/PNG — só SVG vetorial stroke.
- Não introduzir lino-cut/textura de pincel real (impossível fiel em path à mão).
- Não tocar em prompts/IA nem na lógica de receitas.
- Não integrar nada no livro antes do OK final sobre o pack completo.

## Riscos

- **Volume** — ~32 ícones detalhados é bastante; qualidade pode variar. Mitigação: o peixe é o padrão de qualidade; revisar cada um contra ele.
- **Legibilidade em tamanho pequeno** (~56px nas heirloom) — detalhe fino pode sumir. Mitigação: testar cada ícone em 56/96/180px.
- **Slot do card** muda de retrato para quadrado — ajuste de CSS pode afetar layout do card de receita. Mitigação: verificar overflow do card após a mudança.
