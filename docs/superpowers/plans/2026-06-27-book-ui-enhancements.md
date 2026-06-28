# Book UI Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four independent UI/UX improvements to the Foodpedia book interface: spine shadow on close, rainbow tab colors, tab-click-to-open, and favorites as a second table of contents.

**Architecture:** All changes are confined to `static/js/book.js`, `static/css/book.css`, and `templates/index.html`. No backend, no new files, no new dependencies. Each feature is fully independent and can be committed separately.

**Tech Stack:** Vanilla JS, GSAP (already in use), CSS custom properties, Flask/Jinja2 templates

## Global Constraints

- No backend changes — all four features are purely frontend
- Do not touch the GSAP page-turn animation logic in `animatePageTurn()`
- Do not break the existing `animateCoverOpen()` callback chain
- `.book-wrapper.is-open` class is already toggled by `animateCoverOpen()` (line 552) and removed by `goToCover()` (line 637) — rely on this, do not add new state
- `favoriteKeys()` reads from `localStorage.getItem('fp_favs')` — do not change this
- `rebuildBookLayout()` rebuilds the entire spread layout — any new spread must be added inside this function
- `SECTION_SPREADS` object maps section names to spread indices — new sections must be added here

---

## Task 1: Spine Shadow

**Files:**
- Modify: `static/css/book.css` — add spine shadow pseudo-element
- Modify: `static/css/book.css` — add mobile responsive rule

**Interfaces:**
- Consumes: `.book-wrapper` element (already exists in HTML at `templates/index.html:27`)
- Consumes: `.book-wrapper.is-open` class (added by `animateCoverOpen` at `book.js:552`, removed by `goToCover` at `book.js:637`)
- Produces: nothing (cosmetic only)

- [ ] **Step 1: Add spine shadow pseudo-element CSS**

In `static/css/book.css`, find the `.book-wrapper` rule (around line 100) and add the following block immediately after it:

```css
/* ── SPINE SHADOW — visible when book is closed ── */
.book-wrapper::before {
  content: '';
  position: absolute;
  left: 0; top: 4%; bottom: 4%;
  width: 18px;
  background: linear-gradient(to right, rgba(0,0,0,0.45) 0%, transparent 100%);
  border-radius: 4px 0 0 4px;
  z-index: 12;
  pointer-events: none;
  opacity: 1;
  transition: opacity 0.55s ease;
}
.book-wrapper.is-open::before {
  opacity: 0;
}
```

- [ ] **Step 2: Verify in browser**

Start the dev server (`python app.py`) and open the app. You should see a thin dark shadow on the left edge of the cover (the spine). Click the cover to open the book — the shadow should fade to nothing during the opening animation.

If the shadow is too strong or too thin, adjust `rgba(0,0,0,0.45)` and `width: 18px` to taste.

- [ ] **Step 3: Add mobile responsive rule**

In the responsive block for mobile (search for `@media` near the bottom of `book.css`), add:

```css
  .book-wrapper::before {
    display: none; /* spine not visible in mobile single-page layout */
  }
```

- [ ] **Step 4: Verify on mobile viewport**

Resize browser to mobile width. The shadow should not appear.

- [ ] **Step 5: Commit**

```bash
git add static/css/book.css
git commit -m "feat: add spine shadow to book cover for 3D depth effect"
```

---

## Task 2: Rainbow Tab Colors

**Files:**
- Modify: `templates/index.html` — 2 inline style changes

**Interfaces:**
- Consumes: The 6 `.div-tab` buttons in `index.html` (lines ~508–534)
- Produces: nothing (cosmetic only)

- [ ] **Step 1: Update Saved tab color**

In `templates/index.html`, find the Saved tab (around line 524):

```html
<button class="div-tab" type="button" id="tab-saved" data-section="saved" onclick="goToSection('saved')" style="display:none;">
  <div class="dt-tag" style="background:#9E7A88">
```

Change `#9E7A88` (mauve) to `#7080A0` (slate blue):

```html
<button class="div-tab" type="button" id="tab-saved" data-section="saved" onclick="goToSection('saved')" style="display:none;">
  <div class="dt-tag" style="background:#7080A0">
```

- [ ] **Step 2: Update Favorites tab color**

In `templates/index.html`, find the Favorites tab (around line 530):

```html
<button class="div-tab favorite-divider-tab" type="button" id="tab-favorites"
        data-section="favorites" onclick="goToFavorites()" style="display:none;">
  <div class="dt-tag" style="background:#8C7052">
```

Change `#8C7052` (brown) to `#887AA8` (soft violet):

