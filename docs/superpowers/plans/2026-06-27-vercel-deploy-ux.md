# Vercel Deploy UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare Foodpedia for public Vercel deployment by adding a three-state search spread (no-key / demo / search), specific Gemini error messages, a mobile warning notice, and scrollable result pages that replace the continuation spread.

**Architecture:** The search spread's right page is restructured into three absolutely-positioned sibling state divs (`#search-state-no-key`, `#search-state-demo`, `#search-state-search`). GSAP animates opacity between states. The backend gains a key-validation path in `/api/models`, `error_code` fields in error responses, and a restored demo branch in `/api/recipe`. The result continuation spread is removed entirely; the `.recipe-card-border` already scrolls (`overflow-y:auto`).

**Tech Stack:** Flask/Python (backend), vanilla JS + GSAP 3 (frontend), Jinja2 HTML, CSS custom properties.

## Global Constraints

- Styles use existing CSS custom properties: `var(--c-page-alt)`, `var(--c-border)`, `var(--c-ink)`, `var(--c-ink-faded)`, `var(--c-cover-red)`, `var(--c-rule)`, `var(--c-gold)`, `var(--c-red-accent)`.
- Fonts: `'Cedarville Cursive'`, `'Homemade Apple'`, `'Indie Flower'`, `'La Belle Aurore'`, `'Grape Nuts'`, `'EB Garamond'` — always use existing font variables/classes rather than adding new `@import`.
- GSAP is already loaded via CDN; use `gsap.to()` for crossfades.
- `reducedMotion` constant in `book.js` controls animation duration (already defined as `window.matchMedia('(prefers-reduced-motion: reduce)').matches`). Respect it: use `DUR.content` or `0.001` for reduced motion.
- All `localStorage` keys follow the `fp_` prefix convention for new keys; the Gemini key stays `gemini_key` (existing).
- `demo_recipes.json` already exists at `static/data/demo_recipes.json` with recipes including `name`, `category`, `illustration_key`.
- The `demo_service.py` already exists and is importable as `from app.services.demo_service import get_demo_recipe`.
- `IS_VERCEL = os.environ.get('VERCEL') == '1'` in `ai_router.py`.
- Tests use pytest with a Flask test client from `tests/conftest.py` (`client` fixture).
- `requests` package is already a dependency (used in `gemini_service.py`).

---

### Task 1: Backend — key validation, error codes, demo endpoint

**Files:**
- Modify: `app/services/gemini_service.py` — add `validate_gemini_key(key)` function
- Modify: `app/routes/api.py` — add `error_code` to all error responses; modify `/api/models` to accept `X-Gemini-Key` header for validation; add demo branch to `/api/recipe`
- Create: `tests/test_deploy_ux.py`

**Interfaces:**
- Produces: `validate_gemini_key(key: str) -> bool` in `gemini_service.py`
- Produces: `GET /api/models` with `X-Gemini-Key` header returns `{"key_valid": True}` (200) or `{"error_code": "auth_error"}` (401)
- Produces: `POST /api/recipe` with `{"demo": true, "dish": "..."}` returns demo recipe from `demo_service`
- Produces: all error responses in `/api/recipe` include `"error_code": "rate_limit" | "auth_error" | "generic"`

- [ ] **Step 1: Write failing tests**

Create `tests/test_deploy_ux.py`:

```python
import unittest.mock as mock
import pytest


# ── /api/models key validation ─────────────────────────────

def test_models_valid_key_returns_key_valid(client):
    with mock.patch('app.services.gemini_service.validate_gemini_key', return_value=True):
        resp = client.get('/api/models', headers={'X-Gemini-Key': 'AIzaFake'})
    assert resp.status_code == 200
    assert resp.get_json().get('key_valid') is True


def test_models_invalid_key_returns_401(client):
    with mock.patch('app.services.gemini_service.validate_gemini_key', return_value=False):
        resp = client.get('/api/models', headers={'X-Gemini-Key': 'AIzaBad'})
    assert resp.status_code == 401
    data = resp.get_json()
    assert data.get('error_code') == 'auth_error'


def test_models_no_key_header_works_normally(client):
    resp = client.get('/api/models')
    assert resp.status_code == 200
    assert 'models' in resp.get_json()


# ── /api/recipe demo mode ─────────────────────────────────

def test_recipe_demo_returns_demo_recipe(client):
    fake_recipe = {'name': 'Shakshuka', '_demo': True, 'illustration_key': 'spice'}
    with mock.patch('app.services.demo_service.get_demo_recipe', return_value=fake_recipe):
        resp = client.post('/api/recipe', json={'dish': 'Shakshuka', 'demo': True})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data.get('_demo') is True
    assert data.get('name') == 'Shakshuka'


def test_recipe_demo_requires_dish(client):
    resp = client.post('/api/recipe', json={'demo': True})
    assert resp.status_code == 400


# ── /api/recipe error_code field ─────────────────────────

def test_recipe_rate_limit_returns_error_code(client, monkeypatch):
    monkeypatch.setenv('VERCEL', '1')
    import requests as req_lib
    http_err = req_lib.exceptions.HTTPError(response=mock.MagicMock(status_code=429))
    with mock.patch('app.services.gemini_service._post_gemini', side_effect=http_err):
        resp = client.post('/api/recipe', json={
            'dish': 'pizza', 'provider': 'gemini', 'gemini_key': 'AIzaFake'
        })
    assert resp.status_code == 429
    data = resp.get_json()
    assert data.get('error_code') == 'rate_limit'


def test_recipe_auth_error_returns_error_code(client, monkeypatch):
    monkeypatch.setenv('VERCEL', '1')
    import requests as req_lib
    http_err = req_lib.exceptions.HTTPError(response=mock.MagicMock(status_code=401))
    with mock.patch('app.services.gemini_service._post_gemini', side_effect=http_err):
        resp = client.post('/api/recipe', json={
            'dish': 'pizza', 'provider': 'gemini', 'gemini_key': 'AIzaFake'
        })
    assert resp.status_code == 401
    data = resp.get_json()
    assert data.get('error_code') == 'auth_error'


def test_recipe_generic_error_has_error_code(client, monkeypatch):
    monkeypatch.setenv('VERCEL', '1')
    with mock.patch('app.services.gemini_service._post_gemini', side_effect=Exception('boom')):
        resp = client.post('/api/recipe', json={
            'dish': 'pizza', 'provider': 'gemini', 'gemini_key': 'AIzaFake'
        })
    assert resp.status_code == 500
    data = resp.get_json()
    assert data.get('error_code') == 'generic'
```

