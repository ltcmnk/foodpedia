# Resultados & Favoritos Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old single `data-role="result"` + persistent `saved` system with an ephemeral per-search `data-role="resultado"` system where persistence is controlled exclusively by the ◆ ribbon, which saves the full recipe object and creates a `data-role="favorited-result"` spread in `#favoritos-container`.

**Architecture:** `#resultado-container` holds ephemeral spreads that vanish on reload; `#favoritos-container` holds persistent spreads rebuilt from `fp_favorited_recipes` in localStorage. The static `data-role="result"` spread and `#saved-spreads-container` are removed entirely. Resultado spreads have scrollable pages (no continuation spread needed). The Favorites TOC spread (`buildFavoritesTocSpread`) is extended to list both base and AI-favorited recipes.

**Note on Spec 3 Section 4:** The continuation-spread removal and scroll behavior specified in the Vercel Deploy UX plan (Spec 3 Section 4) are integrated here because both specs touch the result system. The Vercel Deploy UX plan's Task 2 should be skipped — this plan supersedes it.

**Tech Stack:** Vanilla JS + GSAP 3, CSS custom properties, Jinja2 HTML templates.

## Global Constraints

- All CSS custom properties already defined: `var(--c-page)`, `var(--c-page-alt)`, `var(--c-ink)`, `var(--c-ink-faded)`, `var(--c-gold)`, `var(--c-rule)`, `var(--c-border)`, `var(--c-cover-red)`, `var(--c-red-accent)`, `var(--c-annotation)`.
- Fonts in use: `'Homemade Apple'`, `'La Belle Aurore'`, `'Indie Flower'`, `'Cedarville Cursive'`, `'Grape Nuts'`, `'EB Garamond'`, `'Kalam'`. Never add new @import.
- GSAP is loaded via CDN; use `gsap.to()` / `gsap.fromTo()` for animations.
- `reducedMotion` constant already defined in `book.js` — always use `reducedMotion ? 0.001 : <duration>` for all new GSAP calls.
- localStorage keys: `fp_favorites` (existing — array of keys), `fp_favorited_recipes` (new — array of `{id, recipe, lang}`). Remove `fp_saved_recipes`.
- `spreadKey()` must return a stable string for every spread type — used as the key in `fp_favorites`.
- `rebuildBookLayout()` is the single source of truth for spread ordering — all new spread types must be registered there.
- `illustrationSVG` map already exists in `book.js` (7 keys: herbs, grain, bowl, vanilla, citrus, spice, mortar).
- No backend changes in this plan.

---

### Task 1: Remove old result/saved system from HTML

**Files:**
- Modify: `templates/index.html`

**Interfaces:**
- Removes: `[data-role="result"]` static spread (lines ~320–388)
- Removes: `<div id="result-continuation-container"></div>` (line ~389)
- Removes: `<div id="saved-spreads-container"></div>` (line ~520)
- Removes: "Salvar no livro" button inside the result spread
- Adds: `<div id="resultado-container"></div>` and `<div id="favoritos-container"></div>`
- Changes: Resultado tab onclick to `goToResultado()` instead of `goToSection('result')`
- Removes: `#tab-saved` div-tab button

- [ ] **Step 1: Remove the static result spread from `templates/index.html`**

Find and remove the entire block from (around line 320):
```html
      <!-- ── SPREAD 20: RESULTADO ── -->
      <div class="book-spread" data-role="result">
```
through its closing `</div>` (around line 388). The block ends just before `<div id="result-continuation-container"></div>`.

The entire block to remove:
```html
      <!-- ── SPREAD 20: RESULTADO ── -->
      <div class="book-spread" data-role="result">
        ...entire result spread...
      </div>
```

- [ ] **Step 2: Remove `#result-continuation-container`**

Remove this line (immediately after the result spread):
```html
      <div id="result-continuation-container"></div>
```

- [ ] **Step 3: Remove `#saved-spreads-container`, add new containers**

Find (around line 520):
```html
      <!-- Spreads de receitas salvas são injetados aqui dinamicamente pelo JS -->
      <div id="saved-spreads-container"></div>
```

Replace with:
```html
      <!-- Spreads efêmeros de resultado (por sessão) -->
      <div id="resultado-container"></div>

      <!-- Spreads de receitas AI favoritadas (persistidos) -->
      <div id="favoritos-container"></div>
```

- [ ] **Step 4: Change Resultado tab onclick and remove Salvas tab**

Find the divider tabs section (around line 547). Change the resultado tab from:
```html
      <button class="div-tab" type="button" data-section="result" onclick="goToSection('result')" style="display:none;">
        <div class="dt-body" style="background:#6A8878"></div>
        <div class="dt-tag" style="background:#6A8878"><span class="dt-lbl" data-i18n="nav_result">Resultado</span></div>
      </button>
```
to:
```html
      <button class="div-tab" type="button" id="tab-resultado" data-section="resultado" onclick="goToResultado()" style="display:none;">
        <div class="dt-body" style="background:#6A8878"></div>
        <div class="dt-tag" style="background:#6A8878"><span class="dt-lbl" data-i18n="nav_result">Resultado</span></div>
      </button>
```

Remove the entire Salvas tab button:
```html
      <button class="div-tab" type="button" id="tab-saved" data-section="saved" onclick="goToSection('saved')" style="display:none;">
        <div class="dt-body" style="background:#7080A0"></div>
        <div class="dt-tag" style="background:#7080A0">
          <span class="dt-lbl" data-i18n="nav_saved">Salvas</span>
        </div>
      </button>
```

- [ ] **Step 5: Commit HTML changes**

```bash
git add templates/index.html
git commit -m "refactor: remove old result/saved spreads, add resultado/favoritos containers"
```

---

### Task 2: CSS — remove old, add new

**Files:**
- Modify: `static/css/book.css`

**Interfaces:**
- Removes: `.result-continuation-card`, `.continuation-title`, `.continuation-ornament`, `.continues-hint`, `[data-role="result"].is-translating` rules
- Adds: styles for `[data-role="resultado"]` pages with scrollable content, `[data-role="favorited-result"]`, `[data-role="resultado-toc"]`, `.resultado-micro-hint`, `.resultado-ephemeral-entry`

- [ ] **Step 1: Remove old result CSS**

In `static/css/book.css`, find and remove:

The `[data-role="result"].is-translating` block (around line 1227):
```css
[data-role="result"].is-translating .recipe-card-border,
[data-role="result"].is-translating .handwritten-annotation,
```
Remove that entire rule block.