```html
<button class="div-tab favorite-divider-tab" type="button" id="tab-favorites"
        data-section="favorites" onclick="goToFavorites()" style="display:none;">
  <div class="dt-tag" style="background:#887AA8">
```

- [ ] **Step 3: Verify sequence visually**

Make a recipe search (to reveal the Resultado tab) and add a favorite (to reveal Saved and Favorites tabs). The 6 tabs should now read top to bottom: terracotta → ochre → sage → teal → slate blue → soft violet — a muted rainbow sequence.

- [ ] **Step 4: Commit**

```bash
git add templates/index.html
git commit -m "feat: update Saved and Favorites tab colors to complete rainbow sequence"
```

---

## Task 3: Tab Navigation from Closed State

**Files:**
- Modify: `static/js/book.js` — wrap `goToSection()` and `goToFavorites()` with cover-phase detection

**Interfaces:**
- Consumes: `BookState.phase` (string: `'cover' | 'browsing' | 'loading' | 'result' | 'backcover'`)
- Consumes: `animateCoverOpen(targetKey?: string, targetSide?: string): Promise<void>` — already accepts a `targetKey` to open directly at a spread (book.js ~line 544)
- Consumes: `SECTION_SPREADS` object — maps section name strings to spread index numbers
- Consumes: `BookState.layout` array — ordered list of spread DOM elements
- Consumes: `spreadKey(spread)` — returns the unique key string for a spread element
- Produces: `goToSection(section)` — updated in-place (same signature)
- Produces: `goToFavorites()` — updated in-place (same signature)

- [ ] **Step 1: Update `goToSection()` to handle closed state**

In `static/js/book.js`, find `goToSection` (around line 755):

```js
function goToSection(section) {
  if (BookState.isAnimating) return
  if (section === 'result' && !BookState.resultAvailable && !BookState.pendingRecipe) return
  if (section === 'result' && BookState.pendingRecipe) {
    showRecipeResult(BookState.pendingRecipe)
    return
  }
  const target = SECTION_SPREADS[section] ?? SPREAD_SAVED_START
  const dir    = target > BookState.currentSpread ? 'forward' : 'backward'
  animatePageTurn(BookState.currentSpread, target, dir)
    .then(() => { animateContentIn(target) })
}
```

Replace it with:

```js
function goToSection(section) {
  if (BookState.isAnimating) return
  if (section === 'result' && !BookState.resultAvailable && !BookState.pendingRecipe) return
  if (section === 'result' && BookState.pendingRecipe) {
    showRecipeResult(BookState.pendingRecipe)
    return
  }

  if (BookState.phase === 'cover') {
    const target = SECTION_SPREADS[section] ?? SPREAD_SAVED_START
    const targetSpread = BookState.layout.find(s => Number(s.dataset.spread) === target)
    animateCoverOpen(targetSpread ? spreadKey(targetSpread) : null)
    return
  }

  const target = SECTION_SPREADS[section] ?? SPREAD_SAVED_START
  const dir    = target > BookState.currentSpread ? 'forward' : 'backward'
  animatePageTurn(BookState.currentSpread, target, dir)
    .then(() => { animateContentIn(target) })
}
```

- [ ] **Step 2: Verify `goToSection` from cover**

Open the app (cover showing). Click the "Sumário" tab — the book should open and land on the TOC spread. Go back to cover with the arrow or keyboard. Click "Pesquisar" — should open on the search spread. Repeat for "Receitas".

- [ ] **Step 3: Update `goToFavorites()` to handle closed state**

In `static/js/book.js`, find `goToFavorites` (around line 768):

```js
function goToFavorites() {
  if (BookState.isAnimating) return
  const favorite = favoriteKeys()
    .map(key => BookState.layout.find(spread => spreadKey(spread) === key))
    .find(Boolean)
  if (!favorite) {
    syncFavoritesTab()
    return
  }
  const target = Number(favorite.dataset.spread)
  const direction = target > BookState.currentSpread ? 'forward' : 'backward'
  animatePageTurn(BookState.currentSpread, target, direction)
    .then(() => animateContentIn(target))
}
```

Replace it with (the body will change again in Task 4; for now just add the cover guard):

```js
function goToFavorites() {
  if (BookState.isAnimating) return
  const favToc = BookState.layout.find(s => s.dataset.role === 'favorites-toc')
  if (!favToc) { syncFavoritesTab(); return }

  if (BookState.phase === 'cover') {
    animateCoverOpen('favorites-toc')
    return
  }

  const target = Number(favToc.dataset.spread)
  const direction = target > BookState.currentSpread ? 'forward' : 'backward'
  animatePageTurn(BookState.currentSpread, target, direction)
    .then(() => animateContentIn(target))
}
```