- [ ] **Step 2: Run tests to verify they all fail**

```bash
cd /Users/iuk/foodpedia && .venv/bin/python -m pytest tests/test_deploy_ux.py -v 2>&1 | head -60
```

Expected: all tests FAIL (functions not yet implemented).

- [ ] **Step 3: Add `validate_gemini_key` to `gemini_service.py`**

Add this function at the end of `app/services/gemini_service.py` (after `list_gemini_models`):

```python
def validate_gemini_key(key: str) -> bool:
    import requests as r
    if not key or not key.strip():
        return False
    try:
        resp = r.get(
            'https://generativelanguage.googleapis.com/v1beta/models',
            params={'key': key.strip()},
            timeout=5,
        )
        return resp.status_code == 200
    except Exception:
        return False
```

- [ ] **Step 4: Modify `/api/models` in `app/routes/api.py`**

Replace the existing `get_models` function (lines 42–73) with:

```python
@api_bp.route('/models', methods=['GET'])
def get_models():
    from app.services.ollama_service import check_ollama_available, list_ollama_models
    from app.services.gemini_service import check_gemini_available, list_gemini_models, validate_gemini_key

    # Key validation mode: X-Gemini-Key header present
    incoming_key = request.headers.get('X-Gemini-Key', '').strip()
    if incoming_key:
        valid = validate_gemini_key(incoming_key)
        if not valid:
            return jsonify({'error': 'INVALID_KEY', 'error_code': 'auth_error'}), 401
        return jsonify({
            'key_valid': True,
            'models': list_gemini_models(),
        })

    ollama_ok = check_ollama_available()
    gemini_ok = check_gemini_available()
    ollama_models = list_ollama_models() if ollama_ok else []

    flat_models = ollama_models or (['gemma3:latest'] if not gemini_ok else [])

    return jsonify({
        'models': flat_models,
        'providers': {
            'ollama': {
                'available': ollama_ok,
                'models': ollama_models,
                'label': 'Ollama (local)',
                'requires_setup': True,
                'setup_url': 'https://ollama.com',
            },
            'gemini': {
                'available': gemini_ok,
                'models': list_gemini_models(),
                'label': 'Google Gemini (API key)',
                'requires_setup': False,
                'key_configured': gemini_ok,
                'free_tier_info': '15 req/min grátis — obtenha em aistudio.google.com',
            },
        },
    })
```

- [ ] **Step 5: Modify `/api/recipe` to add demo branch and error_code fields**

Replace the existing `get_recipe` function (lines 78–125) in `app/routes/api.py` with:

```python
@api_bp.route('/recipe', methods=['POST'])
def get_recipe():
    import requests as req_lib
    data = request.get_json() or {}
    dish = data.get('dish', '').strip()
    demo = bool(data.get('demo', False))
    model = (data.get('model') or '').strip() or None
    lang = data.get('lang', 'pt')

    provider = (data.get('provider') or '').strip() or current_app.config.get('AI_PROVIDER', 'ollama')
    gemini_key = (data.get('gemini_key') or '').strip() or None

    if not dish:
        return jsonify({'error': 'MISSING_DISH', 'error_code': 'generic', 'message': 'Prato não informado'}), 400
    if len(dish) < 2:
        return jsonify({'error': 'DISH_TOO_SHORT', 'error_code': 'generic', 'message': 'Nome do prato muito curto'}), 400
    if len(dish) > 100:
        return jsonify({'error': 'DISH_TOO_LONG', 'error_code': 'generic', 'message': 'Nome do prato muito longo'}), 400

    # Demo mode: serve from local demo_recipes.json
    if demo:
        from app.services.demo_service import get_demo_recipe
        try:
            recipe = get_demo_recipe(dish)
            return jsonify(recipe)
        except Exception as e:
            logger.error("Demo recipe error for '%s': %s", dish, e)
            return jsonify({'error': 'DEMO_UNAVAILABLE', 'error_code': 'generic', 'message': 'Receitas de demonstração indisponíveis'}), 503

    from app.services.ai_router import get_recipe_from_ai

    try:
        recipe = get_recipe_from_ai(dish, provider=provider, model=model, lang=lang, key=gemini_key)
        return jsonify(recipe)

    except ValueError as e:
        msg = str(e)
        if 'GEMINI_API_KEY' in msg:
            return jsonify({
                'error': 'GEMINI_KEY_MISSING',
                'error_code': 'auth_error',
                'message': 'Configure a variável GEMINI_API_KEY. Obtenha gratuitamente em aistudio.google.com',
            }), 400
        logger.error("Recipe parse error for '%s': %s", dish, e)
        return jsonify({'error': 'PARSE_ERROR', 'error_code': 'generic', 'message': 'Resposta inválida do modelo'}), 500

    except req_lib.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else 0
        if status == 429:
            return jsonify({'error': 'RATE_LIMIT', 'error_code': 'rate_limit', 'message': 'Limite de requisições atingido'}), 429
        elif status in (401, 403):
            return jsonify({'error': 'AUTH_ERROR', 'error_code': 'auth_error', 'message': 'Chave inválida'}), 401
        logger.error("Gemini HTTP error %s for '%s': %s", status, dish, e)
        return jsonify({'error': 'GEMINI_ERROR', 'error_code': 'generic', 'message': 'Erro ao chamar Gemini'}), 502

    except ConnectionError as e:
        return jsonify({
            'error': 'OLLAMA_OFFLINE',
            'error_code': 'generic',
            'message': 'Ollama não está rodando. Inicie com: ollama serve',
        }), 503

    except TimeoutError as e:
        return jsonify({
            'error': 'TIMEOUT',
            'error_code': 'generic',
            'message': 'O modelo demorou demais para responder. Tente novamente.',
        }), 504

    except Exception as e:
        logger.error("Unexpected error for dish '%s' provider '%s': %s", dish, provider, e)
        return jsonify({'error': 'INTERNAL_ERROR', 'error_code': 'generic', 'message': 'Falha ao processar receita'}), 500
```