The `.result-continuation-card` block (around line 1235):
```css
.result-continuation-card {
  overflow:hidden;
}
.continuation-title {
  ...
}
.continuation-ornament {
  ...
}
.continuation-ornament svg { ... }
```
Remove all of these.

Also remove `.continues-hint` if present:
```css
.continues-hint { ... }
```

- [ ] **Step 2: Add CSS for resultado spreads (scrollable pages)**

After the `/* RESULT */` section comment (or at end of existing result CSS area), add:

```css
/* ── RESULTADO (ephemeral AI result spreads) ── */
[data-role="resultado"] .page-left,
[data-role="resultado"] .page-right,
[data-role="favorited-result"] .page-left,
[data-role="favorited-result"] .page-right {
  overflow-y: auto;
  scrollbar-width: none;
}
[data-role="resultado"] .page-left::-webkit-scrollbar,
[data-role="resultado"] .page-right::-webkit-scrollbar,
[data-role="favorited-result"] .page-left::-webkit-scrollbar,
[data-role="favorited-result"] .page-right::-webkit-scrollbar {
  display: none;
}
[data-role="resultado"] .recipe-card-border,
[data-role="favorited-result"] .recipe-card-border {
  box-shadow: inset -2px 0 0 var(--c-border);
}

/* ── RESULTADO-TOC (mini-TOC of session searches) ── */
[data-role="resultado-toc"] .page-right {
  overflow-y: auto;
  scrollbar-width: none;
}
[data-role="resultado-toc"] .page-right::-webkit-scrollbar { display: none; }

/* ── RESULTADO MICRO-HINT (first result, session-once) ── */
.resultado-micro-hint {
  font-family: 'Indie Flower', cursive;
  font-size: 10px;
  color: var(--c-ink-faded);
  letter-spacing: 0.5px;
  margin-top: 8px;
  opacity: 1;
  text-align: center;
}

/* ── FAVORITED-RESULT actions ── */
.resultado-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.back-to-search-btn {
  font-family: 'Indie Flower', cursive;
  font-size: 12px;
  color: var(--c-ink-faded);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-align: left;
}

/* TOC entries for resultado (ephemeral — italic, lighter) */
.toc-entry.toc-resultado-entry .toc-entry-title {
  font-style: italic;
  color: var(--c-ink-faded);
}
```

- [ ] **Step 3: Commit CSS**

```bash
git add static/css/book.css
git commit -m "refactor: remove continuation CSS, add resultado/favorited-result scroll styles"
```

---

### Task 3: JS cleanup — remove old functions

**Files:**
- Modify: `static/js/book.js`

**Interfaces:**
- Removes: `savedRecipes()`, `saveCurrentRecipe()`, `deleteSavedRecipe()`, `saveAnnotation()`, `rebuildSavedSpreads()`, `updateTOCSavedSection()`, `filterSavedRecipes()`, `showSavedTab()`, `hideSavedTab()`, `extractOverflowItems()`, `ensureResultPagination()`, `populateResultSpread()`
- Removes: `MAX_SAVED` constant, all `fp_saved_recipes` localStorage reads/writes
- Modifies: `spreadKey()` — remove `result-continuation` branch
- Modifies: `rebuildBookLayout()` — remove `saved` and `result`/`resultContinuations` references
- Modifies: `updateDividerTabs()` — remove `result-continuation` and `saved`
- Modifies: `syncConditionalNavigation()` — remove `resultTab` show/hide (will be handled by new function)
- Modifies: `currentPrintableRecipe()` — remove `result-continuation` branch
- Modifies: `showRecipeResult()` — remove (replaced by new flow in Task 4)
- Modifies: `notifyRecipeReady()` — remove (replaced in Task 5)
- Modifies: `startRecipeSearch()` — remove `ensureResultPagination` calls
- Modifies: `syncShareTab()` — remove `result-continuation` from visible roles
- Modifies: `persistCurrentRecipeTranslation()` — remove saved recipes persistence

- [ ] **Step 1: Remove `savedRecipes()` function**

Find and remove:
```js
function savedRecipes() {
  try {
    return JSON.parse(localStorage.getItem('fp_saved_recipes') || '[]')
  } catch {
    return []
  }
}
```

- [ ] **Step 2: Remove `populateResultSpread()`**

Find and remove the entire `populateResultSpread(recipe)` function (lines ~1185–1224).

- [ ] **Step 3: Remove `extractOverflowItems()` and `ensureResultPagination()`**

Find and remove:
```js
function extractOverflowItems(list, card, minItems) { ... }
```
And:
```js
function ensureResultPagination(recipe) { ... }
```

- [ ] **Step 4: Remove `MAX_SAVED` constant and saved recipe functions**

Remove `const MAX_SAVED = 10` (around line 1679).

Remove entire functions:
- `saveCurrentRecipe()`
- `deleteSavedRecipe(id)`
- `saveAnnotation(id, text)`
- `rebuildSavedSpreads()`
- `updateTOCSavedSection()`
- `filterSavedRecipes(query)`
- `showSavedTab()`
- `hideSavedTab()`

- [ ] **Step 5: Remove `SPREAD_RESULT`, `SPREAD_SAVED_START` declarations, add placeholders**

At the top of `book.js` (around lines 11–23), change:

```js
let SPREAD_RESULT = 10
```
to:
```js
let SPREAD_RESULTADO_FIRST = 0   // first resultado spread index (0 = none)
```

Remove:
```js
let SPREAD_SAVED_START = 29
```

- [ ] **Step 6: Update `spreadKey()`**

Find `spreadKey` function. Change:
```js
  if (spread.dataset.role === 'result' || spread.dataset.role === 'result-continuation') {
    return 'result:current'
  }
```
to:
```js
  if (spread.dataset.role === 'resultado') return `resultado:${spread.dataset.resultadoId || ''}`
  if (spread.dataset.role === 'favorited-result') return `favresult:${spread.dataset.favresultId || ''}`
  if (spread.dataset.role === 'resultado-toc') return 'resultado-toc'
```

- [ ] **Step 7: Update `rebuildBookLayout()`**

Find `rebuildBookLayout`. Remove these lines:
```js
  const result = document.querySelector('[data-role="result"]')
  const resultContinuations = [...document.querySelectorAll('[data-role="result-continuation"]')]
```
and:
```js
  const saved = [...document.querySelectorAll('[data-role="saved"]')]
```

Remove from conditional:
```js
  if (BookState.resultAvailable && result) conditional.push(result, ...resultContinuations)
```
(delete the entire line)

