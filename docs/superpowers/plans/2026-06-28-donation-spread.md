# Donation Spread Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a static colofão/donation spread after the base recipes, reachable by sequential navigation and via a dedicated TOC entry, with stamps for Ko-fi, Livepix, and GitHub Sponsors.

**Architecture:** A `data-role="apoio"` spread is declared in `templates/index.html` immediately after the `{% endfor %}` of `base_recipes`. `rebuildBookLayout()` in `book.js` picks it up and inserts it between `...recipes` and `...conditional` in the layout array. A `SPREAD_APOIO` variable tracks its spread index. The TOC receives a separator + link entry pointing at key `'apoio'` (the value that `spreadKey()` returns for `data-role="apoio"` via its default branch).

**Tech Stack:** Jinja2 HTML template, vanilla JS, plain CSS, inline SVG.

## Global Constraints

- No new library dependencies.
- Follow existing naming conventions: CSS vars (`--c-*`), JS globals (`SPREAD_*`), i18n keys (`snake_case`).
- SVG icons: `stroke: var(--c-gold)`, `stroke-width: 0.8`, `stroke-linecap: round`, no fill — matching botanical illustration style.
- Donation links: `target="_blank" rel="noopener"` required.
- All user-visible copy goes through `data-i18n` / `data-i18n-html` — no hardcoded strings.

---

### Task 1: i18n keys

**Files:**
- Modify: `static/data/i18n.json`

**Interfaces:**
- Produces: keys `apoio_eyebrow`, `apoio_heading`, `apoio_p1`, `apoio_p2`, `apoio_p3`, `apoio_annotation`, `apoio_livepix_note`, `apoio_github_note`, `toc_apoio` in both `pt` and `en`.

- [ ] **Step 1: Add PT keys** — in `static/data/i18n.json`, inside the `"pt"` object, before the closing `}` (after `"cu_cta_button"`), add:

```json
    "apoio_eyebrow": "uma palavra do autor",
    "apoio_heading": "Feito com<br>curiosidade<br>e código.",
    "apoio_p1": "O Foodpedia é um projeto independente — sem investidores, sem anúncios, feito por uma pessoa só.",
    "apoio_p2": "Se ele te trouxe uma receita nova, uma história inesperada ou simplesmente um momento de curiosidade, considere apoiar.",
    "apoio_p3": "Qualquer contribuição ajuda a manter o servidor ligado e o código evoluindo.",
    "apoio_annotation": "obrigado\npor estar aqui",
    "apoio_livepix_note": "para brasileiros",
    "apoio_github_note": "via GitHub Sponsors",
    "toc_apoio": "Apoiar o Projeto"
```

- [ ] **Step 2: Add EN keys** — inside the `"en"` object, before its closing `}` (after `"cu_cta_button"`), add:

```json
    "apoio_eyebrow": "a word from the author",
    "apoio_heading": "Made with<br>curiosity<br>and code.",
    "apoio_p1": "Foodpedia is an independent project — no investors, no ads, built by one person.",
    "apoio_p2": "If it brought you a new recipe, an unexpected story, or just a moment of curiosity, consider supporting it.",
    "apoio_p3": "Any contribution helps keep the server running and the code evolving.",
    "apoio_annotation": "thank you\nfor being here",
    "apoio_livepix_note": "for Brazilian supporters",
    "apoio_github_note": "via GitHub Sponsors",
    "toc_apoio": "Support the Project"
```

- [ ] **Step 3: Validate JSON** — parse the file to confirm no syntax errors:

```bash
python3 -c "import json,sys; json.load(open('static/data/i18n.json')); print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add static/data/i18n.json
git commit -m "feat: add i18n keys for donation spread"
```

---

### Task 2: Apoio spread HTML

**Files:**
- Modify: `templates/index.html` — insert the `data-role="apoio"` spread block after line 273 (`{% endfor %}`) and before the `<!-- ── SPREAD 19: PESQUISAR ──` comment.

**Interfaces:**
- Produces: `document.querySelector('[data-role="apoio"]')` returns the spread element.
- Consumes: CSS classes from Task 5, i18n keys from Task 1.

- [ ] **Step 1: Insert spread HTML** — in `templates/index.html`, after `{% endfor %}` (line 273) and before the `<!-- ── SPREAD 19 -->` comment, insert:

```html
      <!-- ── SPREAD APOIO: COLOFÃO ── -->
      <div class="book-spread" data-role="apoio">
        <div class="page-turn-layer"><div class="turn-front"></div><div class="turn-back"></div></div>

        <!-- Página esquerda — Colofão -->
        <div class="page page-left about-page apoio-page">
          <div class="curl-zone curl-left" role="button" aria-label="Página anterior"><div class="curl-surface"></div><div class="curl-hint">‹</div></div>

          <span class="about-eyebrow" data-stagger data-i18n="apoio_eyebrow">uma palavra do autor</span>

          <h2 class="about-heading apoio-heading" data-stagger data-i18n-html="apoio_heading">
            Feito com<br>curiosidade<br>e código.
          </h2>

          <div class="recipe-header-rule" data-stagger></div>

          <div class="about-body apoio-body" data-stagger>
            <p data-i18n="apoio_p1">O Foodpedia é um projeto independente — sem investidores, sem anúncios, feito por uma pessoa só.</p>
            <p data-i18n="apoio_p2">Se ele te trouxe uma receita nova, uma história inesperada ou simplesmente um momento de curiosidade, considere apoiar.</p>
            <p data-i18n="apoio_p3">Qualquer contribuição ajuda a manter o servidor ligado e o código evoluindo.</p>
          </div>

          <div class="handwritten-annotation annotation-1 multiline-i18n" data-stagger data-i18n="apoio_annotation">obrigado
por estar aqui</div>

          <div class="page-footer">
            <span class="footer-brand">Foodpedia</span>
            <span class="page-number"></span>
          </div>
        </div>

        <!-- Página direita — Selos de doação -->
        <div class="page page-right about-page apoio-page">
          <div class="curl-zone curl-right" role="button" aria-label="Próxima página"><div class="curl-surface"></div><div class="curl-hint">›</div></div>

          <div class="apoio-stamps-container" data-stagger>

            <!-- Selo Ko-fi -->
            <a href="https://ko-fi.com/ltcmnk" target="_blank" rel="noopener" class="apoio-stamp">
              <div class="apoio-stamp-stripe apoio-stamp-stripe--kofi"></div>
              <div class="apoio-stamp-body">
                <div class="apoio-stamp-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M6 7h12v7a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V7z"/>
                    <path d="M18 9c1.5 0 3 .8 3 2.5S19.5 14 18 14"/>
                    <path d="M8 7V5"/>
                    <path d="M12 7V4"/>
                    <path d="M16 7V5"/>
                  </svg>
                </div>
                <span class="apoio-stamp-platform">Ko-fi</span>
                <span class="apoio-stamp-url">ko-fi.com/ltcmnk</span>
              </div>
            </a>

            <p class="apoio-ornament" aria-hidden="true">✦</p>

            <!-- Selo Livepix -->
            <a href="https://livepix.gg/ltcmnk" target="_blank" rel="noopener" class="apoio-stamp">
              <div class="apoio-stamp-stripe apoio-stamp-stripe--livepix"></div>
              <div class="apoio-stamp-body">
                <div class="apoio-stamp-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polygon points="12,3 14.5,9 21,9 16,13.5 18,20 12,16 6,20 8,13.5 3,9 9.5,9"/>
                  </svg>
                </div>
                <span class="apoio-stamp-platform">Livepix</span>
                <span class="apoio-stamp-url">livepix.gg/ltcmnk</span>
                <span class="apoio-stamp-note" data-i18n="apoio_livepix_note">para brasileiros</span>
              </div>
            </a>

            <p class="apoio-ornament" aria-hidden="true">✦</p>

            <!-- Selo GitHub Sponsors -->
            <a href="https://github.com/sponsors/ltcmnk" target="_blank" rel="noopener" class="apoio-stamp">
              <div class="apoio-stamp-stripe apoio-stamp-stripe--github"></div>
              <div class="apoio-stamp-body">
                <div class="apoio-stamp-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 21C12 21 3 14.5 3 8.5a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12.5-9 12.5z"/>
                  </svg>
                </div>
                <span class="apoio-stamp-platform">GitHub Sponsors</span>
                <span class="apoio-stamp-url">github.com/sponsors/ltcmnk</span>
                <span class="apoio-stamp-note" data-i18n="apoio_github_note">via GitHub Sponsors</span>
              </div>
            </a>

          </div>

          <div class="page-footer">
            <span class="footer-brand">Foodpedia</span>
            <span class="page-number"></span>
          </div>
        </div>

      </div>
      <!-- ── FIM SPREAD APOIO ── -->
```

- [ ] **Step 2: Smoke-check template renders** — start the Flask app and verify the page loads without Jinja errors:

```bash
python3 -c "
from app import create_app
app = create_app()
with app.test_client() as c:
    r = c.get('/')
    assert r.status_code == 200, r.status_code
    assert b'data-role=\"apoio\"' in r.data
    print('OK')
"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add templates/index.html
git commit -m "feat: add donation spread HTML (colofão + stamps)"
```