Add `import requests as req_lib` at the top of `app/routes/api.py` (after the existing imports):

```python
import logging
import requests as req_lib
from flask import Blueprint, request, jsonify, current_app
```

- [ ] **Step 6: Run tests to verify they all pass**

```bash
cd /Users/iuk/foodpedia && .venv/bin/python -m pytest tests/test_deploy_ux.py -v
```

Expected: all 8 tests PASS.

- [ ] **Step 7: Run full test suite to catch regressions**

```bash
cd /Users/iuk/foodpedia && .venv/bin/python -m pytest -v
```

Expected: all tests pass (including existing `test_api_key_flow.py`).

- [ ] **Step 8: Commit**

```bash
git add app/services/gemini_service.py app/routes/api.py tests/test_deploy_ux.py
git commit -m "feat: add key validation, error_code fields, and demo mode to backend"
```

---

### Task 2: Remove continuation spread, add scroll reset to result

**Files:**
- Modify: `templates/index.html` — remove `<div id="result-continuation-container"></div>` (line 389)
- Modify: `static/js/book.js` — remove `extractOverflowItems`, `ensureResultPagination`, and all `result-continuation` references; add scroll reset in `populateResultSpread`; remove `result-continuation` from `updateDividerTabs` and `currentPrintableRecipe`
- Modify: `static/css/book.css` — remove `.result-continuation-card`, `.continuation-title`, `.continuation-ornament`; add scroll indicator on result cards

**Interfaces:**
- Consumes: nothing new — pure removal
- Produces: result spread pages scroll their content independently; scroll resets when navigating to result

- [ ] **Step 1: Remove `#result-continuation-container` from HTML**

In `templates/index.html`, remove this line (around line 389, right after the result spread closing `</div>`):

```html
      <div id="result-continuation-container"></div>
```

- [ ] **Step 2: Remove `extractOverflowItems` and `ensureResultPagination` from `book.js`**

In `static/js/book.js`, remove the entire `extractOverflowItems` function (lines 1226–1234):

```js
function extractOverflowItems(list, card, minItems) {
  const overflow = []
  while (list && card && list.children.length > minItems && card.scrollHeight > card.clientHeight + 2) {
    const item = list.lastElementChild
    if (!item) break
    overflow.unshift(item.textContent.trim())
    item.remove()
  }
  return overflow
}
```

Remove the entire `ensureResultPagination` function (lines 1237–1314):

```js
function ensureResultPagination(recipe) {
  const host = document.getElementById('result-continuation-container')
  if (!host) return
  host.innerHTML = ''
  // ... all 77 lines through the closing brace
}
```

- [ ] **Step 3: Remove `result-continuation` references in `rebuildBookLayout`**

In `rebuildBookLayout` (around line 361), change:

```js
  const resultContinuations = [...document.querySelectorAll('[data-role="result-continuation"]')]
```
to remove it, and change:

```js
  if (BookState.resultAvailable && result) conditional.push(result, ...resultContinuations)
```
to:

```js
  if (BookState.resultAvailable && result) conditional.push(result)
```

Also remove `resultContinuations` from the `const` declarations: remove the entire line `const resultContinuations = [...]`.

- [ ] **Step 4: Remove `result-continuation` from `spreadKey`**

In `spreadKey` function (around line 94), change:

```js
  if (spread.dataset.role === 'result' || spread.dataset.role === 'result-continuation') {
    return 'result:current'
  }
```
to:

```js
  if (spread.dataset.role === 'result') {
    return 'result:current'
  }
```

- [ ] **Step 5: Remove `result-continuation` from `updateDividerTabs`**

In `updateDividerTabs` (around line 951), change:

```js
  else if (role === 'result' || role === 'result-continuation' || role === 'error' || role === 'setup') section = 'result'
```
to:

```js
  else if (role === 'result' || role === 'error' || role === 'setup') section = 'result'
```

- [ ] **Step 6: Remove `result-continuation` from `currentPrintableRecipe`**

In `currentPrintableRecipe` (around line 1987), change:

```js
  if (spread.dataset.role === 'result' || spread.dataset.role === 'result-continuation') {
```
to:

```js
  if (spread.dataset.role === 'result') {
```

- [ ] **Step 7: Remove `ensureResultPagination` call sites**

Search for and remove all calls to `ensureResultPagination(...)`:

- In `notifyRecipeReady` (around line 1494): remove the line `ensureResultPagination(recipe)`
- In `showRecipeResult` (around line 1559): remove the line `ensureResultPagination(recipe)` inside the `.then()` callback

- [ ] **Step 8: Add scroll reset in `populateResultSpread`**

Find `populateResultSpread` (around line 1162 — the function that sets `res-category`, `res-name`, etc.). Add these two lines at the very start of the function body:

```js
  document.getElementById('result-left-card')?.scrollTo(0, 0)
  document.querySelector('#result-right .recipe-card-border')?.scrollTo(0, 0)
```

- [ ] **Step 9: Remove continuation CSS from `book.css`**

In `static/css/book.css`, remove this entire block (around lines 1235–1251):

```css
.result-continuation-card {
  overflow:hidden;
}
.continuation-title {
  font-family:'Homemade Apple',cursive;
  font-size:22px;
  line-height:1.2;
  color:var(--c-ink);
  margin:7px 0 20px;
}
.continuation-ornament {
  width:34%;
  margin:28px auto 0;
  opacity:.42;
  color:var(--c-gold);
}
.continuation-ornament svg { width:100%; height:auto; }
```

Also remove `.continues-hint` rule (around line 943). Search for:

```css
.continues-hint {
```

and remove that entire rule block.

- [ ] **Step 10: Add scroll indicator on result spread cards**

In `static/css/book.css`, in the `/* RESULT */` section (find the section with `#result-left`, `#result-right`), add:

```css
[data-role="result"] .recipe-card-border {
  box-shadow: inset -2px 0 0 var(--c-border);
}
```

- [ ] **Step 11: Verify in browser**

Start the server: `cd /Users/iuk/foodpedia && .venv/bin/python -m flask --app app run --debug`