Change the layout array from:
```js
  const layout = [
    endpaper,
    ...comoUsar,
    ...tocSpreads,
    favTocSpread,
    search,
    ...recipes,
    ...conditional,
    ...saved,
  ].filter(Boolean)
```
to:
```js
  const resultados = [...document.querySelectorAll('#resultado-container > .book-spread')]
  const favoritos  = [...document.querySelectorAll('#favoritos-container > .book-spread')]

  const layout = [
    endpaper,
    ...comoUsar,
    ...tocSpreads,
    favTocSpread,
    search,
    ...recipes,
    ...conditional,
    ...resultados,
    ...favoritos,
  ].filter(Boolean)
```

Update the constants block after layout is built. Remove:
```js
  SPREAD_RESULT = layoutIndex(result)
  SPREAD_SAVED_START = Number(saved[0]?.dataset.spread || (SPREAD_SETUP + 1))
```
Add:
```js
  SPREAD_RESULTADO_FIRST = resultados.length ? layoutIndex(resultados[0]) : 0
```

Update `SECTION_SPREADS`:
```js
  Object.assign(SECTION_SPREADS, {
    toc: SPREAD_TOC,
    search: SPREAD_SEARCH,
    recipes: SPREAD_RECIPES_START,
    resultado: SPREAD_RESULTADO_FIRST,
    favorites: SPREAD_FAVORITES_TOC || SPREAD_TOC,
  })
```
(Remove `result` and `saved` keys.)

- [ ] **Step 8: Update `syncConditionalNavigation()`**

Find:
```js
function syncConditionalNavigation() {
  const resultTab = document.querySelector('[data-section="result"]')
  if (resultTab) resultTab.style.display = BookState.resultAvailable ? 'flex' : 'none'
  syncFavoritesTab()
  syncShareTab()
}
```
Replace with:
```js
function syncConditionalNavigation() {
  syncResultadoTab()
  syncFavoritesTab()
  syncShareTab()
}
```
(The `syncResultadoTab()` function is added in Task 5.)

- [ ] **Step 9: Update `updateDividerTabs()`**

Find:
```js
  else if (role === 'result' || role === 'result-continuation' || role === 'error' || role === 'setup') section = 'result'
  else if (role === 'saved')         section = 'saved'
  else if (role === 'favorites-toc') section = 'favorites'
```
Replace with:
```js
  else if (role === 'resultado' || role === 'resultado-toc' || role === 'favorited-result' || role === 'error' || role === 'setup') section = 'resultado'
  else if (role === 'favorites-toc') section = 'favorites'
```

- [ ] **Step 10: Update `syncShareTab()`**

Find:
```js
  const visible = ['base-recipe', 'result', 'result-continuation'].includes(role)
```
Replace with:
```js
  const visible = ['base-recipe', 'resultado', 'favorited-result'].includes(role)
```

- [ ] **Step 11: Update `currentPrintableRecipe()`**

Find:
```js
  if (spread.dataset.role === 'result' || spread.dataset.role === 'result-continuation') {
    return BookState.currentRecipeVariants[currentLang] || BookState.currentRecipe
  }
  if (spread.dataset.role === 'saved') {
    const entry = savedRecipes().find(item => item.id === spread.dataset.savedId)
    if (!entry) return null
    const recipe = entry.variants?.[currentLang] || entry.recipe
    return { ...recipe, userAnnotation: entry.userAnnotation || '' }
  }
```
Replace with:
```js
  if (spread.dataset.role === 'resultado' || spread.dataset.role === 'favorited-result') {
    return BookState.currentRecipeVariants[currentLang] || BookState.currentRecipe
  }
```

- [ ] **Step 12: Remove `showRecipeResult()` and `notifyRecipeReady()` bodies**

Find `showRecipeResult(recipe)` and replace its body with a stub (will be replaced in Task 5):
```js
function showRecipeResult(recipe) {
  // replaced in Task 5 — createResultadoSpread
  notifyRecipeReady(recipe)
}
```

Find `notifyRecipeReady(recipe)` and replace its body with a stub:
```js
function notifyRecipeReady(recipe) {
  // replaced in Task 5
}
```

- [ ] **Step 13: Remove `fp_saved_recipes` from `persistCurrentRecipeTranslation()`**

Find `persistCurrentRecipeTranslation`. Remove the block that references `savedRecipes()` and `fp_saved_recipes`. Keep only the history block.

- [ ] **Step 14: Update `tocEntries()`**

Find `tocEntries()`. Remove the saved section block:
```js
  const saved = savedRecipes()
  if (saved.length) {
    entries.push({ type: 'section', labelKey: 'toc_saved', ... })
    entries.push({ type: 'filter', weight: 1.4 })
    saved.forEach(entry => { ... })
  }
```

Replace with:
```js
  // Ephemeral resultado entries (session only)
  const resultadoSpreads = [...document.querySelectorAll('#resultado-container [data-role="resultado"]')]
  if (resultadoSpreads.length) {
    entries.push({ type: 'section', labelKey: 'toc_resultado', fallback: 'Pesquisadas', targetRole: 'resultado', weight: 1.2 })
    resultadoSpreads.forEach(spread => {
      const key = spreadKey(spread)
      entries.push({
        type: 'link',
        subtype: 'resultado',
        label: spread.dataset.recipeName || '',
        targetKey: key,
        favorite: false,
        weight: 1,
      })
    })
  }

  // Persistent favorited AI recipes
  const favoritadoSpreads = [...document.querySelectorAll('#favoritos-container [data-role="favorited-result"]')]
  if (favoritadoSpreads.length) {
    favoritadoSpreads.forEach(spread => {
      const key = spreadKey(spread)
      entries.push({
        type: 'link',
        subtype: 'favorited',
        label: spread.dataset.recipeName || '',
        targetKey: key,
        favorite: favorites.includes(key),
        weight: 1,
      })
    })
  }
```

- [ ] **Step 15: Remove saved-search-input from `tocPage()`**

Find in `tocPage()` where `type === 'filter'` generates a search input. Remove that branch entirely (the `if (entry.type === 'filter')` block returning the filter row), since we no longer have the saved recipe filter.

- [ ] **Step 16: Update `loadFavorites()` and `DOMContentLoaded` init**

Find `document.addEventListener('DOMContentLoaded', ...)`. Remove:
```js
  rebuildSavedSpreads()
  rebuildBookLayout()
  const saved = JSON.parse(localStorage.getItem('fp_saved_recipes') || '[]')
  if (saved.length) showSavedTab()
```
Replace with:
```js
  rebuildFavoritadoSpreads()  // will be added in Task 4
  rebuildBookLayout()
```

- [ ] **Step 17: Verify the app still loads without errors**