---

### Task 3: Wire apoio spread into `rebuildBookLayout`

**Files:**
- Modify: `static/js/book.js`

**Interfaces:**
- Consumes: `document.querySelector('[data-role="apoio"]')` (Task 2)
- Produces: `SPREAD_APOIO` global set after every `rebuildBookLayout()` call; apoio spread appears in `BookState.layout` between the last base recipe and the first conditional spread; sequential navigation reaches apoio before back cover.

- [ ] **Step 1: Declare `SPREAD_APOIO`** — in `book.js`, near the top where other `SPREAD_*` variables are declared (around line 10–22), add after `SPREAD_RECIPES_END`:

```js
let SPREAD_APOIO = 0
```

- [ ] **Step 2: Select and insert apoio in `rebuildBookLayout`** — in `rebuildBookLayout()` (around line 444), after the `setup` selection (line 453) and before the `conditional` array construction (line 455), add:

```js
  const apoio = document.querySelector('[data-role="apoio"]')
```

Then in the `layout` array (line 462–472), change:
```js
    ...recipes,
    ...conditional,
```
to:
```js
    ...recipes,
    apoio,
    ...conditional,
```

- [ ] **Step 3: Set `SPREAD_APOIO` after layout build** — in `rebuildBookLayout()`, after `SPREAD_FAVORITES_TOC = favTocSpread ? layoutIndex(favTocSpread) : 0` (line 501), add:

```js
  SPREAD_APOIO = layoutIndex(apoio)
```

- [ ] **Step 4: Verify in browser** — open the app, open the book, navigate past the last base recipe. The next spread should show the colofão (left) and stamps (right). Check DevTools console for no errors.

- [ ] **Step 5: Commit**

```bash
git add static/js/book.js
git commit -m "feat: wire apoio spread into rebuildBookLayout"
```

---

### Task 4: TOC integration

**Files:**
- Modify: `static/js/book.js`

**Interfaces:**
- Consumes: `SPREAD_APOIO` (Task 3), i18n key `toc_apoio` (Task 1)
- Produces: TOC shows a separator line + "Apoiar o Projeto" link after the last base recipe; clicking the link navigates to the apoio spread; the page number is auto-populated by `updateTOCPageReferences`.

- [ ] **Step 1: Add separator + apoio entries to `tocEntries()`** — in `book.js`, in `tocEntries()` (around line 96), after the `forEach` loop that pushes base-recipe entries (line 112) and before the resultado block (line 114 comment), add:

```js
  // Apoio entry — separator + donation link after base recipes
  entries.push({ type: 'separator', weight: 0 })
  entries.push({ type: 'link', subtype: 'apoio', labelKey: 'toc_apoio', fallback: 'Apoiar o Projeto', targetKey: 'apoio', weight: 1 })
```

- [ ] **Step 2: Handle `separator` and `apoio` types in `tocPage()`** — in `book.js`, in `tocPage()` (around line 280), at the TOP of the `entries.map` callback, BEFORE the existing `if (entry.type === 'section')` check, add:

```js
    if (entry.type === 'separator') {
      return `<li class="toc-apoio-separator" data-toc-entry-index="${entryIndex}"></li>`
    }
    if (entry.subtype === 'apoio') {
      return `<li data-toc-entry-index="${entryIndex}" data-stagger>
        <a class="toc-entry toc-apoio-entry" href="#" data-target-key="apoio">
          <span class="toc-favorite-mark" aria-hidden="true">◆</span>
          <span class="toc-entry-title" data-i18n="toc_apoio">${entry.fallback || 'Apoiar o Projeto'}</span>
          <span class="toc-dots"></span><span class="toc-page" data-toc-page></span>
        </a>
      </li>`
    }
```

- [ ] **Step 3: Verify in browser** — open the TOC. The last entry should show a thin rule followed by a gold-◆ "Apoiar o Projeto" entry with a page number. Clicking it should navigate to the apoio spread.

- [ ] **Step 4: Verify i18n** — toggle to EN. The TOC entry should read "Support the Project".

- [ ] **Step 5: Commit**

```bash
git add static/js/book.js
git commit -m "feat: add apoio entry to TOC with separator"
```

---

### Task 5: CSS styles

**Files:**
- Modify: `static/css/book.css`

**Interfaces:**
- Produces: visual styling for `.apoio-page`, `.apoio-heading`, `.apoio-body`, `.apoio-stamps-container`, `.apoio-stamp` (+ sub-elements), `.apoio-ornament`, `.toc-apoio-separator`, `.toc-apoio-entry`.

- [ ] **Step 1: Add apoio page overrides** — append to the `/* ABOUT */` section in `book.css` (after `.about-eyebrow` block, around line 995):