Open http://localhost:5000, open the book, navigate to Pesquisar, search for a recipe with a long ingredient list (e.g., "Baklava"). Verify:
- Result appears on one spread only (no second spread)
- The left and right pages scroll independently if content overflows
- After navigating away and back to result, scroll resets to top on both pages
- A faint 2px border appears on the right edge of both result cards

- [ ] **Step 12: Commit**

```bash
git add templates/index.html static/js/book.js static/css/book.css
git commit -m "feat: replace result continuation spread with scrollable pages"
```

---

### Task 3: Three-state search spread (HTML + JS + CSS)

**Files:**
- Modify: `templates/index.html` — restructure search right page into three states
- Modify: `static/js/book.js` — add `showSearchState`, `showDemoState`, `validateAndSaveGeminiKey`, `clickDemoRecipe`, `goToKeyState`, `showSearchKeyError`, `clearSearchKeyError`, `initSearchStates`; modify `fetchRecipe` and `startRecipeSearch` to accept `{ demo }` option
- Modify: `static/css/book.css` — add styles for state container, each state, demo cards, key input, "saved" hint

**Interfaces:**
- Consumes: `GET /api/models` with `X-Gemini-Key` header (from Task 1)
- Consumes: `POST /api/recipe` with `{demo: true}` (from Task 1)
- Consumes: `getGeminiKey()` — existing function in `book.js`
- Produces: `showSearchState(state: 'no-key' | 'demo' | 'search')` — callable from anywhere
- Produces: `startRecipeSearch(query, { demo = false })` — extended signature (backward-compatible)

- [ ] **Step 1: Restructure the search right page HTML**

In `templates/index.html`, find the search right page block (around line 302–316):

```html
      <div class="page page-right search-right">
          <div class="curl-zone curl-right" role="button" aria-label="Próxima página"><div class="curl-surface"></div><div class="curl-hint">›</div></div>
          <div class="recipe-card-border" style="display:flex;flex-direction:column;justify-content:center;">
            <p class="search-question" data-stagger data-i18n="search_question">Qual prato você quer conhecer?</p>
            <div class="search-ruled-line" data-stagger></div>
            <input type="text" id="recipe-search"
                   placeholder="escreva um prato..."
                   autocomplete="off" data-stagger>
            <p class="search-hint" data-stagger data-i18n="search_hint">pressione Enter para consultar</p>
          </div>
          <div class="page-footer">
            <span class="footer-brand">Foodpedia</span>
            <span class="page-number">39</span>
          </div>
        </div>
```

Replace it entirely with:

```html
      <div class="page page-right search-right">
          <div class="curl-zone curl-right" role="button" aria-label="Próxima página"><div class="curl-surface"></div><div class="curl-hint">›</div></div>
          <div class="search-states-container">

            <!-- State A: no key -->
            <div id="search-state-no-key" class="search-state">
              <div class="recipe-card-border search-state-card" style="display:flex;flex-direction:column;justify-content:center;gap:16px;">
                <p class="search-nokey-intro">para pesquisar receitas com IA, você precisa de uma chave Gemini gratuita</p>
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" class="search-nokey-link">aistudio.google.com/apikey ↗</a>
                <div class="search-key-row">
                  <input id="search-key-input" type="password" placeholder="AIza..." autocomplete="off" class="search-key-field">
                  <button id="search-key-confirm" class="search-key-btn" onclick="validateAndSaveGeminiKey()">confirmar</button>
                </div>
                <p id="search-key-error" class="search-key-error" style="display:none;">chave inválida — verifique em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color:var(--c-cover-red)">aistudio.google.com</a></p>
                <button class="search-demo-link" onclick="showDemoState()">ou experimente com receitas de demonstração →</button>
              </div>
            </div>

            <!-- State B: demo -->
            <div id="search-state-demo" class="search-state">
              <div class="recipe-card-border search-state-card" style="display:flex;flex-direction:column;">
                <p class="search-question" style="margin-bottom:14px;">Escolha uma receita clássica</p>
                <div id="demo-cards-container" class="demo-cards-grid"></div>
                <p class="search-demo-footer">modo demonstração · <button onclick="showSearchState('no-key')" class="search-demo-footer-link">configurar chave Gemini →</button></p>
              </div>
            </div>

            <!-- State C: search (normal) -->
            <div id="search-state-search" class="search-state">
              <div class="recipe-card-border search-state-card" style="display:flex;flex-direction:column;justify-content:center;">
                <p class="search-question" data-stagger data-i18n="search_question">Qual prato você quer conhecer?</p>
                <div class="search-ruled-line" data-stagger></div>
                <input type="text" id="recipe-search"
                       placeholder="escreva um prato..."
                       autocomplete="off" data-stagger>
                <p class="search-hint" data-stagger data-i18n="search_hint">pressione Enter para consultar</p>
                <div id="search-inline-error" class="search-inline-error" style="display:none;"></div>
                <p class="search-key-saved-hint">chave Gemini salva · <button onclick="goToKeyState()" class="search-key-change-btn">trocar →</button></p>
              </div>
            </div>

          </div>
          <div class="page-footer">
            <span class="footer-brand">Foodpedia</span>
            <span class="page-number">39</span>
          </div>
        </div>
```

- [ ] **Step 2: Add CSS for search states**

In `static/css/book.css`, after the existing `/* SEARCH */` section (after line ~939), add:

```css
/* ── SEARCH STATES ── */
.search-states-container {
  position: relative;
  flex: 1;
  min-height: 0;
}
.search-state {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  transition: none;
}
.search-state-card {
  margin: 0;
  height: 100%;
}
.search-nokey-intro {
  font-family:'Indie Flower',cursive;
  font-size: 13px;
  color: var(--c-ink);
  line-height: 1.6;
}
.search-nokey-link {
  font-family:'Cedarville Cursive',cursive;
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--c-cover-red);
  text-decoration: none;
}
.search-nokey-link:hover { text-decoration: underline; }
.search-key-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.search-key-field {
  flex: 1;
  font-family: monospace;
  font-size: 11px;
  padding: 5px 8px;
  border: 1px solid var(--c-rule);
  border-radius: 2px;
  background: var(--c-page);
  color: var(--c-ink);
  outline: none;
}
.search-key-field.error {
  border-color: var(--c-cover-red);
}
.search-key-btn {
  font-family: 'Cedarville Cursive', cursive;
  font-size: 11px;
  color: #FAF7F0;
  background: var(--c-cover-red);
  border: none;
  padding: 5px 12px;
  border-radius: 2px;
  cursor: pointer;
  white-space: nowrap;
}
.search-key-btn:disabled { opacity: 0.5; cursor: default; }
.search-key-error {
  font-family: 'Indie Flower', cursive;
  font-size: 11px;
  color: var(--c-cover-red);
  line-height: 1.5;
}
.search-demo-link {
  font-family: 'Indie Flower', cursive;
  font-size: 11px;
  color: var(--c-ink-faded);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: text-decoration-color 120ms;
}
.search-demo-link:hover { text-decoration-color: var(--c-ink-faded); }
.demo-cards-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
}
.demo-cards-grid::-webkit-scrollbar { display: none; }
.demo-recipe-card {
  font-family: 'Grape Nuts', cursive;
  font-size: 14px;
  color: var(--c-ink);
  background: transparent;
  border: 0.75px solid var(--c-border);
  border-radius: 2px;
  padding: 7px 12px;
  text-align: left;
  cursor: pointer;
  transition: background 120ms;
  flex-shrink: 0;
}
.demo-recipe-card:hover { background: var(--c-page-alt); }
.search-demo-footer {
  font-family: 'Indie Flower', cursive;
  font-size: 10px;
  color: var(--c-ink-faded);
  margin-top: 10px;
  flex-shrink: 0;
}
.search-demo-footer-link {
  font-family: inherit;
  font-size: inherit;
  color: var(--c-ink-faded);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
}
.search-key-saved-hint {
  font-family: 'Indie Flower', cursive;
  font-size: 10px;
  color: var(--c-ink-faded);
  margin-top: 10px;
  opacity: 0.7;
}
.search-key-change-btn {
  font-family: inherit;
  font-size: inherit;
  color: var(--c-ink-faded);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
}
```

- [ ] **Step 3: Add JS functions for state management**

In `static/js/book.js`, after the `// ── GEMINI KEY MANAGEMENT ──` section (after the existing `saveOnboardGeminiKey` function, around line 1453), add:

```js
// ── SEARCH SPREAD STATE MANAGEMENT ──

let _demoRecipes = null

function showSearchState(state) {
  const states = ['no-key', 'demo', 'search']
  const dur = reducedMotion ? 0.001 : 0.2
  states.forEach(s => {
    const el = document.getElementById(`search-state-${s}`)
    if (!el) return
    if (s === state) {
      gsap.to(el, { opacity: 1, duration: dur, ease: 'power1.inOut',
        onComplete: () => { el.style.pointerEvents = 'auto' } })
    } else {
      el.style.pointerEvents = 'none'
      gsap.to(el, { opacity: 0, duration: dur * 0.75, ease: 'power1.inOut' })
    }
  })
}

async function showDemoState() {
  if (!_demoRecipes) {
    try { _demoRecipes = await fetchStaticJson('static/data/demo_recipes.json') }
    catch { _demoRecipes = [] }
  }
  const container = document.getElementById('demo-cards-container')
  if (container && _demoRecipes.length) {
    container.innerHTML = _demoRecipes.map(r => {
      const safe = (r.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;')
      return `<button class="demo-recipe-card" onclick="clickDemoRecipe('${safe}')">${r.name || ''}</button>`
    }).join('')
  }
  showSearchState('demo')
}

function clickDemoRecipe(name) {
  startRecipeSearch(name, { demo: true })
}

function goToKeyState() {
  const stored = getGeminiKey()
  const input = document.getElementById('search-key-input')
  if (input && stored) input.value = stored
  clearSearchKeyError()
  showSearchState('no-key')
}

function showSearchKeyError() {
  const input = document.getElementById('search-key-input')
  const errEl = document.getElementById('search-key-error')
  if (input) {
    input.classList.add('error')
    input.addEventListener('input', clearSearchKeyError, { once: true })
  }
  if (errEl) errEl.style.display = ''
}

function clearSearchKeyError() {
  const input = document.getElementById('search-key-input')
  const errEl = document.getElementById('search-key-error')
  if (input) input.classList.remove('error')
  if (errEl) errEl.style.display = 'none'
}

async function validateAndSaveGeminiKey() {
  const input = document.getElementById('search-key-input')
  const btn = document.getElementById('search-key-confirm')
  const key = (input?.value || '').trim()
  if (!key) { showSearchKeyError(); return }
  if (btn) btn.disabled = true
  clearSearchKeyError()
  try {
    const res = await fetch('/api/models', { headers: { 'X-Gemini-Key': key } })
    if (res.ok) {
      localStorage.setItem('gemini_key', key)
      const setupInput = document.getElementById('gemini-key-input')
      if (setupInput) setupInput.value = key
      showSearchState('search')
    } else {
      showSearchKeyError()
    }
  } catch {
    showSearchKeyError()
  } finally {
    if (btn) btn.disabled = false
  }
}

function initSearchStates() {
  if (getGeminiKey()) {
    showSearchState('search')
  } else {
    showSearchState('no-key')
  }
}
```

- [ ] **Step 4: Modify `fetchRecipe` to accept `{ demo }` option**

Find the `async function fetchRecipe(query)` signature (around line 1457). Change it to:

```js
async function fetchRecipe(query, { demo = false } = {}) {
```

Inside the function, find the block that builds the request body (around line 1463):

```js
  const body = { dish: query, lang: currentLang }
  if (BookState.selectedProvider) body.provider = BookState.selectedProvider
  if (BookState.selectedModel)    body.model    = BookState.selectedModel
  const geminiKey = getGeminiKey()
  if (geminiKey) body.gemini_key = geminiKey
```

Replace with:

```js
  const body = { dish: query, lang: currentLang }
  if (demo) {
    body.demo = true
  } else {
    if (BookState.selectedProvider) body.provider = BookState.selectedProvider
    if (BookState.selectedModel)    body.model    = BookState.selectedModel
    const geminiKey = getGeminiKey()
    if (geminiKey) body.gemini_key = geminiKey
  }
```