```bash
cd /Users/iuk/foodpedia && .venv/bin/python -m flask --app app run --debug
```

Open http://localhost:5000, open the book, navigate through the TOC and search pages. Expect no JS console errors. The Resultado and Salvas tabs should be gone. The Favoritos tab may still show if localStorage has favorites.

- [ ] **Step 18: Commit JS cleanup**

```bash
git add static/js/book.js
git commit -m "refactor: remove old result/saved JS system, stub out new functions"
```

---

### Task 4: Core new JS — createResultadoSpread and rebuild

**Files:**
- Modify: `static/js/book.js`

**Interfaces:**
- Produces: `createResultadoSpread(recipe) → HTMLElement` — creates a `[data-role="resultado"]` spread and appends it to `#resultado-container`
- Produces: `rebuildFavoritadoSpreads()` — reads `fp_favorited_recipes` and rebuilds `#favoritos-container`
- Produces: `createFavoritadoSpread(entry) → HTMLElement` where `entry = {id, recipe, lang}`

- [ ] **Step 1: Add `favoritedRecipes()` helper**

After the `favoriteKeys()` function, add:

```js
function favoritedRecipes() {
  try {
    return JSON.parse(localStorage.getItem('fp_favorited_recipes') || '[]')
  } catch {
    return []
  }
}
```

- [ ] **Step 2: Add `createResultadoSpread(recipe)`**

After `favoritedRecipes()`, add:

```js
function createResultadoSpread(recipe) {
  const host = document.getElementById('resultado-container')
  if (!host) return null

  const id = `resultado-${Date.now()}`
  const lang = currentLang
  const labels = lang === 'en'
    ? { prep: 'Prep', servings: 'Serves', level: 'Level', ingredients: 'Ingredients',
        story: 'The Story', steps: 'Instructions', tip: 'Tip', back: '← Search another dish',
        hint: '◆ to save between sessions' }
    : { prep: 'Preparo', servings: 'Porções', level: 'Nível', ingredients: 'Ingredientes',
        story: 'A História', steps: 'Modo de Preparo', tip: 'Dica', back: '← Pesquisar outro prato',
        hint: '◆ para guardar entre sessões' }

  const illKey = recipe.illustration_key || 'mortar'
  const ill = illustrationSVG[illKey] || illustrationSVG.mortar
  const ingredients = (recipe.ingredients || []).map(i => `<li data-stagger>${i}</li>`).join('')
  const steps = (recipe.steps || []).map((s, i) =>
    `<li data-stagger><span class="step-number">${i + 1}</span><span class="step-text">${s}</span></li>`).join('')

  const isFirstOfSession = host.children.length === 0
  const microHint = isFirstOfSession && !localStorage.getItem('fp_resultado_hint_shown')
    ? `<p class="resultado-micro-hint">${labels.hint}</p>` : ''

  const el = document.createElement('div')
  el.className = 'book-spread'
  el.dataset.role = 'resultado'
  el.dataset.resultadoId = id
  el.dataset.recipeName = recipe.name || ''
  el.style.display = 'none'
  el.innerHTML = `
    <div class="page-turn-layer"><div class="turn-front"></div><div class="turn-back"></div></div>
    <div class="page page-left">
      <div class="curl-zone curl-left" role="button" aria-label="Página anterior"><div class="curl-surface"></div><div class="curl-hint">‹</div></div>
      <div class="recipe-card-border">
        <span class="recipe-eyebrow" data-stagger>${recipe.category || ''}</span>
        <div class="recipe-header-rule" data-stagger></div>
        <h2 class="recipe-title" data-stagger>${recipe.name || ''}</h2>
        <p class="recipe-subtitle-italic" data-stagger>${recipe.subtitle || ''}</p>
        <div class="recipe-meta-grid" data-stagger>
          <div class="meta-cell"><span class="meta-label">${labels.prep}</span><span class="meta-value">${recipe.prep_time || ''}</span></div>
          <div class="meta-cell"><span class="meta-label">${labels.servings}</span><span class="meta-value">${recipe.servings || ''}</span></div>
          <div class="meta-cell"><span class="meta-label">${labels.level}</span><span class="meta-value">${recipe.difficulty || ''}</span></div>
        </div>
        <div class="recipe-section">
          <h3 class="section-label" data-stagger>${labels.ingredients}</h3>
          <ul class="ingredients-list" data-stagger>${ingredients}</ul>
          <div class="chef-tip" data-stagger>
            <span class="tip-label">${labels.tip}</span>
            <p class="tip-text">${recipe.tip || ''}</p>
          </div>
        </div>
      </div>
      ${microHint}
      <div class="handwritten-annotation annotation-0" data-stagger>${recipe.annotation || ''}</div>
      <div class="resultado-actions" data-stagger>
        <button class="back-to-search-btn" onclick="goToSection('search')">${labels.back}</button>
      </div>
      <div class="page-footer"><span class="footer-brand">Foodpedia</span><span class="page-number"></span></div>
    </div>
    <div class="page page-right">
      <div class="curl-zone curl-right" role="button" aria-label="Próxima página"><div class="curl-surface"></div><div class="curl-hint">›</div></div>
      <div class="recipe-card-border">
        <div class="botanical-illustration" data-stagger>${ill}</div>
        <div class="recipe-story">
          <h3 class="section-label" data-stagger>${labels.story}</h3>
          <p class="story-text" data-stagger>${recipe.story || ''}</p>
        </div>
        <div class="divider-ornament" data-stagger></div>
        <div class="recipe-section">
          <h3 class="section-label" data-stagger>${labels.steps}</h3>
          <ol class="steps-list" data-stagger>${steps}</ol>
        </div>
      </div>
      <div class="page-footer"><span class="footer-brand">Foodpedia</span><span class="page-number"></span></div>
    </div>`

  host.appendChild(el)
  return el
}
```

- [ ] **Step 3: Add `createFavoritadoSpread(entry)` and `rebuildFavoritadoSpreads()`**

After `createResultadoSpread`, add:

```js
function createFavoritadoSpread(entry) {
  const r = entry.recipe || {}
  const lang = entry.lang || 'pt'
  const labels = lang === 'en'
    ? { prep: 'Prep', servings: 'Serves', level: 'Level', ingredients: 'Ingredients',
        story: 'The Story', steps: 'Instructions', tip: 'Tip' }
    : { prep: 'Preparo', servings: 'Porções', level: 'Nível', ingredients: 'Ingredientes',
        story: 'A História', steps: 'Modo de Preparo', tip: 'Dica' }

  const illKey = r.illustration_key || 'mortar'
  const ill = illustrationSVG[illKey] || illustrationSVG.mortar
  const ingredients = (r.ingredients || []).map(i => `<li>${i}</li>`).join('')
  const steps = (r.steps || []).map((s, i) =>
    `<li><span class="step-number">${i + 1}</span><span class="step-text">${s}</span></li>`).join('')

  const favresultKey = `favresult:${entry.id}`
  const el = document.createElement('div')
  el.className = 'book-spread'
  el.dataset.role = 'favorited-result'
  el.dataset.favresultId = entry.id
  el.dataset.recipeName = r.name || ''
  el.style.display = 'none'
  el.innerHTML = `
    <div class="page-turn-layer"><div class="turn-front"></div><div class="turn-back"></div></div>
    <div class="page page-left">
      <div class="curl-zone curl-left" role="button" aria-label="Página anterior"><div class="curl-surface"></div><div class="curl-hint">‹</div></div>
      <div class="recipe-card-border">
        <span class="recipe-eyebrow">${r.category || ''}</span>
        <div class="recipe-header-rule"></div>
        <h2 class="recipe-title">${r.name || ''}</h2>
        <p class="recipe-subtitle-italic">${r.subtitle || ''}</p>
        <div class="recipe-meta-grid">
          <div class="meta-cell"><span class="meta-label">${labels.prep}</span><span class="meta-value">${r.prep_time || ''}</span></div>
          <div class="meta-cell"><span class="meta-label">${labels.servings}</span><span class="meta-value">${r.servings || ''}</span></div>
          <div class="meta-cell"><span class="meta-label">${labels.level}</span><span class="meta-value">${r.difficulty || ''}</span></div>
        </div>
        <div class="recipe-section">
          <h3 class="section-label">Ingredientes</h3>
          <ul class="ingredients-list">${ingredients}</ul>
          <div class="chef-tip">
            <span class="tip-label">${labels.tip}</span>
            <p class="tip-text">${r.tip || ''}</p>
          </div>
        </div>
      </div>
      <div class="handwritten-annotation annotation-0">${r.annotation || ''}</div>
      <div class="page-footer"><span class="footer-brand">Foodpedia</span><span class="page-number"></span></div>
    </div>
    <div class="page page-right">
      <div class="curl-zone curl-right" role="button" aria-label="Próxima página"><div class="curl-surface"></div><div class="curl-hint">›</div></div>
      <div class="recipe-card-border">
        <div class="botanical-illustration">${ill}</div>
        <div class="recipe-story">
          <h3 class="section-label">${labels.story}</h3>
          <p class="story-text">${r.story || ''}</p>
        </div>
        <div class="recipe-section">
          <h3 class="section-label">${labels.steps}</h3>
          <ol class="steps-list">${steps}</ol>
        </div>
      </div>
      <div class="page-footer"><span class="footer-brand">Foodpedia</span><span class="page-number"></span></div>
    </div>`
  return el
}

function rebuildFavoritadoSpreads() {
  const host = document.getElementById('favoritos-container')
  if (!host) return
  host.innerHTML = ''
  favoritedRecipes().forEach(entry => {
    const el = createFavoritadoSpread(entry)
    host.appendChild(el)
  })
  initCurlZones()
}
```

- [ ] **Step 4: Commit Task 4**

```bash
git add static/js/book.js
git commit -m "feat: add createResultadoSpread, createFavoritadoSpread, rebuildFavoritadoSpreads"
```

---

### Task 5: Persistence — toggleFavorite for resultado spreads

**Files:**
- Modify: `static/js/book.js`

**Interfaces:**
- Produces: `toggleResultadoFavorite(resultadoId)` — saves recipe to `fp_favorited_recipes`, toggles `favresult:<id>` in `fp_favorites`, rebuilds favoritos container
- Modifies: `toggleCurrentPageFavorite()` — delegates to `toggleResultadoFavorite()` when on a resultado spread
- Modifies: `syncRibbonFavorite()` — handles `resultado` and `favorited-result` roles
- Modifies: `buildFavoritesTocSpread()` — extends to include favorited-result entries

- [ ] **Step 1: Add `toggleResultadoFavorite(resultadoId)`**

After `rebuildFavoritadoSpreads()`, add:

```js
function toggleResultadoFavorite(resultadoId) {
  const favresultKey = `favresult:${resultadoId}`
  let favs = favoriteKeys()
  const persisted = favoritedRecipes()
  const alreadyFavorited = favs.includes(favresultKey)

  if (alreadyFavorited) {
    // Desfavoritar
    localStorage.setItem('fp_favs', JSON.stringify(favs.filter(k => k !== favresultKey)))
    localStorage.setItem('fp_favorited_recipes', JSON.stringify(persisted.filter(e => e.id !== resultadoId)))
  } else {
    // Favoritar — read recipe from the resultado spread
    const resultadoEl = document.querySelector(`[data-resultado-id="${resultadoId}"]`)
    if (!resultadoEl) return
    const recipe = BookState.currentRecipe || BookState.currentRecipeVariants?.[currentLang]
    if (!recipe) return
    favs.push(favresultKey)
    localStorage.setItem('fp_favs', JSON.stringify(favs))
    persisted.push({ id: resultadoId, recipe, lang: currentLang })
    localStorage.setItem('fp_favorited_recipes', JSON.stringify(persisted))
    if (!localStorage.getItem('fp_resultado_hint_shown')) {
      localStorage.setItem('fp_resultado_hint_shown', '1')
    }
  }

  rebuildFavoritadoSpreads()
  rebuildBookLayout({ keepCurrent: true })
  syncRibbonFavorite()
  syncFavoritesTab()
  updateDividerTabs(BookState.currentSpread)
  showToast(alreadyFavorited
    ? (currentLang === 'en' ? 'Recipe removed from favorites.' : 'Receita removida dos favoritos.')
    : (currentLang === 'en' ? 'Recipe saved to Favorites.' : 'Receita salva nos Favoritos.'))
}
```

- [ ] **Step 2: Update `toggleCurrentPageFavorite()` to delegate for resultado spreads**

Find `toggleCurrentPageFavorite()`. Replace its body with:

```js
function toggleCurrentPageFavorite() {
  const id = currentFavoriteKey()
  if (!id) return

  const spread = document.querySelector(`[data-spread="${BookState.currentSpread}"]`)
  const role = spread?.dataset.role

  // AI resultado: persist full recipe object
  if (role === 'resultado') {
    toggleResultadoFavorite(spread.dataset.resultadoId)
    return
  }

  // Favorited-result: toggle the favresult key (desfavoritar only — the spread exists because it was favorited)
  if (role === 'favorited-result') {
    const resultadoId = spread.dataset.favresultId
    toggleResultadoFavorite(resultadoId)
    return
  }

  // Classic spread: existing key-only behavior
  let favs = favoriteKeys()
  const i = favs.indexOf(id)
  i === -1 ? favs.push(id) : favs.splice(i, 1)
  localStorage.setItem('fp_favs', JSON.stringify(favs))
  const currentKey = id
  rebuildBookLayout({ keepCurrent: true })
  const replacement = BookState.layout.find(spread => spreadKey(spread) === currentKey)
  if (replacement) showSpread(Number(replacement.dataset.spread))
  syncRibbonFavorite()
  syncFavoritesTab()
  updateDividerTabs(BookState.currentSpread)
  showToast(i === -1
    ? (currentLang === 'en' ? 'Page added to favorites.' : 'Página adicionada aos favoritos.')
    : (currentLang === 'en' ? 'Page removed from favorites.' : 'Página removida dos favoritos.'))
}
```

- [ ] **Step 3: Update `syncRibbonFavorite()` to handle resultado roles**

Find `syncRibbonFavorite()`. The `currentFavoriteKey()` function calls `spreadKey()` which already handles `resultado` and `favorited-result` (from Task 3 Step 6), so `syncRibbonFavorite()` works as-is. No changes needed.

- [ ] **Step 4: Update `syncFavoritesTab()` to include favorited-result spreads**

Find `syncFavoritesTab()`. It currently checks `favoriteKeys()` against `BookState.layout`. Change:

```js
function syncFavoritesTab() {
  const tab = document.getElementById('tab-favorites')
  const available = favoriteKeys()
    .filter(key => BookState.layout.some(spread => spreadKey(spread) === key))
  if (!tab) return
  const visible = available.length > 0
  ...
}
```

This works correctly as-is because `favresult:*` keys will match `favorited-result` spreads in the layout (via updated `spreadKey()`). No changes needed.

- [ ] **Step 5: Update `buildFavoritesTocSpread()` to include favorited-result entries**

Find `buildFavoritesTocSpread()`. The current implementation reads `favoriteKeys()` and builds labels from `BookState.layout`. Extend it to handle `favresult:*` keys:

In `labelFor(key)`, after the existing `saved` branch, add:
```js
    if (spread.dataset.role === 'favorited-result') {
      return spread.dataset.recipeName || key
    }
```
(The existing code already does `spread.dataset.role === 'base-recipe'` and `'saved'`. Add `'favorited-result'` handling in the same pattern.)

- [ ] **Step 6: Commit Task 5**

```bash
git add static/js/book.js
git commit -m "feat: ◆ on resultado spreads persists recipe to fp_favorited_recipes"
```

---

### Task 6: Tab navigation and resultado-toc

**Files:**
- Modify: `static/js/book.js`

**Interfaces:**
- Produces: `syncResultadoTab()` — shows/hides the Resultado tab based on `#resultado-container` content
- Produces: `goToResultado()` — if `is-ready`, navigate to newest resultado; else navigate to resultado-toc
- Produces: `buildResultadoTocSpread()` — creates/updates `[data-role="resultado-toc"]` in `#resultado-container`
- Modifies: `notifyRecipeReady(recipe)` — creates resultado spread, syncs tab, shows toast with micro-hint
- Modifies: `showRecipeResult(recipe)` — creates resultado spread and navigates to it
- Modifies: `startRecipeSearch()` — calls new functions, handles `is-ready` removal on arrival

- [ ] **Step 1: Add `syncResultadoTab()`**

After `syncFavoritesTab()`, add:

```js
function syncResultadoTab() {
  const tab = document.getElementById('tab-resultado')
  if (!tab) return
  const hasResultados = document.querySelector('#resultado-container [data-role="resultado"]') !== null
  tab.style.display = hasResultados ? 'flex' : 'none'
}
```

- [ ] **Step 2: Add `buildResultadoTocSpread()`**

After `syncResultadoTab()`, add:

```js
function buildResultadoTocSpread() {
  const host = document.getElementById('resultado-container')
  if (!host) return null

  // Remove existing toc spread if any
  const existing = host.querySelector('[data-role="resultado-toc"]')
  if (existing) existing.remove()

  const resultadoEls = [...host.querySelectorAll('[data-role="resultado"]')]
  if (!resultadoEls.length) return null

  const heading = currentLang === 'en' ? 'Searched' : 'Pesquisadas'
  const entries = resultadoEls.map(el => {
    const key = spreadKey(el)
    const name = el.dataset.recipeName || key
    return `<li data-stagger>
      <a class="toc-entry toc-sub" href="#" data-target-key="${key}">
        <span class="toc-favorite-mark" aria-hidden="true"></span>
        <span class="toc-entry-title">${name}</span>
        <span class="toc-dots"></span><span class="toc-page" data-toc-page></span>
      </a>
    </li>`
  }).join('')

  const toc = document.createElement('div')
  toc.className = 'book-spread'
  toc.dataset.role = 'resultado-toc'
  toc.innerHTML = `
    <div class="page-turn-layer"><div class="turn-front"></div><div class="turn-back"></div></div>
    ${heirloomPage('left', 'secondary')}
    <div class="page page-right toc-sheet">
      <div class="curl-zone curl-right" role="button" aria-label="Próxima página"><div class="curl-surface"></div><div class="curl-hint">›</div></div>
      <h2 class="toc-heading">${heading}</h2>
      <ul class="toc-entries">${entries}</ul>
      <div class="page-footer"><span class="footer-brand">Foodpedia</span><span class="page-number"></span></div>
    </div>`

  // Insert TOC before first resultado spread
  host.insertBefore(toc, host.firstChild)
  return toc
}
```

- [ ] **Step 3: Add `goToResultado()`**

After `buildResultadoTocSpread()`, add:

```js
function goToResultado() {
  if (BookState.isAnimating) return

  if (!isOnboardingComplete()) {
    const tabEl = document.querySelector('#tab-resultado .dt-tag')
    shakeAndShowTooltip(tabEl)
    return
  }

  const tabEl = document.getElementById('tab-resultado')
  const isReady = tabEl?.classList.contains('is-ready')

  if (isReady) {
    // Navigate to the newest resultado spread
    const resultados = [...document.querySelectorAll('#resultado-container [data-role="resultado"]')]
    const newest = resultados.at(-1)
    if (!newest) return
    const target = Number(newest.dataset.spread)
    tabEl.classList.remove('is-ready')
    if (BookState.phase === 'cover') {
      animateCoverOpen(spreadKey(newest))
      return
    }
    const dir = target > BookState.currentSpread ? 'forward' : 'backward'
    animatePageTurn(BookState.currentSpread, target, dir).then(() => animateContentIn(target))
    return
  }

  // Navigate to resultado-toc
  const tocEl = document.querySelector('#resultado-container [data-role="resultado-toc"]')
  if (!tocEl) return
  const target = Number(tocEl.dataset.spread)
  if (!target) return
  if (BookState.phase === 'cover') {
    animateCoverOpen('resultado-toc')
    return
  }
  const dir = target > BookState.currentSpread ? 'forward' : 'backward'
  animatePageTurn(BookState.currentSpread, target, dir).then(() => animateContentIn(target))
}
```

