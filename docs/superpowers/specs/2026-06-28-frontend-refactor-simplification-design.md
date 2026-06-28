# Refatoração & Simplificação do Frontend Foodpedia — Design

**Data:** 2026-06-28
**Status:** Aprovado (design) — aguardando plano de implementação
**Autor:** Letícia + Claude (brainstorming)

## Contexto

O Foodpedia é uma enciclopédia culinária com UI de livro físico animado (Flask + Jinja2 + Vanilla JS + GSAP, sem build step). O backend já está bem organizado (package `app/` com `config`, `routes/`, `services/`, roteador de IA Ollama+Gemini, deploy Vercel, testes pytest).

O peso morto está no **frontend monolítico**:

- `static/js/book.js` — 2867 linhas, ~40 seções, 274 funções, escopo global
- `static/css/book.css` — 2321 linhas, ~86 blocos
- `templates/index.html` — 698 linhas, com **25 handlers `onclick=` inline** que dependem de funções globais

Todo o estado do usuário é client-side (localStorage): favoritos, anotações, receitas salvas, histórico. O backend é stateless.

## Objetivo

Reduzir o frontend a módulos legíveis e isolados, **removendo código morto e duplicação**, com **comportamento idêntico garantido por testes automatizados**. Base limpa antes de qualquer feature nova futura (login, DB, receita manual — fora deste spec).

### Princípios

- Cada commit mantém a suíte Playwright verde. "Sem perder nada" é verificável, não torcida.
- A camada de IA fica **congelada**: `call_ollama`, `build_recipe_prompts`, `build_translation_prompts`, prompts Gemini e a rota `/api/recipe` não são alterados.
- Sem build step: nada de Node, bundler ou transpilação. ES modules nativos do browser.
- Pixel-idêntico: nenhuma mudança visual ou de interação.

## Decisões (resultado do grilling)

| Decisão | Escolha |
|---------|---------|
| Profundidade | Limpeza no lugar **e** modularização (duas fases) |
| Rede de segurança | Playwright primeiro (Fase 0) |
| Mecanismo de módulo | ES modules nativos (`<script type="module">`), matando os `onclick` inline |
| Backend cruft | Remover (`ask_food_v2`, rotas `/dev/*` quebradas) |
| CSS | Modularizar também (múltiplos `<link>`, ordem de cascata preservada) |
| Repo cruft | Remover (`.superpowers/sdd/`, docs obsoletos, comentários stale) |
| IA/prompts | Congelados — não tocar |
| Entrega | Spec único, 3 fases, com checkpoints de aprovação entre fases |

## Arquitetura por fases

### Fase 0 — Rede de segurança (Playwright)

Caracterizar o comportamento atual **antes** de mexer no código. Testes rodam em `?demo=true` (determinístico, sem dependência de Ollama/Gemini). Fluxos cobertos:

1. Abrir capa → endpaper → virar página → chegar no sumário
2. Navegar pelas tabs laterais (Sumário, Buscar, Receitas) e inferiores (PT/EN, ?)
3. Buscar prato demo → resultado aparece → favoritar (ribbon desce) → tab Favoritos aparece
4. Trocar idioma PT↔EN e confirmar reabertura na mesma página
5. Criar anotação (duplo clique) → arrastar → persiste após reload
6. Mobile (max-width 768px): uma página física por vez
7. Imprimir → gera as duas fichas editoriais

Esses testes são o **contrato de comportamento**. As Fases 1 e 2 rodam contra os mesmos testes sem alteração — se passam, o comportamento foi preservado.

**Checkpoint 0:** suíte verde, revisão visual única. Aprovar antes da Fase 1.

### Fase 1 — Limpeza no lugar

Remoção de código morto e ruído, **zero mudança estrutural**, ainda 1 arquivo `book.js`/`book.css`. Commits pequenos.

Inventário inicial confirmado (a auditoria completa dos 274 funções é parte da fase, e a lista final é aprovada antes de deletar):

| Alvo | Ação |
|------|------|
| `ask_food_v2` (rota retorna 410) | remover |
| `/dev/illustrations-preview` (renderiza `illustrations-preview.html` inexistente) | remover; remover `/dev/illustrations-svg` se órfã |
| `showOllamaSetup()` (0 chamadas reais) | remover |
| Comentários "Task 4/5 will implement" (5×) | resolver o stub real ou remover o ruído |
| `SPREAD_RESULTADO_FIRST`/`SPREAD_APOIO`/`SPREAD_FAVORITES_TOC` = 0 não usados | remover ou clarear |
| Funções definidas e nunca chamadas | remover (após auditoria) |
| Duplicação de helpers de escape (`escapeHtml`, `escapePrintText`, `escapeText`) | consolidar num só |
| `.superpowers/sdd/` (992K), `docs/superpowers/plans/*` obsoletos | remover do repo |