- [ ] **Step 5: Modify `startRecipeSearch` to accept `{ demo }` option**

Find `async function startRecipeSearch(query)` (around line 1604). Change to:

```js
async function startRecipeSearch(query, { demo = false } = {}) {
```

Find the line that calls `fetchRecipe(query)` (around line 1619):

```js
  const fetchPromise = fetchRecipe(query).then(r => { recipe = r }).catch(e => { fetchError = e })
```

Change to:

```js
  const fetchPromise = fetchRecipe(query, { demo }).then(r => { recipe = r }).catch(e => { fetchError = e })
```

- [ ] **Step 6: Call `initSearchStates()` at startup**

Find the main init block near the end of `book.js` (around line 2560–2583, where `loadI18n()` and `document.fonts?.ready` are called). Add `initSearchStates()` after `loadProviders()` (which is called around line 1408). The best place is right after `loadProviders()`:

```js
loadProviders()
initSearchStates()
```

- [ ] **Step 7: Add Enter key handler for search-key-input**

The existing `searchInput` listener (around line 1670) handles `#recipe-search`. Add a similar handler for `#search-key-input` right after that block:

```js
const searchKeyInput = document.getElementById('search-key-input')
if (searchKeyInput) {
  searchKeyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') validateAndSaveGeminiKey()
  })
}
```

- [ ] **Step 8: Verify in browser — three-state flow**

Start server: `cd /Users/iuk/foodpedia && .venv/bin/python -m flask --app app run --debug`

Test flow:
1. Clear `gemini_key` from localStorage (DevTools > Application > Local Storage). Reload. Navigate to Pesquisar tab → right page should show State A (no-key intro + link + key input + demo link).
2. Click "ou experimente com receitas de demonstração →" → right page crossfades to State B (demo cards).
3. Click a demo card → recipe loads (demo stamp visible on result).
4. Reload page → returns to State A (demo mode not persisted).
5. In State A, enter a valid Gemini key and click confirmar → State C appears (normal search form with "chave Gemini salva · Trocar →").
6. Click "Trocar →" → returns to State A (with key pre-filled in input).
7. In State A, enter an invalid key (e.g., "bad") and click confirmar → red border on input, inline error appears.

- [ ] **Step 9: Commit**

```bash
git add templates/index.html static/js/book.js static/css/book.css
git commit -m "feat: three-state search spread (no-key / demo / search)"
```

---

### Task 4: Inline error handling for rate_limit and auth_error

**Files:**
- Modify: `static/js/book.js` — add `lastSimpleCode` to `BookState`; read `error_code` in `fetchRecipe`; add `showSearchInlineError` and `clearSearchInlineError`; modify `startRecipeSearch` error handler to show inline errors for non-generic codes
- Modify: `static/css/book.css` — style for `.search-inline-error`

**Interfaces:**
- Consumes: `BookState.lastSimpleCode` — new field (set in `fetchRecipe`)
- Consumes: `showSearchState('search')` — navigate to search state before showing inline error
- Produces: `showSearchInlineError(simpleCode)` — shows message inside State C without leaving search spread

- [ ] **Step 1: Add `lastSimpleCode` to `BookState`**

In `static/js/book.js`, find the `BookState` object (around line 26). Add `lastSimpleCode: null` after `lastErrorCode: null`:

```js
const BookState = {
  currentSpread: 0,
  phase: 'cover',
  pendingRecipe: null,
  loadingQuery: null,
  isAnimating: false,
  selectedModel: null,
  selectedProvider: null,
  lastErrorCode: null,
  lastSimpleCode: null,       // <-- add this
  currentRecipe: null,
  ...
}
```

- [ ] **Step 2: Read `error_code` in `fetchRecipe`**

Find the error parsing in `fetchRecipe` (around line 1479):

```js
    let errorCode = 'INTERNAL_ERROR'
    try { errorCode = (await res.json()).error || errorCode } catch {}
    BookState.lastErrorCode = errorCode
    throw new Error(errorCode)
```

Replace with:

```js
    let errorCode = 'INTERNAL_ERROR'
    let simpleCode = 'generic'
    try {
      const errData = await res.json()
      errorCode = errData.error || errorCode
      simpleCode = errData.error_code || simpleCode
    } catch {}
    BookState.lastErrorCode = errorCode
    BookState.lastSimpleCode = simpleCode
    throw new Error(errorCode)
```

- [ ] **Step 3: Add inline error functions to `book.js`**

After the `clearSearchKeyError` function (from Task 3), add:

```js
function showSearchInlineError(simpleCode) {
  const el = document.getElementById('search-inline-error')
  if (!el) return
  const t = (key, fallback) => window._i18nStrings?.[currentLang]?.[key] || fallback
  if (simpleCode === 'rate_limit') {
    el.textContent = t('error_rate_limit', 'muitas pesquisas em pouco tempo — aguarde alguns minutos')
    el.dataset.action = ''
  } else if (simpleCode === 'auth_error') {
    el.innerHTML = t('error_auth_inline', 'chave inválida — verifique em aistudio.google.com')
      + ' <button class="search-inline-error-link" onclick="goToKeyState()">Trocar chave →</button>'
  } else {
    return
  }
  el.style.display = ''
}

function clearSearchInlineError() {
  const el = document.getElementById('search-inline-error')
  if (el) el.style.display = 'none'
}
```

- [ ] **Step 4: Modify `startRecipeSearch` error handler**

In `startRecipeSearch`, find both error-handling blocks (the one after `Promise.race` and the one after `await fetchPromise`). Each currently reads:

```js
  if (fetchError) {
    BookState.phase = 'browsing'
    BookState.resultAvailable = false
    BookState.errorActive = true
    BookState.setupActive = false
    rebuildBookLayout({ keepCurrent: true })
    populateErrorSpread(BookState.lastErrorCode || 'INTERNAL_ERROR')
    await navigateToSpread(SPREAD_ERROR)
    return
  }
```

Change BOTH occurrences to:

```js
  if (fetchError) {
    const simpleCode = BookState.lastSimpleCode || 'generic'
    if (simpleCode === 'rate_limit' || simpleCode === 'auth_error') {
      BookState.phase = 'browsing'
      BookState.resultAvailable = false
      BookState.errorActive = false
      BookState.setupActive = false
      rebuildBookLayout({ keepCurrent: true })
      showSearchInlineError(simpleCode)
      await navigateToSpread(SPREAD_SEARCH)
      return
    }
    BookState.phase = 'browsing'
    BookState.resultAvailable = false
    BookState.errorActive = true
    BookState.setupActive = false
    rebuildBookLayout({ keepCurrent: true })
    populateErrorSpread(BookState.lastErrorCode || 'INTERNAL_ERROR')
    await navigateToSpread(SPREAD_ERROR)
    return
  }
```

- [ ] **Step 5: Clear inline error on new search**

In `startRecipeSearch`, right after the guard `if (BookState.phase === 'loading') return`, add:

```js
  clearSearchInlineError()
```

- [ ] **Step 6: Add CSS for inline error**

In `static/css/book.css`, in the `/* SEARCH STATES */` section added in Task 3, add:

```css
.search-inline-error {
  font-family: 'Indie Flower', cursive;
  font-size: 11px;
  color: var(--c-cover-red);
  line-height: 1.5;
  margin-top: 8px;
}
.search-inline-error-link {
  font-family: inherit;
  font-size: inherit;
  color: var(--c-cover-red);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
}
```

- [ ] **Step 7: Verify in browser**

To test rate_limit without a real Gemini call, temporarily add a mock. In the browser console:

```js
// Temporarily intercept fetch to simulate rate limit
const origFetch = window.fetch
window.fetch = async (...args) => {
  if (args[0] === '/api/recipe') {
    return new Response(JSON.stringify({error: 'RATE_LIMIT', error_code: 'rate_limit'}), {status: 429})
  }
  return origFetch(...args)
}
```

Then search for any dish. The book should stay on the search spread and show the rate limit message inline below the search field. Reload to restore normal behavior.

- [ ] **Step 8: Commit**

```bash
git add static/js/book.js static/css/book.css
git commit -m "feat: show rate_limit and auth_error inline in search spread"
```

---

### Task 5: Mobile notice

**Files:**
- Modify: `templates/index.html` — add `#mobile-notice` div after `#onboarding-hint`
- Modify: `static/js/book.js` — add `initMobileNotice()` function; call it after cover opens
- Modify: `static/css/book.css` — style for `#mobile-notice`

**Interfaces:**
- Consumes: `localStorage.getItem('fp_mobile_notice_dismissed')` — persists dismissal
- Consumes: `isMobileLayout()` — existing function `() => window.matchMedia('(max-width: 768px)').matches`
- Consumes: book open animation completes (hook into existing `animateCoverOpen` callback or `goToSection` call)

- [ ] **Step 1: Add `#mobile-notice` to HTML**

In `templates/index.html`, find `#onboarding-hint` (around line 631):

```html
<div id="onboarding-hint" style="display:none;">
  <span data-i18n="onboarding">Clique na capa para abrir o livro</span>
</div>
```

After it, add:

```html
<div id="mobile-notice" style="display:none;">
  <p id="mobile-notice-text">o Foodpedia foi projetado para desktop. em telas menores, algumas páginas podem não se comportar como esperado.</p>
  <button id="mobile-notice-dismiss" onclick="dismissMobileNotice()">continuar mesmo assim</button>
</div>
```

- [ ] **Step 2: Add CSS for mobile notice**

In `static/css/book.css`, after the `/* SHORTCUTS OVERLAY */` section, add:

```css
/* ──────────────────────────
   MOBILE NOTICE
─────────────────────────── */
#mobile-notice {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 150;
  background: var(--c-page-alt);
  border: 1px solid var(--c-border);
  border-radius: 3px;
  padding: 16px 20px;
  max-width: 320px;
  width: calc(100vw - 48px);
  text-align: center;
  box-shadow: 0 4px 16px rgba(0,0,0,.12);
  opacity: 0;
}
#mobile-notice-text {
  font-family: 'La Belle Aurore', cursive;
  font-size: 13px;
  color: var(--c-ink);
  line-height: 1.7;
  margin-bottom: 12px;
}
#mobile-notice-dismiss {
  font-family: 'Cedarville Cursive', cursive;
  font-size: 12px;
  color: #FAF7F0;
  background: var(--c-cover-red);
  border: none;
  padding: 7px 18px;
  border-radius: 2px;
  cursor: pointer;
  box-shadow: 1px 1px 0 rgba(0,0,0,.15);
}
```

- [ ] **Step 3: Add `initMobileNotice` and `dismissMobileNotice` to `book.js`**

After the `initSearchStates` function (added in Task 3), add:

```js
// ── MOBILE NOTICE ──

function initMobileNotice() {
  if (!isMobileLayout()) return
  if (localStorage.getItem('fp_mobile_notice_dismissed') === '1') return
  const el = document.getElementById('mobile-notice')
  if (!el) return
  el.style.display = ''
  gsap.to(el, { opacity: 1, duration: reducedMotion ? 0.001 : 0.4, delay: reducedMotion ? 0 : 0.3, ease: 'power1.out' })
}

function dismissMobileNotice() {
  localStorage.setItem('fp_mobile_notice_dismissed', '1')
  const el = document.getElementById('mobile-notice')
  if (!el) return
  gsap.to(el, { opacity: 0, duration: reducedMotion ? 0.001 : 0.25, ease: 'power1.in',
    onComplete: () => { el.style.display = 'none' } })
}
```

- [ ] **Step 4: Call `initMobileNotice()` after cover opens**

Find the `animateCoverOpen` function (search for `function animateCoverOpen`). It contains a `.then(...)` or `onComplete` callback that fires after the cover animation finishes. Find where `goToSection('toc')` or similar is called at the end of the cover animation, or where `BookState.phase = 'browsing'` is set after opening.

Look for the cover click handler that calls `animateCoverOpen()`. Find where `completeOnboarding()` triggers `goToSection('toc')`. The simplest hook is: inside `completeOnboarding()`, after calling `goToSection('toc')`, add `initMobileNotice()`:

```js
function completeOnboarding() {
  localStorage.setItem('onboarding_complete', '1')
  goToSection('toc')
  initMobileNotice()
}
```