- [ ] **Step 4: Implement `notifyRecipeReady(recipe)` (slow path)**

Replace the stub `notifyRecipeReady(recipe)` body with:

```js
function notifyRecipeReady(recipe) {
  BookState.currentRecipe = recipe
  BookState.currentRecipeVariants = { [currentLang]: recipe }

  const spreadEl = createResultadoSpread(recipe)
  if (!spreadEl) return
  buildResultadoTocSpread()
  rebuildBookLayout({ keepCurrent: true })
  saveSearchHistory(recipe)

  const tab = document.getElementById('tab-resultado')
  if (tab) {
    tab.classList.add('is-ready')
    syncResultadoTab()
    gsap.fromTo(tab, { opacity: 0.6 }, { opacity: 1, duration: 0.3, repeat: 2, yoyo: true })
  }

  const t = (key, fallback) => window._i18nStrings?.[currentLang]?.[key] || fallback
  showToast(t('recipe_ready_toast', 'Receita pronta! Clique em Resultado para ver.'))
  showArrow(arrowR, 0.9)
}
```

- [ ] **Step 5: Implement `showRecipeResult(recipe)` (fast path)**

Replace the stub `showRecipeResult(recipe)` body with:

```js
function showRecipeResult(recipe) {
  BookState.phase = 'result'
  BookState.pendingRecipe = null
  BookState.currentRecipe = recipe
  BookState.currentRecipeVariants = { [currentLang]: recipe }
  BookState.errorActive = false
  BookState.setupActive = false

  const spreadEl = createResultadoSpread(recipe)
  if (!spreadEl) return
  buildResultadoTocSpread()
  rebuildBookLayout({ keepCurrent: true })
  saveSearchHistory(recipe)

  const tab = document.getElementById('tab-resultado')
  tab?.classList.remove('is-ready')
  syncResultadoTab()

  const target = Number(spreadEl.dataset.spread)
  const direction = target > BookState.currentSpread ? 'forward' : 'backward'
  animatePageTurn(BookState.currentSpread, target, direction).then(() => {
    animateContentIn(target)
    updateDividerTabs(target)
  })
}
```

- [ ] **Step 6: Update `startRecipeSearch()` to clear `is-ready` state**

In `startRecipeSearch`, at the top where state is reset:
```js
  BookState.resultAvailable = false
  BookState.errorActive = false
  BookState.setupActive = false
  BookState.lastErrorCode = null
```
Add:
```js
  document.getElementById('tab-resultado')?.classList.remove('is-ready')
```

Also remove any remaining references to `BookState.resultAvailable = true` — replace them with `syncResultadoTab()` calls.

- [ ] **Step 7: Wire resultado-toc link clicks**

Find the TOC link click delegation (around line 1160):
```js
document.getElementById('toc-spreads-container')?.addEventListener('click', handleTocLinkClick)
document.getElementById('favorites-toc-container')?.addEventListener('click', handleTocLinkClick)
```

Add:
```js
document.getElementById('resultado-container')?.addEventListener('click', handleTocLinkClick)
```

- [ ] **Step 8: Handle micro-hint fade-out**

At the end of `createResultadoSpread`, after `host.appendChild(el)`, add:

```js
  if (isFirstOfSession && !localStorage.getItem('fp_resultado_hint_shown')) {
    localStorage.setItem('fp_resultado_hint_shown', '1')
    // Schedule fade-out of micro-hint after 3s when the spread becomes visible
    setTimeout(() => {
      const hint = el.querySelector('.resultado-micro-hint')
      if (hint) gsap.to(hint, { opacity: 0, duration: reducedMotion ? 0.001 : 0.4, delay: 0.3,
        onComplete: () => hint.remove() })
    }, 3000)
  }
```

- [ ] **Step 9: Verify full search flow**

```bash
cd /Users/iuk/foodpedia && .venv/bin/python -m flask --app app run --debug
```

Test:
1. Open book, navigate to Pesquisar (via tab), search for "risotto". 
2. Fast result: book navigates to a new resultado spread. Content scrolls independently. No continuation spread.
3. If slow result: Resultado tab pulses. Click Resultado tab → navigates to newest resultado spread.
4. Navigate away from resultado, click Resultado tab again → navigates to resultado-toc.
5. Resultado-toc lists searched recipes, clicking one navigates to that spread.
6. Press ◆ on resultado spread → toast "Receita salva nos Favoritos". Favoritos tab appears.
7. Navigate to Favoritos tab → sees favorites-toc listing the AI recipe alongside base favorites.
8. Reload page: resultado container is empty, Resultado tab disappears. Favoritos tab shows with AI recipe.

- [ ] **Step 10: Commit Task 6**

```bash
git add static/js/book.js
git commit -m "feat: goToResultado, resultado-toc, notifyRecipeReady creates new spreads"
```

---

### Task 7: Cleanup and i18n stubs

**Files:**
- Modify: `static/data/i18n.json`
- Modify: `static/js/book.js`

**Interfaces:**
- Adds: i18n keys `toc_resultado`, `recipe_ready_toast` (if not already present)
- Removes: `toc_saved` usage (already removed from tocEntries)
- Removes: `BookState.resultAvailable` flag (no longer needed — replaced by container state)

- [ ] **Step 1: Add missing i18n keys**

Read `static/data/i18n.json` to see current structure, then add under `pt` and `en`:

```json
"toc_resultado": "Pesquisadas",
"recipe_ready_toast": "Receita pronta! Clique em Resultado para ver."
```

And under `en`:
```json
"toc_resultado": "Searched",
"recipe_ready_toast": "Recipe ready! Click on Result to see it."
```

- [ ] **Step 2: Remove `BookState.resultAvailable`**

Find `BookState` object. Remove:
```js
  resultAvailable: false,
```

Remove all remaining `BookState.resultAvailable` references in the codebase (there may be a few stragglers in `showSetup` and `showRecipeResult` stubs). Replace with no-ops or remove.