> Note: `goToFavorites` now points to the `favorites-toc` spread which is built in Task 4. It will only work end-to-end after Task 4 is complete. In this task, verify the cover-guard path by confirming that when the book is open and favorites exist, clicking the tab still navigates to the correct spread (the favorites-toc built in Task 4).

- [ ] **Step 4: Commit**

```bash
git add static/js/book.js
git commit -m "feat: allow tab clicks to open book from cover and navigate directly to section"
```

---

## Task 4: Favorites as Second Table of Contents

**Files:**
- Modify: `static/js/book.js` — add `buildFavoritesTocSpread()`, update `rebuildBookLayout()`, update `updateDividerTabs()`, finalize `goToFavorites()`
- Modify: `templates/index.html` — add `#favorites-toc-container` div

**Interfaces:**
- Consumes: `favoriteKeys(): string[]` — returns array of favorite spread keys from localStorage
- Consumes: `BookState.layout` — array of spread DOM elements in layout order
- Consumes: `spreadKey(spread): string` — returns spread's unique key
- Consumes: `tocPage(entries, pageIndex, side): string` — returns HTML string for a TOC page; reused for visual consistency
- Consumes: `heirloomPage(side, variant): string` — decorative page used alongside TOC pages
- Consumes: `rebuildBookLayout(options)` — already rebuilds all spreads; this task adds the favorites spread into it
- Consumes: `syncFavoritesTab()` — already called after favorite toggles
- Produces: `buildFavoritesTocSpread(): HTMLElement | null` — returns a spread DOM element or null when no favorites
- Produces: `SPREAD_FAVORITES_TOC: number` — spread index of the favorites-toc spread (0 when absent)

- [ ] **Step 1: Add favorites-toc container in HTML**

In `templates/index.html`, find the `#toc-spreads-container` div and add a sibling container immediately after it:

```html
<div id="toc-spreads-container"></div>
<div id="favorites-toc-container"></div>
```

The `#toc-spreads-container` is around line 92 of `index.html`. Add the new container directly below it.

- [ ] **Step 2: Add `buildFavoritesTocSpread()` function in `book.js`**

Add this function immediately after `renderTOCSpreads()` (around line 293):

```js
function buildFavoritesTocSpread() {
  const host = document.getElementById('favorites-toc-container')
  if (!host) return null
  host.innerHTML = ''

  const keys = favoriteKeys().filter(key =>
    BookState.layout.some(spread => spreadKey(spread) === key)
  )
  if (!keys.length) return null

  const labelFor = key => {
    const spread = BookState.layout.find(s => spreadKey(s) === key)
    if (!spread) return key
    if (spread.dataset.role === 'base-recipe') return spread.dataset.recipeName || key
    if (spread.dataset.role === 'saved') {
      const savedData = savedRecipes().find(r => `saved:${r.id}` === key)
      return savedData?.recipe?.name || key
    }
    const staticLabels = {
      about: currentLang === 'en' ? 'About Foodpedia' : 'Sobre o Foodpedia',
      search: currentLang === 'en' ? 'Search a Dish' : 'Pesquisar um Prato',
    }
    return staticLabels[key] || key
  }

  const entries = keys.map(key => ({
    type: 'link',
    label: labelFor(key),
    targetKey: key,
    favorite: true,
  }))

  const el = document.createElement('div')
  el.className = 'book-spread'
  el.dataset.role = 'favorites-toc'
  el.innerHTML = `
    <div class="page-turn-layer"><div class="turn-front"></div><div class="turn-back"></div></div>
    ${heirloomPage('left', 'primary')}
    <div class="page page-right toc-sheet">
      <div class="curl-zone curl-right" role="button" aria-label="Próxima página"><div class="curl-surface"></div><div class="curl-hint">›</div></div>
      <h2 class="toc-heading">${currentLang === 'en' ? 'Favourites' : 'Favoritos'}</h2>
      <ul class="toc-entries">${entries.map(entry => `
        <li data-stagger>
          <a class="toc-entry is-favorite" href="#" data-target-key="${entry.targetKey}">
            <span class="toc-favorite-mark" aria-hidden="true">◆</span>
            <span class="toc-entry-title">${entry.label}</span>
            <span class="toc-dots"></span><span class="toc-page" data-toc-page></span>
          </a>
        </li>`).join('')}
      </ul>
      <div class="page-footer"><span class="footer-brand">Foodpedia</span><span class="page-number"></span></div>
    </div>`
  host.appendChild(el)
  return el
}
```

