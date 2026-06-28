# Book UI Enhancements — Design Spec
**Date:** 2026-06-27
**Status:** Approved

## Scope

Four independent UI/UX improvements to the Foodpedia book interface. No backend changes. Implementation order: spine shadow → rainbow colors → tab navigation → favorites spread.

---

## Feature 1 — Spine Shadow

**Goal:** When the book is closed (cover showing), a vertical shadow on the left edge simulates a bound spine, giving the book a 3D physical feel.

**Implementation:**
- A CSS `::before` pseudo-element on the book wrapper, positioned at the left edge
- Color: `#2C1810` (dark brown, already in palette) with a gradient fade to transparent
- The book wrapper receives a `.is-open` class when the book opens (added by existing JS)
- `::before` transitions `opacity: 0` when `.is-open` is present, timed to match the open animation
- No JS logic changes — purely cosmetic CSS

**Constraints:** Must not interfere with page-turn animations or existing shadow/z-index stack.

---

## Feature 2 — Rainbow Color Sequence

**Goal:** All 6 side divider tabs follow the physical top-to-bottom rainbow order (red→orange→yellow→green→teal→blue→violet) using the existing earthy/muted palette tones.

**Color mapping:**

| Tab | Old color | New color | Change |
|-----|-----------|-----------|--------|
| Sumário | `#A87068` | `#A87068` | none — terracotta/red already correct |
| Pesquisar | `#A8924E` | `#A8924E` | none — ochre/orange-yellow already correct |
| Receitas | `#65855C` | `#65855C` | none — sage/green already correct |
| Resultado | `#6A8878` | `#6A8878` | none — muted teal already correct |
| Saved | `#9E7A88` | `#7080A0` | mauve → slate blue |
| Favorites | `#8C7052` | `#887AA8` | brown → soft violet |

**Scope:** Divider tabs only. Bottom tabs (share, language, help) are functional actions, not sections — they keep their existing colors.

**Implementation:** Update the two inline `style="background:..."` values in `index.html` for Saved and Favorites divider tabs.

---

## Feature 3 — Tab Navigation from Closed State

**Goal:** Clicking any side tab opens the book and navigates directly to that section, whether the book is currently closed (on the cover) or already open.

**Current behavior:** `goToSection('x')` works when book is open. When closed, clicks are ignored.

**New behavior:**
- A wrapper checks `BookState` to determine if the book is closed
- If closed: triggers the existing open-book animation with a post-animation callback that calls `goToSection(target)`
- If open: calls `goToSection(target)` directly (no change from current behavior)
- Clicking the cover still opens the book normally (existing behavior preserved)

**State detection:** Reuses existing `BookState` flags — no new state introduced.

---

## Feature 4 — Favorites as Second Table of Contents

**Goal:** The favorites tab opens a dedicated "Favoritos" spread listing all favorited pages by name, clicable to navigate — styled like the existing TOC spread.

**Behavior:**
- `goToFavorites()` navigates to a `data-role="favorites-toc"` spread instead of the first favorited item
- The spread is only present in the layout when there are favorites (tab already shows/hides based on count — this is unchanged)
- Clicking any entry in the favorites spread navigates to that spread
- The spread rebuilds whenever a favorite is added or removed (hook into existing `syncRibbonFavorite()` / favorite toggle logic)

**Structure:**
- `buildFavoritesToc()` function, modeled on `buildToc()`, reads `favoriteKeys()` and the existing spread data to generate entries
- Spread inserted into the layout after the main TOC spreads
- Visual style: same page layout and typography as the TOC — title "Favoritos", entries with spread names

**What does NOT change:**
- Tab show/hide logic (count-based, already works)
- The `◆` markers in the main TOC
- `favoriteKeys()` data structure

---

## Architecture Notes

- All changes are in `static/js/book.js`, `static/css/book.css`, and `templates/index.html`
- No new files needed
- No backend changes
- Features are fully independent — each can be shipped and tested separately
