# Grupo B — Deploy + Onboarding Design Spec
**Date:** 2026-06-27
**Status:** Approved

## Scope

Three independent but sequentially dependent workstreams:
1. Flask serverless deploy on Vercel (with Gemini-only constraint)
2. API key UX — user-supplied key via localStorage
3. Onboarding flow — mandatory first-visit tutorial with tab lock

No database changes. No new backend services.

---

## Workstream 1 — Flask Serverless on Vercel

### Architecture

The existing Flask app deploys to Vercel via `@vercel/python`. Each Flask route becomes a serverless function. Entry point is `api/index.py` which imports and wraps the existing `app` object.

**Required files:**
- `vercel.json` — routes all requests to `api/index.py`, sets Python runtime
- `api/index.py` — thin wrapper: `from app import app as application`
- No restructuring of `app/` internals needed

**Ollama disabled on Vercel:**
Vercel injects `VERCEL=1` automatically into the runtime environment. `app/services/ai_router.py` reads this env var and excludes Ollama from the available providers list. Users running localhost keep Ollama available as before.

```python
# ai_router.py — provider selection
import os
IS_VERCEL = os.environ.get('VERCEL') == '1'

def get_available_providers():
    providers = ['gemini']
    if not IS_VERCEL:
        providers.append('ollama')
    return providers
```

### API Key Flow

The Gemini key moves from server-side `GEMINI_API_KEY` env var to user-supplied, stored in `localStorage`, sent in every request body.

**Frontend (book.js):**
- `getGeminiKey()` reads `localStorage.getItem('gemini_key')`
- Every call to `/api/recipe` and `/api/translate` includes `gemini_key` in the JSON body
- On `GEMINI_KEY_MISSING` error (already handled), navigates to setup spread (existing behavior, unchanged)

**Backend (gemini_service.py):**
- `call_gemini(prompt, key)` — key parameter added, no longer reads from `current_app.config`
- `api/recipe` and `api/translate` routes extract `gemini_key` from `request.json` and pass it down
- If key is absent or invalid, returns `{"error": "GEMINI_KEY_MISSING"}` (same error code as today)
- Server-side `GEMINI_API_KEY` env var still works as fallback for local `.env` users

### Vercel Config

```json
// vercel.json
{
  "version": 2,
  "builds": [{"src": "api/index.py", "use": "@vercel/python"}],
  "routes": [
    {"src": "/static/(.*)", "dest": "/static/$1"},
    {"src": "/(.*)", "dest": "/api/index.py"}
  ]
}
```

Static files (`/static/`) are served directly by Vercel's CDN — no Python involved.

---

## Workstream 2 — API Key UX (Setup Spread)

### Input in Setup Spread

The `data-role="setup"` spread replaces the "configure no .env local" instruction with a functional `<input type="password">` for the Gemini key.

**Behavior:**
- Input pre-fills from `localStorage.getItem('gemini_key')` on page load
- On "Salvar" button click: validates non-empty, saves to `localStorage`, shows confirmation ("Chave salva!")
- On "Remover" button click: clears `localStorage`, clears input
- If user lands on setup spread without a key, the input is focused automatically

**The spread does NOT change its visual structure** — same layout, same Gemini section, instruction text updated to explain the online key flow.

### Updated "Sobre" Text

The `data-role="about"` spread gets a single text covering both deployment contexts:

> *"No modo local, a inteligência roda via Ollama — nenhuma consulta sai da sua máquina. Na versão online, as consultas vão para a API do Gemini usando a sua própria chave — o Foodpedia não armazena nem vê sua chave em nenhum momento."*

---

## Workstream 3 — Onboarding Flow

### Book Structure Change

"Como usar" spreads move to before the TOC:

```
Capa → Como Usar (spreads 1..n) → Sumário → [demais spreads]
```

This is a reordering of existing `data-role` spreads in `templates/index.html`. No new spread logic needed — the spread renderer is index-based.

### First-Visit Detection

`localStorage` flag `onboarding_complete` (string `'1'`):
- **Absent:** first visit → onboarding mode active
- **Present:** returning user → normal behavior

### Onboarding Mode Behavior

**On first visit:**
1. Book opens to first "Como Usar" spread (spread index 0, naturally, since it's now first)
2. Side tabs are locked — clicks trigger a shake animation + tooltip: *"Complete o tutorial primeiro"*
3. Bottom tabs (share, language, help) remain accessible
4. Page-turn navigation within "Como Usar" spreads works normally
5. Last "Como Usar" spread shows a "Entendi, vamos lá!" button
6. Button click: sets `onboarding_complete = '1'`, unlocks tabs
7. If `localStorage.getItem('gemini_key')` is empty → navigates to setup spread
8. Otherwise → navigates to TOC

**Tab lock implementation:**
```js
// book.js — wrap existing goToSection()
function goToSection(target) {
  if (!isOnboardingComplete() && isSideTab(target)) {
    shakeTabsAndShowTooltip();
    return;
  }
  // existing goToSection logic
}

function isOnboardingComplete() {
  return localStorage.getItem('onboarding_complete') === '1';
}

// isSideTab: true for the 6 section targets
// ('summary','search','recipes','result','saved','favorites')
// false for cover open, TOC navigation, and bottom action tabs (share/language/help)
```

No new state in `BookState` — the lock is purely a guard at the `goToSection` entry point.

### Returning User Behavior

- With key configured → normal (cover, tabs unlocked)
- Without key → existing `GEMINI_KEY_MISSING` flow navigates to setup spread (unchanged)
- Onboarding never re-triggers

---

## "Como Usar" Spread Content

The tutorial lives entirely inside the book — no external site or README dependency. Spreads cover:

1. **O que é o Foodpedia** — propósito, modo local vs. online
2. **Como obter uma chave Gemini** — link para aistudio.google.com, passo a passo visual
3. **Como configurar a chave** — input no spread de setup, o que acontece com ela
4. **Como pesquisar** — tab Pesquisar, o que digitar
5. **Como ler uma receita** — tab Resultado, seções da receita, dica do chef
6. **Favoritos e Sumário** — como salvar, como navegar

Number of spreads: 5–6 (each is a two-page spread). Final spread has the "Entendi, vamos lá!" CTA.

---

## Constraints & Non-Goals

- `scripts/build_static_demo.py` — broken, out of scope. Can be deleted.
- Ollama support in localhost: **unchanged** — no regressions for local users
- No authentication, no user accounts, no server-side key storage
- The Gemini key lives only in the user's `localStorage` — never sent to any endpoint other than the Vercel Flask backend, which forwards it directly to Google

---

## Files Affected

| File | Change |
|------|--------|
| `vercel.json` | New file |
| `api/index.py` | New file — wraps Flask app |
| `app/services/ai_router.py` | Detect `VERCEL=1`, exclude Ollama |
| `app/services/gemini_service.py` | Accept `key` param instead of reading from config |
| `app/routes/api.py` | Extract `gemini_key` from request body, pass to service |
| `templates/index.html` | Reorder spreads, add "Como Usar" spreads, update "sobre" text, add key input to setup spread |
| `static/js/book.js` | `getGeminiKey()`, request body changes, `goToSection` lock, onboarding complete button |
| `static/css/book.css` | Shake animation for locked tabs, tooltip style |
| `scripts/build_static_demo.py` | Delete |