- [ ] **Step 3: Add `SPREAD_FAVORITES_TOC` variable**

At the top of `book.js` where the other `SPREAD_*` variables are declared (around lines 11–20), add:

```js
let SPREAD_FAVORITES_TOC = 0
```

- [ ] **Step 4: Add favorites spread to `rebuildBookLayout()`**

Inside `rebuildBookLayout()` (around line 295), after the line `const tocSpreads = renderTOCSpreads()`, add:

```js
  const favTocSpread = buildFavoritesTocSpread()
```

Then in the `layout` array definition (around line 313), add `favTocSpread` after `tocSpreads` and before `about`:

```js
  const layout = [
    endpaper,
    ...tocSpreads,
    favTocSpread,   // ← add this line
    about,
    search,
    ...recipes,
    ...conditional,
    ...saved,
  ].filter(Boolean)
```

After the spread index assignments (around line 349), add:

```js
  SPREAD_FAVORITES_TOC = favTocSpread ? layoutIndex(favTocSpread) : 0
  Object.assign(SECTION_SPREADS, {
    ...SECTION_SPREADS,        // keep existing
    favorites: SPREAD_FAVORITES_TOC || SPREAD_TOC,
  })
```

- [ ] **Step 5: Update `updateDividerTabs()` to recognize `favorites-toc` role**

In `updateDividerTabs()` (around line 784), add a case for the favorites-toc role in the `if/else` chain:

```js
  else if (role === 'favorites-toc') section = 'favorites'
```

Add it after the `role === 'saved'` line:

```js
  else if (role === 'saved')       section = 'saved'
  else if (role === 'favorites-toc') section = 'favorites'
```

And remove the separate `favoriteKeys().includes()` check below, since the tab activation is now handled by role:

```js
  // REMOVE these two lines:
  if (favoriteKeys().includes(spreadKey(spread))) {
    document.querySelector('[data-section="favorites"] .dt-tag')?.classList.add('active')
  }
```

> Wait — the original logic activates the favorites tab when viewing any favorited page (not just the favorites-toc). Keep the original `favoriteKeys().includes()` check in addition to the new role check. Do NOT remove it. The diff should only ADD the new else-if:

```js
  else if (role === 'saved')         section = 'saved'
  else if (role === 'favorites-toc') section = 'favorites'
  if (section)
    document.querySelector(`[data-section="${section}"] .dt-tag`)?.classList.add('active')
  if (favoriteKeys().includes(spreadKey(spread))) {   // ← keep this
    document.querySelector('[data-section="favorites"] .dt-tag')?.classList.add('active')
  }
```

- [ ] **Step 6: Verify favorites spread end-to-end**

1. Open the app — no favorites yet, favorites tab hidden. ✓
2. Open a base-recipe spread (e.g. Feijoada). Click the ribbon (red bookmark) to favorite it.
3. The favorites tab should appear in the left sidebar.
4. Click the favorites tab. The book should navigate to a spread titled "Favoritos" listing "Feijoada".
5. Click the entry — should navigate to the Feijoada spread.
6. Add a second favorite. Go back to the favorites tab. Both items appear.
7. Remove a favorite. Go back. Removed item is gone.
8. Remove all favorites. Favorites tab disappears.
9. Start on cover, click favorites tab (if visible) → book opens on the Favoritos spread.

- [ ] **Step 7: Commit**

```bash
git add static/js/book.js templates/index.html
git commit -m "feat: add favorites TOC spread — clicking favorites tab opens a second table of contents"
```

---

## Self-Review

**Spec coverage:**
- ✅ Tab navigation from cover → Task 3
- ✅ Rainbow colors (Saved + Favorites tabs) → Task 2
- ✅ Spine shadow when closed, fades on open → Task 1
- ✅ Favorites spread as second TOC → Task 4
- ✅ No favorites → spread absent / tab hidden → Task 4 (`buildFavoritesTocSpread` returns null, filtered by `.filter(Boolean)` in layout)

**Placeholder scan:** No TBDs or TODOs — all steps contain exact code.

**Type consistency:**
- `buildFavoritesTocSpread()` returns `HTMLElement | null` — consumed by `rebuildBookLayout()` via `.filter(Boolean)` ✓
- `SPREAD_FAVORITES_TOC` declared as `let number` — assigned in `rebuildBookLayout()` ✓
- `spreadKey(spread)` returns `'favorites-toc'` for the new spread (falls through to `spread.dataset.role || ''`) ✓
- `animateCoverOpen('favorites-toc')` in Task 3 matches the `targetKey` parameter of `animateCoverOpen()` ✓