- [ ] **Step 3: Final verification**

```bash
cd /Users/iuk/foodpedia && .venv/bin/python -m pytest -v
```

All tests should pass (the removed functions have no tests; new ones are JS-only and untestable from Python).

```bash
cd /Users/iuk/foodpedia && .venv/bin/python -m flask --app app run --debug
```

Test language switch: search a recipe in PT, switch to EN → book closes and reopens on the resultado spread (which keeps its recipe in PT). No JS errors.

Test favorites persistence: reload the page → `#favoritos-container` is rebuilt from `fp_favorited_recipes`. Navigate to Favoritos tab → favorites-toc shows the AI recipe.

- [ ] **Step 4: Final commit**

```bash
git add static/data/i18n.json static/js/book.js
git commit -m "feat: i18n keys for resultado system, clean up resultAvailable flag"
```

---

## Self-Review vs Spec

### Section 1: Data Model
| Requirement | Task | Status |
|-------------|------|--------|
| `fp_saved_recipes` removed | Task 3 | ✓ |
| `fp_favorited_recipes` added (`{id, recipe, lang}[]`) | Task 5 Step 1 | ✓ |
| `favresult:<id>` keys in `fp_favorites` | Task 5 Step 1 `toggleResultadoFavorite` | ✓ |
| `#resultado-container` (rename from saved) | Task 1 Step 3 | ✓ |
| `#favoritos-container` (new) | Task 1 Step 3 | ✓ |

### Section 2: Search Flow
| Requirement | Task | Status |
|-------------|------|--------|
| `data-role="resultado"` spread with unique ID | Task 4 Step 2 `createResultadoSpread` | ✓ |
| Resultado tab pulses with `is-ready` | Task 6 Step 4 | ✓ |
| TOC ephemeral entry (italic/lighter) | Task 3 Step 14 + Task 2 Step 2 `.toc-resultado-entry` | ✓ |
| Toast "Receita pronta!" | Task 6 Step 4 | ✓ |
| Micro-hint on first resultado, fades after 3s | Task 4 Step 2 + Task 6 Step 8 | ✓ |
| Clicking tab with `is-ready` → newest resultado | Task 6 Step 3 | ✓ |
| Clicking tab without `is-ready` → resultado-toc | Task 6 Step 3 | ✓ |
| Resultado tab visible when `#resultado-container` has spreads | Task 6 Step 1 | ✓ |

### Section 3: Favorite Persistence
| Requirement | Task | Status |
|-------------|------|--------|
| ◆ on resultado: save to `fp_favorited_recipes` | Task 5 Step 1 | ✓ |
| ◆ on resultado: add `favresult:<id>` to `fp_favorites` | Task 5 Step 1 | ✓ |
| ◆ on resultado: create `favorited-result` spread in `#favoritos-container` | Task 4 Step 3 | ✓ |
| ◆ again (desfavoritar): remove from storage and container | Task 5 Step 1 | ✓ |
| Classic ◆ behavior unchanged | Task 5 Step 2 | ✓ |

### Section 4: After Refresh
| Requirement | Task | Status |
|-------------|------|--------|
| `#resultado-container` empty on load | Natural (JS-only, not persisted) | ✓ |
| `fp_favorited_recipes` → rebuild `#favoritos-container` | Task 4 Step 3 `rebuildFavoritadoSpreads` | ✓ |
| Favoritos tab visible with AI recipes | Task 5 Step 4 | ✓ |
| ◆ active on favorited-result spreads | Task 5 (via fp_favs + spreadKey match) | ✓ |

### Section 5: TOC
| Requirement | Task | Status |
|-------------|------|--------|
| Base recipes always present | Unchanged | ✓ |
| Resultado entries (ephemeral, italic) | Task 3 Step 14 + CSS | ✓ |
| Favorited AI entries | Task 3 Step 14 | ✓ |
| After refresh: only base + favorited AI | Natural | ✓ |

### Section 6: Favorites Spread
| Requirement | Task | Status |
|-------------|------|--------|
| Base favorites listed | Existing `buildFavoritesTocSpread` | ✓ |
| AI favorites listed (`favresult:*` keys) | Task 5 Step 5 | ✓ |
| Navigation to `favorited-result` spread | `spreadKey` returns `favresult:*` → matched in layout | ✓ |

### Section 7: Removals
| Requirement | Task | Status |
|-------------|------|--------|
| `data-role="result"` removed | Task 1 Step 1 | ✓ |
| `#result-continuation-container` removed | Task 1 Step 2 | ✓ |
| Button "Salvar no livro" removed | Task 1 Step 1 (part of result spread) | ✓ |
| `populateResultSpread()` removed | Task 3 Step 2 | ✓ |
| `showRecipeResult()` replaced | Task 6 Step 5 | ✓ |
| `saveCurrentRecipe()` removed | Task 3 Step 4 | ✓ |
| `rebuildSavedSpreads()` removed | Task 3 Step 4 | ✓ |
| `MAX_SAVED` removed | Task 3 Step 4 | ✓ |
| `SPREAD_RESULT` removed | Task 3 Step 5 | ✓ |
| `fp_saved_recipes` removed | Task 3 Step 1 + Step 4 | ✓ |
| `result-*` CSS removed | Task 2 Step 1 | ✓ |

### Spec 3 Section 4 Integration (Scroll)
| Requirement | Task | Status |
|-------------|------|--------|
| Continuation spread removed | Task 1 Step 2 + Task 3 | ✓ |
| Resultado pages scroll independently | Task 2 Step 2 (overflow-y: auto on pages) | ✓ |
| Scroll reset on navigate | Pages created fresh each search, reset naturally | ✓ |
| Scrollbar hidden | Task 2 Step 2 (scrollbar-width: none) | ✓ |
| Visual scroll indicator (border) | Task 2 Step 2 (box-shadow inset) | ✓ |

### Placeholder Scan
None — all steps contain complete code.

### Type Consistency
- `spreadKey(spread)` for `data-role="resultado"` → `resultado:${spread.dataset.resultadoId}` ✓
- `spreadKey(spread)` for `data-role="favorited-result"` → `favresult:${spread.dataset.favresultId}` ✓
- `toggleResultadoFavorite(resultadoId)` where `resultadoId = spread.dataset.resultadoId` (e.g. `"resultado-1234567890"`) ✓
- `favresultKey = "favresult:resultado-1234567890"` in `fp_favorites` ✓
- `rebuildFavoritadoSpreads()` reads `fp_favorited_recipes` → calls `createFavoritadoSpread(entry)` where `entry.id = resultadoId` ✓