Also find where the cover is clicked and `animateCoverOpen()` is called directly (if the user already completed onboarding). Search for `animateCoverOpen()` calls. There should be one in the cover click handler. Find that callback's completion and add `initMobileNotice()` there.

Search for the `#cover-wrapper` click handler. It likely calls `animateCoverOpen()` and then maybe `navigateToSpread`. Add `initMobileNotice()` in the `.then()` callback of `animateCoverOpen()` calls that represent the user opening the book (not internal language-switch reopens).

Concretely, find:

```js
document.getElementById('cover-wrapper')?.addEventListener('click', () => {
```

or similar. Inside the callback, after `animateCoverOpen(...)`, add a `.then(() => initMobileNotice())` or call it in the existing callback.

If the pattern is:
```js
animateCoverOpen().then(() => { ... })
```
change to:
```js
animateCoverOpen().then(() => { ...; initMobileNotice() })
```

If `animateCoverOpen` is called without `.then`, chain it:
```js
animateCoverOpen().then(() => initMobileNotice())
```

- [ ] **Step 5: Verify in browser (DevTools mobile simulation)**

In Chrome DevTools, enable responsive mode and set width to 375px (iPhone SE). Reload the page. Open the book. After the cover animation:
- Mobile notice should appear at the bottom (after 0.3s delay), fading in.
- Click "continuar mesmo assim" → notice fades out.
- Reload → notice does NOT reappear (localStorage `fp_mobile_notice_dismissed = '1'` is set).
- In DevTools Console: `localStorage.removeItem('fp_mobile_notice_dismissed')` → reload → notice reappears.

Also verify: on a 1024px+ window, notice never appears.

- [ ] **Step 6: Commit**

```bash
git add templates/index.html static/js/book.js static/css/book.css
git commit -m "feat: add mobile notice shown after book opens on small screens"
```

---

## Self-Review vs Spec

### Section 1: Search Spread States
| Requirement | Task | Status |
|-------------|------|--------|
| Three sibling state divs | Task 3 Step 1 | ✓ |
| GSAP crossfade ~200ms | Task 3 Step 3 `showSearchState` | ✓ |
| State A: editorial text + AI Studio link | Task 3 Step 1 | ✓ |
| State A: key input + confirm button | Task 3 Step 1 | ✓ |
| State A confirm → validate via `/api/models` X-Gemini-Key | Task 1 Step 4 + Task 3 Step 3 | ✓ |
| State A confirm success → save to `gemini_key` localStorage + fade to C | Task 3 Step 3 `validateAndSaveGeminiKey` | ✓ |
| State A confirm fail → inline key error | Task 3 Step 3 `showSearchKeyError` | ✓ |
| State A: demo link → fade to B | Task 3 Step 3 `showDemoState` | ✓ |
| State B: clickable recipe cards from `demo_recipes.json` | Task 3 Step 3 `showDemoState` | ✓ |
| State B card click → demo search | Task 3 Step 3 `clickDemoRecipe` | ✓ |
| State B: "configurar chave →" → fade to A | Task 3 Step 1 (HTML) | ✓ |
| State B: reload → back to State A (no persistence) | Task 3 Step 6 `initSearchStates` | ✓ |
| State C: normal search form | Task 3 Step 1 (existing content moved) | ✓ |
| State C: "Chave Gemini salva · Trocar →" hint | Task 3 Step 1 + Step 2 | ✓ |
| State C: "Trocar →" → fade to A (key pre-filled) | Task 3 Step 3 `goToKeyState` | ✓ |
| Init logic: check localStorage, show C or A | Task 3 Step 3 + Step 6 | ✓ |

### Section 2: Error Codes
| Requirement | Task | Status |
|-------------|------|--------|
| Backend: `error_code` in responses | Task 1 Step 5 | ✓ |
| `rate_limit` → inline search message | Task 4 | ✓ |
| `auth_error` → inline + "Trocar chave →" | Task 4 Step 3 | ✓ |
| `generic` → navigate to error spread | Task 4 Step 4 | ✓ |
| State A validation fail → inline key error | Task 3 Step 3 | ✓ |

### Section 3: Mobile Notice
| Requirement | Task | Status |
|-------------|------|--------|
| Trigger: `innerWidth < 768px` | Task 5 Step 3 `isMobileLayout()` | ✓ |
| Appears after cover open | Task 5 Step 4 | ✓ |
| Not modal-blocking | Task 5 Step 2 (no backdrop, no pointer-events block) | ✓ |
| Dismissible | Task 5 Step 3 `dismissMobileNotice` | ✓ |
| Persists: `fp_mobile_notice_dismissed` | Task 5 Step 3 | ✓ |
| No reappear after dismiss | Task 5 Step 3 guard | ✓ |
| Style: `var(--c-page-alt)`, editorial font | Task 5 Step 2 | ✓ |
| Fade in/out | Task 5 Step 3 GSAP | ✓ |

### Section 4: Scroll Result Spread
| Requirement | Task | Status |
|-------------|------|--------|
| Remove continuation spread | Task 2 | ✓ |
| Independent page scroll | Task 2 (`.recipe-card-border` already has `overflow-y:auto`) | ✓ |
| Scroll reset on navigate to result | Task 2 Step 8 | ✓ |
| Scrollbar hidden | Task 2 (already in base CSS + `scrollbar-width:none`) | ✓ |
| Visual scroll indicator | Task 2 Step 10 | ✓ |
| Remove `ensureResultPagination` | Task 2 Steps 2, 7 | ✓ |
| Remove `#result-continuation-container` from HTML | Task 2 Step 1 | ✓ |
| Remove continuation CSS | Task 2 Step 9 | ✓ |

### Placeholder Scan
None found — all steps include actual code.

### Type Consistency Check
- `showSearchState(state)` accepts `'no-key' | 'demo' | 'search'` — used consistently in `initSearchStates`, `goToKeyState`, `validateAndSaveGeminiKey`, demo footer button.
- `startRecipeSearch(query, { demo })` — extended signature with default `{}`, backward-compatible with all existing callers (they pass no second arg).
- `fetchRecipe(query, { demo })` — same.
- `BookState.lastSimpleCode` — written in `fetchRecipe`, read in `startRecipeSearch`.
- `validate_gemini_key(key)` in Python — used in `get_models` handler.