```css
/* ── APOIO (Colofão + Selos) ── */
.apoio-page { padding: 40px 36px 40px; }

.apoio-heading {
  font-size: 22px;
  line-height: 1.15;
  margin-bottom: 16px;
}

.apoio-body {
  font-size: 11.5px;
  line-height: 1.58;
}
```

- [ ] **Step 2: Add stamp container and ornament**

```css
.apoio-stamps-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0;
  padding: 8px 0;
}

.apoio-ornament {
  font-family: 'Cedarville Cursive', cursive;
  font-size: 11px;
  color: var(--c-gold);
  opacity: 0.4;
  text-align: center;
  margin: 6px 0;
  display: block;
}
```

- [ ] **Step 3: Add `.apoio-stamp` base styles** (the card + double-border pattern matching recipe-card-border):

```css
.apoio-stamp {
  display: block;
  border: 1.5px solid var(--c-border);
  position: relative;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: transform 120ms ease-out;
  overflow: hidden;
}

.apoio-stamp::before,
.apoio-stamp::after {
  content: '';
  position: absolute;
  border: 0.75px solid var(--c-border);
  pointer-events: none;
}

.apoio-stamp::before { inset: 4px; opacity: 0.5; }
.apoio-stamp::after  { inset: 7px; border-width: 0.5px; opacity: 0.28; }

.apoio-stamp:hover { transform: rotate(-0.5deg) scale(1.01); }
```

- [ ] **Step 4: Add stripe styles**

```css
.apoio-stamp-stripe          { height: 9px; flex-shrink: 0; }
.apoio-stamp-stripe--kofi    { background: #FF5E5B; }
.apoio-stamp-stripe--livepix { background: var(--c-cover-red); }
.apoio-stamp-stripe--github  { background: #6e40c9; }

.apoio-stamp-stripe::after {
  content: '';
  display: block;
  height: 1.5px;
  background: var(--c-gold);
  opacity: 0.4;
}
```

- [ ] **Step 5: Add stamp body and typography**

```css
.apoio-stamp-body {
  padding: 8px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.apoio-stamp-icon {
  width: 22px;
  height: 22px;
  margin-bottom: 4px;
}

.apoio-stamp-icon svg { width: 100%; height: 100%; }

.apoio-stamp-platform {
  font-family: 'Homemade Apple', cursive;
  font-size: 16px;
  color: var(--c-ink);
  line-height: 1.1;
}

.apoio-stamp-url {
  font-family: 'Cedarville Cursive', cursive;
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--c-ink-faded);
}

.apoio-stamp-note {
  font-family: 'La Belle Aurore', cursive;
  font-size: 11px;
  font-style: italic;
  color: var(--c-ink-faded);
  margin-top: 2px;
}
```

- [ ] **Step 6: Add TOC apoio styles**

```css
/* TOC — apoio separator + entry */
.toc-apoio-separator {
  border-top: 0.75px solid var(--c-rule);
  margin: 6px 0;
  list-style: none;
}

.toc-apoio-entry .toc-entry-title { color: var(--c-ink-faded); }
.toc-apoio-entry .toc-favorite-mark { color: var(--c-gold); opacity: 0.7; }
```

- [ ] **Step 7: Visual check in browser** — navigate to the apoio spread and confirm:
  - Left: eyebrow in red cursive, heading in Homemade Apple ~22px, body text at 11.5px, green annotation at bottom.
  - Right: three stamps stacked with stripe + double border + gold separator line, platform name in Homemade Apple, URL in Cedarville Cursive, note in La Belle Aurore italic.
  - TOC: thin rule + gold ◆ "Apoiar o Projeto" entry with correct page number.
  - Hover on stamp causes gentle rotate+scale.

- [ ] **Step 8: Commit**

```bash
git add static/css/book.css
git commit -m "feat: CSS styles for donation spread and TOC apoio entry"
```

---

## Self-Review

**Spec coverage:**
- ✅ Left page: eyebrow, heading, rule, body, annotation, footer — Task 2
- ✅ Right page: Ko-fi, Livepix, GitHub Sponsors stamps — Task 2 (GitHub Sponsors added per user request)
- ✅ Sequential navigation: apoio inserted between `...recipes` and `...conditional` — Task 3
- ✅ TOC entry with separator + ◆ link + auto page number — Task 4
- ✅ No divider tab — not added
- ✅ i18n: all keys in PT + EN — Task 1
- ✅ `data-stagger` on all animated elements — Task 2
- ✅ `target="_blank" rel="noopener"` on all links — Task 2

**Out of scope (not in plan):** No donation API, no analytics, no auth.