**Entregável:** inventário auditado de cada item morto, aprovado pela usuária antes da deleção.

**Checkpoint 1:** suíte Playwright + pytest verdes, revisão visual única. Aprovar antes da Fase 2.

### Fase 2 — Modularização (ES modules nativos)

`book.js` é dividido em `static/js/` com entry `<script type="module" src="main.js">`. Mapa de módulos (agrupa as ~40 seções por responsabilidade):

| Módulo | Responsabilidade |
|--------|------------------|
| `state.js` | `BookState`, constantes `SPREAD_*`, `DUR`, `reducedMotion`, `isMobileLayout`, helper de escape |
| `layout.js` | `rebuildBookLayout`, sumário/paginação, mapa único de páginas, heirloom pages, refs de página do TOC |
| `navigation.js` | `showSpread`, `animatePageTurn`, `goToSection/Next/Prev`, `navigateToSpread`, divider tabs |
| `cover.js` | checkerboard, `animateCoverOpen`, `goToCover`, `goToBackCover`, hover tilt |
| `gestures.js` | curl zones, edge arrows, swipe (touch+mouse), teclado |
| `onboarding.js` | tooltip de onboarding, `completeOnboarding`, `checkOnboarding` |
| `search.js` | fetch receita, estados de busca, provider/model selector, Gemini key, histórico, error/setup spreads |
| `result.js` | `createResultadoSpread`, `showRecipeResult`, tab/toc de resultado, `goToResultado`, `notifyRecipeReady` |
| `favorites.js` | lógica de favoritos, ribbon, spreads favoritados, tab/toc de favoritos |
| `annotations.js` | anotações editoriais + do usuário, drag, persistência |
| `i18n.js` | troca de idioma, tradução, `applyLang` |
| `print.js` | `printCurrentSpread`, `buildPrintRecipe` |
| `share.js` | `shareCurrentPage` |
| `main.js` | entry: init `DOMContentLoaded`, `resize`, e a **tabela de delegação** que substitui os 25 `onclick` inline |

**Handlers inline → delegação declarativa:** cada `onclick="fn()"` no HTML vira `data-action="fn"` (com `data-arg` quando há parâmetro, ex.: `goToSection('search')` → `data-action="goToSection" data-arg="search"`). Uma única delegação de eventos em `main.js` mapeia ação → função. O HTML fica declarativo; o JS deixa de poluir o escopo global.

**Acoplamento entre módulos:** `state.js` é a fonte compartilhada (sem dependências). Os demais importam de `state.js` e entre si por interfaces explícitas. Dependências circulares são evitadas mantendo `BookState` e constantes isoladas em `state.js`. O detalhamento da ordem de extração é responsabilidade do plano de implementação.

**CSS:** `book.css` é dividido por área e carregado via múltiplos `<link>` **na mesma ordem da cascata atual**:

`base.css` (fonts, vars `:root`, scene, paper) → `cover.css` → `spreads.css` (pages, recipe card, tipografia, ingredientes, steps, tip) → `annotations.css` → `tabs.css` (divider + bottom tabs) → `search.css` (estados de busca, model selector) → `toc.css` (sumário, apoio/colofão) → `responsive.css` (mobile) → `print.css`.

Ordem preservada = cascata preservada. Risco baixo.

**Checkpoint 2:** os **mesmos** testes da Fase 0 passam sem alteração + pytest verde + revisão visual. Fim do projeto.

## Não-objetivos (YAGNI)

- Bundler, Node, build step ou transpilação
- Qualquer mudança em prompts, modelos, roteamento de IA ou rotas `/api/*` de receita
- Features novas: login, banco de dados, persistência server-side, adicionar receitas manualmente (specs futuros separados)
- Redesenho visual ou mudança de interação — saída pixel-idêntica

## Verificação

Cada fase termina com:

- Suíte Playwright verde (escrita na Fase 0, imutável nas Fases 1 e 2)
- pytest verde (testes de backend existentes continuam passando)
- Uma revisão visual da usuária

O critério central de "comportamento preservado": a Fase 2 roda exatamente os mesmos testes da Fase 0. Se passam, o refactor não perdeu nada.

## Riscos

- **Cobertura incompleta da suíte Playwright** — se um fluxo sutil não estiver coberto, uma regressão pode passar. Mitigação: priorizar os fluxos de maior interação na Fase 0 e expandir se a revisão visual achar lacuna.
- **Cascata CSS quebrar na divisão** — mitigação: preservar a ordem exata de carregamento; diff visual antes/depois.
- **Dependências circulares entre módulos ES** — mitigação: `state.js` sem dependências como base; extração incremental com a suíte rodando.
