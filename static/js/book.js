/* book.js — Foodpedia v5 */

const EXPECTED_LAYOUT = 'dynamic-v1'
if (document.body.dataset.foodpediaLayout !== EXPECTED_LAYOUT) {
  throw new Error(
    'Foodpedia carregou HTML e JavaScript de versões diferentes. Reinicie o servidor Flask e recarregue a página.'
  )
}

// Spread indexes and page numbers are assigned by rebuildBookLayout().
let SPREAD_ENDPAPER = 1
let SPREAD_TOC = 2
let SPREAD_ABOUT = 3
let SPREAD_SEARCH = 4
let SPREAD_RESULT = 5
let SPREAD_ERROR = 6
let SPREAD_SETUP = 7
let SPREAD_RECIPES_START = 8
let SPREAD_RECIPES_END = 23
let SPREAD_SAVED_START = 24
let SPREAD_FAVORITES_TOC = 0
const SECTION_SPREADS = {}

const BookState = {
  currentSpread: 0,
  phase: 'cover',        // 'cover' | 'browsing' | 'loading' | 'result' | 'backcover'
  pendingRecipe: null,
  loadingQuery: null,
  isAnimating: false,
  selectedModel: null,
  selectedProvider: null,
  lastErrorCode: null,
  currentRecipe: null,
  currentRecipeVariants: {},
  layout: [],
  totalPages: 0,
  translating: false,
  resultAvailable: false,
  errorActive: false,
  setupActive: false,
  languageTransition: false,
  shortcutPage: 0,
}

// ── REDUCED MOTION ──
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isMobileLayout = () => window.matchMedia('(max-width: 768px)').matches
const DUR = {
  coverOpen: reducedMotion ? 0.001 : 1.1,
  pageTurn:  reducedMotion ? 0.001 : 0.42,
  content:   reducedMotion ? 0.001 : 0.38,
}

// ── BUILD CHECKERBOARD ──
;(function buildCheckerboard() {
  const cols = 12, rows = 16
  ;['checkerboard', 'backcover-checkerboard'].forEach(id => {
    const board = document.getElementById(id)
    if (!board) return
    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
    board.style.gridTemplateRows    = `repeat(${rows}, 1fr)`
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div')
        cell.className = 'cover-cell ' + ((r + c) % 2 === 0 ? 'red' : 'white')
        board.appendChild(cell)
      }
    }
  })
})()

// Initial positioning: book closed (cover centered)
gsap.set('.book-wrapper', { x: '-25%' })
gsap.set('#book-spreads', { display: 'none', opacity: 0 })
gsap.set('#divider-tabs', { opacity: 1, pointerEvents: 'auto' })
gsap.set('#bottom-tabs', { opacity: 1, pointerEvents: 'auto' })
gsap.set('#ribbon-pages', { opacity: 0, pointerEvents: 'none', y: -92 })

function savedRecipes() {
  try {
    return JSON.parse(localStorage.getItem('fp_saved_recipes') || '[]')
  } catch {
    return []
  }
}

function spreadKey(spread) {
  if (!spread) return ''
  if (spread.dataset.role === 'base-recipe') return `recipe:${spread.dataset.recipeName}`
  if (spread.dataset.role === 'saved') return `saved:${spread.dataset.savedId}`
  if (spread.dataset.role === 'toc') return `toc:${spread.dataset.tocPart}`
  if (spread.dataset.role === 'result' || spread.dataset.role === 'result-continuation') {
    return 'result:current'
  }
  return spread.dataset.role || ''
}

function tocEntries() {
  const favorites = favoriteKeys()
  const entries = [
    { type: 'link', labelKey: 'toc_about', fallback: 'Sobre o Foodpedia', targetRole: 'about', targetKey: 'about', favorite: favorites.includes('about'), weight: 1 },
    { type: 'link', labelKey: 'toc_search', fallback: 'Pesquisar um Prato', targetRole: 'search', targetKey: 'search', favorite: favorites.includes('search'), weight: 1 },
    { type: 'section', labelKey: 'toc_classics', fallback: 'Receitas Clássicas', targetRole: 'base-recipe', weight: 1.2 },
  ]

  document.querySelectorAll('[data-role="base-recipe"]').forEach(spread => {
    entries.push({
      type: 'link',
      subtype: 'recipe',
      label: spread.dataset.recipeName,
      targetKey: `recipe:${spread.dataset.recipeName}`,
      favorite: favorites.includes(`recipe:${spread.dataset.recipeName}`),
      weight: 1,
    })
  })

  const saved = savedRecipes()
  if (saved.length) {
    entries.push({ type: 'section', labelKey: 'toc_saved', fallback: 'Pesquisas Salvas', targetRole: 'saved', weight: 1.2 })
    entries.push({ type: 'filter', weight: 1.4 })
    saved.forEach(entry => {
      entries.push({
        type: 'link',
        subtype: 'saved',
        label: entry.recipe?.name || '',
        targetKey: `saved:${entry.id}`,
        recipeId: entry.id,
        favorite: favorites.includes(`saved:${entry.id}`),
        weight: 1,
      })
    })
  }
  return entries
}

function heirloomPage(side = 'right', variant = 'primary') {
  const isLeft = side === 'left'
  const secondary = variant === 'secondary'
  const noteA = currentLang === 'en'
    ? (secondary ? 'buy twine<br>and cinnamon' : 'call auntie<br>about the corn cake')
    : (secondary ? 'comprar barbante<br>e canela' : 'ligar para a tia<br>sobre o bolo de milho')
  const noteC = currentLang === 'en'
    ? (secondary ? 'Sunday, 4 people' : 'don’t forget<br>the bay leaf')
    : (secondary ? 'domingo, 4 pessoas' : 'não esquecer<br>o louro')
  const noteD = currentLang === 'en'
    ? (secondary ? 'the blue bowl<br>is in the pantry' : 'half sugar next time')
    : (secondary ? 'a tigela azul<br>está na despensa' : 'metade do açúcar<br>na próxima')
  const noteE = currentLang === 'en'
    ? (secondary ? 'ask about the<br>Sunday sauce' : 'three cloves?<br>maybe four')
    : (secondary ? 'perguntar sobre<br>o molho de domingo' : 'três cravos?<br>talvez quatro')
  return `
    <div class="page page-${side} toc-heirloom toc-heirloom-${variant}" aria-label="Página de anotações antigas">
      ${isLeft
        ? '<div class="curl-zone curl-left" role="button" aria-label="Página anterior"><div class="curl-surface"></div><div class="curl-hint">‹</div></div>'
        : '<div class="curl-zone curl-right" role="button" aria-label="Próxima página"><div class="curl-surface"></div><div class="curl-hint">›</div></div>'}
      <svg class="heirloom-botanical heirloom-botanical-a" viewBox="0 0 120 160" aria-hidden="true">
        ${secondary
          ? '<path d="M30 145 C46 116 51 83 67 35 M45 112 C28 101 20 85 27 70 M57 83 C78 78 93 62 91 43 M65 51 C52 38 50 24 59 14" /><path d="M27 70 C15 65 10 54 15 44 M91 43 C102 35 106 24 101 14" />'
          : '<path d="M58 148 C55 112 62 78 55 24 M57 112 C38 103 30 86 36 72 M59 91 C79 81 87 62 78 48 M56 63 C39 56 34 40 42 29" /><path d="M35 72 C25 68 19 59 22 50 M79 48 C92 43 98 33 94 22" />'}
      </svg>
      <div class="heirloom-ring" aria-hidden="true"></div>
      <div class="heirloom-ring heirloom-ring-small" aria-hidden="true"></div>
      <span class="heirloom-note note-a">${noteA}</span>
      <span class="heirloom-note note-b">${secondary ? '180° · 35 min' : '2 × ¾ = 1½'}</span>
      <span class="heirloom-note note-c">${noteC}</span>
      <span class="heirloom-note note-d">${noteD}</span>
      <span class="heirloom-note note-e">${noteE}</span>
      <span class="heirloom-crossout">${currentLang === 'en' ? 'buy cream' : 'comprar creme'}</span>
      <svg class="heirloom-doodle" viewBox="0 0 100 80" aria-hidden="true">
        ${secondary
          ? '<path d="M7 18 C25 48 41 7 59 42 C70 63 82 44 94 69 M18 11 C34 24 51 4 76 20" /><path d="M12 61 L31 51 L45 69 L62 48" />'
          : '<path d="M8 58 C24 22 43 70 58 34 C67 15 79 25 91 11 M18 66 C38 51 54 77 79 57" /><circle cx="14" cy="19" r="7" /><path d="M9 19 Q14 25 20 18" />'}
      </svg>
      <div class="page-footer"><span class="footer-brand">Foodpedia</span><span class="page-number"></span></div>
    </div>`
}

function tocPage(entries, pageIndex, side) {
  const isLeft = side === 'left'
  const heading = pageIndex === 0
    ? `<h2 class="toc-heading" data-i18n="toc_heading">Sumário</h2>`
    : `<span class="toc-continuation">${currentLang === 'en' ? 'continued' : 'continuação'}</span>`
  const rows = entries.map((entry, entryIndex) => {
    if (entry.type === 'section') {
      return `<li class="toc-section-row" data-toc-entry-index="${entryIndex}" data-stagger>
        <span class="toc-entry toc-section" data-target-role="${entry.targetRole || ''}">
          <span class="toc-entry-title" ${entry.labelKey ? `data-i18n="${entry.labelKey}"` : ''}>${entry.fallback || entry.label || ''}</span>
          <span class="toc-dots"></span><span class="toc-page" data-toc-page></span>
        </span>
      </li>`
    }
    if (entry.type === 'filter') {
      return `<li class="toc-filter-row" data-toc-entry-index="${entryIndex}">
        <label class="toc-filter-label" for="saved-search-input">${currentLang === 'en' ? 'filter saved recipes' : 'filtrar receitas salvas'}</label>
        <input type="search" id="saved-search-input" placeholder="${currentLang === 'en' ? 'filter...' : 'filtrar...'}" oninput="filterSavedRecipes(this.value)">
      </li>`
    }
    const target = entry.targetKey
      ? `data-target-key="${entry.targetKey}"`
      : `data-target-role="${entry.targetRole}"`
    return `<li data-toc-entry-index="${entryIndex}" data-stagger class="${entry.subtype === 'saved' ? 'toc-saved-item' : ''}" ${entry.recipeId ? `data-recipe-id="${entry.recipeId}"` : ''}>
      <a class="toc-entry ${entry.subtype ? 'toc-sub' : ''} ${entry.favorite ? 'is-favorite' : ''}" href="#" ${target}>
        <span class="toc-favorite-mark" aria-hidden="true">${entry.favorite ? '◆' : ''}</span>
        <span class="toc-entry-title" ${entry.labelKey ? `data-i18n="${entry.labelKey}"` : ''}>${entry.label || entry.fallback || ''}</span>
        <span class="toc-dots"></span><span class="toc-page" data-toc-page></span>
      </a>
    </li>`
  }).join('')
  return `
    <div class="page page-${side} toc-sheet">
      ${isLeft
        ? '<div class="curl-zone curl-left" role="button" aria-label="Página anterior"><div class="curl-surface"></div><div class="curl-hint">‹</div></div>'
        : '<div class="curl-zone curl-right" role="button" aria-label="Próxima página"><div class="curl-surface"></div><div class="curl-hint">›</div></div>'}
      ${heading}
      <ul class="toc-entries">${rows}</ul>
      <div class="page-footer"><span class="footer-brand">Foodpedia</span><span class="page-number"></span></div>
    </div>`
}

function measureTOCChunk(entries, pageIndex, side) {
  const host = document.getElementById('toc-spreads-container')
  const bookSpreads = document.getElementById('book-spreads')
  if (!host || !bookSpreads || !entries.length) return { fit: entries, overflow: [] }

  const previousDisplay = bookSpreads.style.display
  const previousVisibility = bookSpreads.style.visibility
  bookSpreads.style.display = 'block'
  bookSpreads.style.visibility = 'hidden'

  const probe = document.createElement('div')
  probe.className = 'book-spread toc-measure-spread'
  probe.style.display = 'grid'
  probe.innerHTML = side === 'right'
    ? `${heirloomPage('left', 'primary')}${tocPage(entries, pageIndex, 'right')}`
    : `${tocPage(entries, pageIndex, 'left')}${heirloomPage('right', 'secondary')}`
  host.appendChild(probe)

  const sheet = probe.querySelector('.toc-sheet')
  const footer = sheet?.querySelector('.page-footer')
  const rows = [...(sheet?.querySelectorAll('[data-toc-entry-index]') || [])]
  const limit = (footer?.getBoundingClientRect().top || 0) - 14
  let overflowIndex = rows.findIndex(row => row.getBoundingClientRect().bottom > limit)
  if (overflowIndex === 0) overflowIndex = 1
  if (overflowIndex < 0) overflowIndex = entries.length

  probe.remove()
  bookSpreads.style.display = previousDisplay
  bookSpreads.style.visibility = previousVisibility

  return {
    fit: entries.slice(0, overflowIndex),
    overflow: entries.slice(overflowIndex),
  }
}

function renderTOCSpreads() {
  const host = document.getElementById('toc-spreads-container')
  if (!host) return []
  host.innerHTML = ''
  let remaining = tocEntries()
  const spreads = []

  const firstChunk = measureTOCChunk(remaining, 0, 'right')
  remaining = firstChunk.overflow
  const firstSpread = document.createElement('div')
  firstSpread.className = 'book-spread'
  firstSpread.dataset.role = 'toc'
  firstSpread.dataset.tocPart = '0'
  firstSpread.innerHTML = `
    <div class="page-turn-layer"><div class="turn-front"></div><div class="turn-back"></div></div>
    ${heirloomPage('left', 'primary')}
    ${tocPage(firstChunk.fit, 0, 'right')}`
  host.appendChild(firstSpread)
  spreads.push(firstSpread)

  let part = 1
  let pageIndex = 1
  while (remaining.length) {
    const chunk = measureTOCChunk(remaining, pageIndex, 'left')
    remaining = chunk.overflow
    const spread = document.createElement('div')
    spread.className = 'book-spread'
    spread.dataset.role = 'toc'
    spread.dataset.tocPart = String(part++)
    spread.innerHTML = `
      <div class="page-turn-layer"><div class="turn-front"></div><div class="turn-back"></div></div>
      ${tocPage(chunk.fit, pageIndex, 'left')}
      ${heirloomPage('right', 'secondary')}`
    host.appendChild(spread)
    spreads.push(spread)
    pageIndex += 1
  }
  return spreads
}

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
    ${heirloomPage('left', 'secondary')}
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

function rebuildBookLayout(options = {}) {
  const previous = document.querySelector(`[data-spread="${BookState.currentSpread}"]`)
  const previousKey = spreadKey(previous)
  const tocSpreads = renderTOCSpreads()
  const favTocSpread = buildFavoritesTocSpread()
  const endpaper = document.querySelector('[data-role="endpaper"]')
  const about = document.querySelector('[data-role="about"]')
  const search = document.querySelector('[data-role="search"]')
  const result = document.querySelector('[data-role="result"]')
  const resultContinuations = [...document.querySelectorAll('[data-role="result-continuation"]')]
  const error = document.querySelector('[data-role="error"]')
  const setup = document.querySelector('[data-role="setup"]')
  const recipes = [...document.querySelectorAll('[data-role="base-recipe"]')]
  const saved = [...document.querySelectorAll('[data-role="saved"]')]
  const conditional = []
  if (BookState.errorActive && error) conditional.push(error)
  if (BookState.setupActive && setup) conditional.push(setup)
  if (BookState.resultAvailable && result) conditional.push(result, ...resultContinuations)

  const layout = [
    endpaper,
    ...tocSpreads,
    favTocSpread,
    about,
    search,
    ...recipes,
    ...conditional,
    ...saved,
  ].filter(Boolean)

  layout.forEach((spread, index) => {
    const spreadIndex = index + 1
    const leftPage = (index * 2) + 1
    spread.dataset.spread = String(spreadIndex)
    spread.dataset.pageLeft = String(leftPage)
    spread.dataset.pageRight = String(leftPage + 1)
    const footers = spread.querySelectorAll('.page-number')
    if (footers[0]) footers[0].textContent = String(leftPage)
    if (footers[1]) footers[1].textContent = String(leftPage + 1)
  })

  BookState.layout = layout
  BookState.totalPages = layout.length * 2
  const layoutIndex = element => {
    const index = layout.indexOf(element)
    return index >= 0 ? index + 1 : 0
  }
  SPREAD_ENDPAPER = Number(endpaper?.dataset.spread || 1)
  SPREAD_TOC = Number(tocSpreads[0]?.dataset.spread || 2)
  SPREAD_ABOUT = Number(about?.dataset.spread || SPREAD_TOC)
  SPREAD_SEARCH = Number(search?.dataset.spread || SPREAD_ABOUT)
  SPREAD_RECIPES_START = Number(recipes[0]?.dataset.spread || SPREAD_SEARCH)
  SPREAD_RECIPES_END = Number(recipes.at(-1)?.dataset.spread || SPREAD_RECIPES_START)
  SPREAD_ERROR = layoutIndex(error)
  SPREAD_SETUP = layoutIndex(setup)
  SPREAD_RESULT = layoutIndex(result)
  SPREAD_SAVED_START = Number(saved[0]?.dataset.spread || (SPREAD_SETUP + 1))
  SPREAD_FAVORITES_TOC = favTocSpread ? layoutIndex(favTocSpread) : 0
  Object.assign(SECTION_SPREADS, {
    toc: SPREAD_TOC,
    about: SPREAD_ABOUT,
    search: SPREAD_SEARCH,
    recipes: SPREAD_RECIPES_START,
    result: SPREAD_RESULT,
    saved: saved.length ? SPREAD_SAVED_START : SPREAD_RECIPES_END,
    favorites: SPREAD_FAVORITES_TOC || SPREAD_TOC,
  })
  syncConditionalNavigation()

  updateTOCPageReferences()
  applyStaticText()
  updatePagePosition()
  initCurlZones()
  initDragReorder()
  initAnnotationDragging()

  if (!options.keepCurrent || BookState.phase === 'cover') return
  const replacement = layout.find(spread => spreadKey(spread) === previousKey)
  if (replacement) {
    BookState.currentSpread = Number(replacement.dataset.spread)
    showSpread(BookState.currentSpread)
  }
}

function findSpreadByTarget(targetRole, targetKey) {
  if (targetKey) return BookState.layout.find(spread => spreadKey(spread) === targetKey)
  if (targetRole === 'base-recipe') return BookState.layout.find(spread => spread.dataset.role === 'base-recipe')
  if (targetRole === 'saved') return BookState.layout.find(spread => spread.dataset.role === 'saved')
  return BookState.layout.find(spread => spread.dataset.role === targetRole)
}

function updateTOCPageReferences() {
  document.querySelectorAll('.toc-entry[data-target-role], .toc-entry[data-target-key], .toc-section').forEach(entry => {
    const target = findSpreadByTarget(entry.dataset.targetRole, entry.dataset.targetKey)
    const page = entry.querySelector('[data-toc-page]')
    if (page) page.textContent = target?.dataset.pageLeft || ''
  })
}

function updatePagePosition(side = 'left') {
  const spread = document.querySelector(`[data-spread="${BookState.currentSpread}"]`)
  const current = spread
    ? Number(side === 'right' ? spread.dataset.pageRight : spread.dataset.pageLeft)
    : 1
  const currentEl = document.querySelector('[data-current-page]')
  const totalEl = document.querySelector('[data-total-pages]')
  if (currentEl) currentEl.textContent = String(current)
  if (totalEl) totalEl.textContent = String(BookState.totalPages || 1)
}

function syncConditionalNavigation() {
  const resultTab = document.querySelector('[data-section="result"]')
  if (resultTab) resultTab.style.display = BookState.resultAvailable ? 'flex' : 'none'
  syncFavoritesTab()
  syncShareTab()
}

function syncShareTab() {
  const shareTab = document.getElementById('tab-share')
  if (!shareTab) return
  const spread = document.querySelector(`[data-spread="${BookState.currentSpread}"]`)
  const role = spread?.dataset.role
  const visible = ['base-recipe', 'result', 'result-continuation', 'saved'].includes(role)
  shareTab.style.display = visible ? 'flex' : 'none'
}

// ── SHOW SPREAD (instant swap) ──
function showSpread(index) {
  document.querySelectorAll('.book-spread').forEach(el => {
    el.style.display = 'none'
    el.classList.remove('active')
  })
  const target = document.querySelector(`[data-spread="${index}"]`)
  if (target) {
    target.style.display = 'grid'
    target.classList.add('active')
    target.classList.remove('mobile-right')
  }
  BookState.currentSpread = index
  BookState.mobileSide = 'left'
  updatePagePosition()
  syncRibbonFavorite()
  translateVisibleStaticRecipe()
}

// ── ANIMATE PAGE TURN ──
function animatePageTurn(from, to, direction) {
  direction = direction || (to > from ? 'forward' : 'backward')
  return new Promise(resolve => {
    if (BookState.isAnimating) { showSpread(to); resolve(); return }
    if (from === to) { resolve(); return }

    const fromEl = document.querySelector(`[data-spread="${from}"]`)
    const toEl   = document.querySelector(`[data-spread="${to}"]`)
    if (!fromEl || !toEl) { showSpread(to); resolve(); return }

    BookState.isAnimating = true
    const layer   = fromEl.querySelector('.page-turn-layer')
    const forward = direction === 'forward'

    flashPageTurn(direction)

    const done = () => {
      fromEl.style.display = 'none'
      fromEl.classList.remove('active')
      toEl.classList.add('active')
      toEl.classList.remove('mobile-right')
      BookState.currentSpread = to
      BookState.mobileSide = 'left'
      BookState.isAnimating = false
      updateDividerTabs(to)
      updatePagePosition()
      syncRibbonFavorite()
      translateVisibleStaticRecipe()
      if (layer) gsap.set(layer, { opacity: 0, clearProps: 'zIndex' })
      resolve()
    }

    if (layer) {
      // 3D flip — layer visible; pages of fromEl lose their content instantly via
      // .is-leaving (CSS hides children with !important, keeping background + gutter)
      gsap.set(layer, { opacity: 1, zIndex: 5 })
      gsap.set(toEl,   { display: 'grid', opacity: 1, zIndex: 3 })
      gsap.set(fromEl, { zIndex: 4 })

      const fromLeft  = fromEl.querySelector('.page-left')
      const fromRight = fromEl.querySelector('.page-right')
      if (fromLeft)  fromLeft.classList.add('is-leaving')
      if (fromRight) fromRight.classList.add('is-leaving')

      const tl = gsap.timeline({ onComplete: () => {
        if (fromLeft)  fromLeft.classList.remove('is-leaving')
        if (fromRight) fromRight.classList.remove('is-leaving')
        gsap.set(layer, { rotationY: 0, opacity: 0, clearProps: 'zIndex' })
        done()
      }})

      if (forward) {
        tl.to(layer, { rotationY: -90,  duration: DUR.pageTurn, ease: 'power2.in',
          transformPerspective: 2000, transformOrigin: 'left center' })
        tl.to(layer, { rotationY: -180, duration: DUR.pageTurn, ease: 'power2.out',
          transformOrigin: 'left center' })
      } else {
        gsap.set(layer, { rotationY: -180 })
        tl.to(layer, { rotationY: -90,  duration: DUR.pageTurn, ease: 'power2.in',
          transformPerspective: 2000, transformOrigin: 'left center' })
        tl.to(layer, { rotationY: 0,    duration: DUR.pageTurn, ease: 'power2.out',
          transformOrigin: 'left center' })
      }
    } else {
      // Curtain fallback (spreads without .page-turn-layer)
      const curtain = document.getElementById('page-curtain')
      const originIn  = forward ? 'right center' : 'left center'
      const originOut = forward ? 'left center'  : 'right center'
      curtain.classList.toggle('forward',  forward)
      curtain.classList.toggle('backward', !forward)
      gsap.set(curtain, { scaleX: 0, transformOrigin: originIn })

      const tl = gsap.timeline({ onComplete: () => {
        gsap.set(curtain, { scaleX: 0 })
        done()
      }})
      tl.to(curtain, { scaleX: 1, transformOrigin: originIn, duration: DUR.pageTurn, ease: 'power2.in' })
      tl.add(() => { gsap.set(fromEl, { display: 'none' }); gsap.set(toEl, { display: 'grid' }); toEl.classList.add('active') })
      tl.to(curtain, { scaleX: 0, transformOrigin: originOut, duration: DUR.pageTurn, ease: 'power2.out' })
    }
  })
}

function flashPageTurn(direction) {
  const flash = document.createElement('div')
  flash.style.cssText = `position:fixed;inset:0;z-index:100;pointer-events:none;
    background:linear-gradient(${direction==='forward'?'to left':'to right'},
    rgba(247,242,227,0.18),transparent 40%);`
  document.body.appendChild(flash)
  gsap.to(flash, { opacity: 0, duration: 0.4, ease: 'power2.out',
    onComplete: () => flash.remove() })
}

// ── ANIMATE CONTENT IN ──
function animateContentIn(spreadIndex) {
  const idx    = spreadIndex !== undefined ? spreadIndex : BookState.currentSpread
  const spread = document.querySelector(`[data-spread="${idx}"]`)
  if (!spread) return
  const items = spread.querySelectorAll('[data-stagger]')
  gsap.fromTo(items,
    { opacity: 0, y: 8 },
    { opacity: 1, y: 0, duration: DUR.content, ease: 'expo.out',
      stagger: reducedMotion ? 0 : 0.025 }
  )
}

// ── COVER OPEN ──
function animateCoverOpen(targetKey = null, targetSide = 'left') {
  if (BookState.phase !== 'cover') return Promise.resolve()
  BookState.phase = 'browsing'

  const wrapper = document.getElementById('cover-wrapper')
  const spreads = document.getElementById('book-spreads')
  // Reset any hover tilt before starting the cover flip
  gsap.to('.book-wrapper', { rotationX: 0, rotationY: 0, duration: 0.18, ease: 'power2.out' })
  document.querySelector('.book-wrapper')?.classList.add('is-open')
  gsap.set('.book-gutter', { opacity: 0 })

  // Hide the entire cover-front instantly — page-reveal shows cream behind it on both sides
  gsap.set('#cover-front', { opacity: 0 })
  // Two-page cream spread: left has quote/rule/year, right is blank
  gsap.set('#page-reveal', { display: 'block' })

  gsap.set(spreads, { display: 'block', opacity: 0 })
  const targetSpread = targetKey
    ? BookState.layout.find(spread => spreadKey(spread) === targetKey)
    : null
  const targetIndex = Number(targetSpread?.dataset.spread || SPREAD_ENDPAPER)
  showSpread(targetIndex)

  return new Promise(resolve => {
    const tl = gsap.timeline({
    onComplete: () => {
      // Snap wrapper to display:none — avoids the opacity composite layer that
      // breaks backface-visibility and flashes the cover texture at the end
      gsap.set(wrapper, { display: 'none', opacity: 1 })
      gsap.set('#book-backcover', { display: 'none' })
      gsap.set('#page-reveal', { display: 'none' })
      if (targetSide === 'right' && isMobileLayout()) {
        targetSpread?.classList.add('mobile-right')
        BookState.mobileSide = 'right'
        updatePagePosition('right')
      }
      animateContentIn(targetIndex)
      updateDividerTabs(targetIndex)
      showNavElements()
      gsap.to('.book-gutter', { opacity: 1, duration: 0.25, ease: 'power2.out' })
      resolve()
    }
    })

    tl.to(wrapper, {
      rotationY: -175, duration: DUR.coverOpen, ease: 'power4.out',
      transformOrigin: 'left center', transformPerspective: 2500,
    })
    tl.to('.book-wrapper', { x: '0%', duration: DUR.coverOpen, ease: 'power4.out' }, 0)
    // Spreads fade in after cover-back (cream inside) is already revealed (~65% through)
    // so the user first sees a blank page, then the endpaper content appears on it
    tl.to(spreads, { opacity: 1, duration: 0.38, ease: 'power2.out' }, DUR.coverOpen * 0.65)
    tl.to('.opening-shadow', {
      scaleX: 0, transformOrigin: 'right center',
      duration: 0.9, ease: 'power2.inOut'
    }, 0.2)
  })
}

function showNavElements() {
  syncRibbonFavorite()
  gsap.to('#ribbon-pages', {
    opacity: 1, y: 0, duration: 0.35, ease: 'power4.out',
    onStart: () => { document.getElementById('ribbon-pages').style.pointerEvents = 'auto' },
  })
  gsap.to('#page-position', { opacity: 1, duration: 0.25, ease: 'power2.out' })
}

// ── GO TO COVER ──
function goToCover() {
  if (BookState.phase === 'cover' || BookState.isAnimating) return Promise.resolve()
  BookState.phase = 'cover'

  const wrapper = document.getElementById('cover-wrapper')
  const spreads = document.getElementById('book-spreads')

  gsap.set(wrapper, {
    display: 'block', rotationY: -175, zIndex: 10, opacity: 1,
    transformOrigin: 'left center', transformPerspective: 2500,
  })

  gsap.to('#ribbon-pages', {
    opacity: 0, y: -92, duration: 0.18, ease: 'power2.in',
    onComplete: () => { document.getElementById('ribbon-pages').style.pointerEvents = 'none' },
  })
  gsap.to('#page-position', { opacity: 0, duration: 0.15 })
  gsap.to('.book-gutter', { opacity: 0, duration: 0.15, ease: 'power2.in' })

  return new Promise(resolve => {
    const tl = gsap.timeline({
    onComplete: () => {
      gsap.set(spreads, { display: 'none', opacity: 1 })
      gsap.set(wrapper, { display: 'block', clearProps: 'rotationY' })
      gsap.set('#cover-front', { opacity: 1 })
      gsap.set('#cover-front .cover-content', { opacity: 1 })
      gsap.set('.opening-shadow', { scaleX: 1 })
      document.querySelector('.book-wrapper')?.classList.remove('is-open')
      BookState.currentSpread = 0
      resolve()
    }
    })

    tl.to(spreads, { opacity: 0, duration: 0.25, ease: 'power2.in' })
    tl.to(wrapper, {
      rotationY: 0, duration: DUR.coverOpen * 0.85, ease: 'power4.out',
      transformOrigin: 'left center', transformPerspective: 2500,
    }, 0.1)
    tl.to('.book-wrapper', { x: '-25%', rotationX: 0, rotationY: 0, duration: DUR.coverOpen * 0.85, ease: 'power4.out' }, 0.1)
  })
}

// ── GO TO BACK COVER ──
function goToBackCover() {
  if (BookState.isAnimating) return
  BookState.isAnimating = true
  BookState.phase = 'backcover'

  const spreads   = document.getElementById('book-spreads')
  const backcover = document.getElementById('book-backcover')
  const wrapper   = document.getElementById('cover-wrapper')

  gsap.set(backcover, {
    display: 'block',
    opacity: 0,
    rotationY: -12,
    transformOrigin: 'right center',
    transformPerspective: 2500,
  })

  const tl = gsap.timeline({
    onComplete: () => {
      gsap.set(spreads, { display: 'none', opacity: 1 })
      // Hide the front cover wrapper — its rotated endpaper face would show as a phantom page
      gsap.set(wrapper, { opacity: 0 })
      // Move tabs to the LEFT edge of backcover (fore-edge) and flip their direction
      const bwWidth = document.querySelector('.book-wrapper')?.offsetWidth || 0
      const tabW = 34 // --tab-w
      gsap.set('#divider-tabs, #bottom-tabs, #history-marks', {
        x: -(bwWidth + tabW),
        scaleX: -1,
      })
      BookState.isAnimating = false
    }
  })

  tl.to(spreads, { opacity: 0, duration: 0.3, ease: 'power2.in' })
  tl.to('.book-wrapper', { x: '25%', duration: DUR.coverOpen, ease: 'power4.out' }, 0)
  tl.to(backcover, { opacity: 1, rotationY: 0, duration: 0.7, ease: 'power4.out' }, 0.25)
}

function goBackCoverToFront() {
  if (BookState.phase !== 'backcover' || BookState.isAnimating) return
  BookState.isAnimating = true
  BookState.phase = 'cover'

  const backcover = document.getElementById('book-backcover')
  const wrapper   = document.getElementById('cover-wrapper')

  // Restore tabs immediately
  gsap.set('#divider-tabs, #bottom-tabs, #history-marks', { x: 0, scaleX: 1 })

  // Backcover fades in place — no movement
  gsap.to(backcover, {
    opacity: 0, duration: 0.38, ease: 'power2.in',
    onComplete: () => {
      gsap.set(backcover, { display: 'none', opacity: 0, rotationY: 0 })
      // Snap book back to cover position (backcover already invisible — jump is imperceptible)
      gsap.set('.book-wrapper', { x: '-25%' })
      document.querySelector('.book-wrapper')?.classList.remove('is-open')
      gsap.set(wrapper, {
        display: 'block', opacity: 1, rotationY: 0,
        transformOrigin: 'left center', transformPerspective: 2500,
      })
      gsap.set('#cover-front', { opacity: 1 })
      gsap.set('#cover-front .cover-content', { opacity: 1 })
      gsap.set('.opening-shadow', { scaleX: 1 })
      BookState.currentSpread = 0
      BookState.isAnimating = false
    }
  })
}

// ── NAVIGATION ──
function maxSpread() {
  return Number(BookState.layout.at(-1)?.dataset.spread || SPREAD_RECIPES_END)
}

function goToNextSpread() {
  if (BookState.phase === 'cover' || BookState.phase === 'backcover' || BookState.isAnimating) return
  const current = BookState.currentSpread
  const max = BookState.phase === 'loading' ? SPREAD_RECIPES_END : maxSpread()

  if (BookState.phase === 'loading' && BookState.pendingRecipe && current >= SPREAD_RECIPES_END) {
    showRecipeResult(BookState.pendingRecipe)
    return
  }

  if (current < max) {
    animatePageTurn(current, current + 1, 'forward')
      .then(() => { animateContentIn(current + 1) })
  } else if (BookState.phase !== 'loading') {
    goToBackCover()
  }
}

function goToPrevSpread() {
  if (BookState.phase === 'cover' || BookState.phase === 'backcover' || BookState.isAnimating) return
  const current = BookState.currentSpread
  if (current > SPREAD_ENDPAPER) {
    animatePageTurn(current, current - 1, 'backward')
      .then(() => { animateContentIn(current - 1) })
  }
}

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

// ── DIVIDER TABS ──
function updateDividerTabs(spreadIndex) {
  document.querySelectorAll('.dt-tag').forEach(t => t.classList.remove('active'))
  let section = null
  const spread = document.querySelector(`[data-spread="${spreadIndex}"]`)
  const role = spread?.dataset.role
  if      (role === 'toc')         section = 'toc'
  else if (role === 'about')       section = null
  else if (role === 'search')      section = 'search'
  else if (role === 'base-recipe') section = 'recipes'
  else if (role === 'result' || role === 'result-continuation' || role === 'error' || role === 'setup') section = 'result'
  else if (role === 'saved')         section = 'saved'
  else if (role === 'favorites-toc') section = 'favorites'
  if (section)
    document.querySelector(`[data-section="${section}"] .dt-tag`)?.classList.add('active')
  if (favoriteKeys().includes(spreadKey(spread))) {
    document.querySelector('[data-section="favorites"] .dt-tag')?.classList.add('active')
  }
  syncShareTab()
}

// ── CURL ZONES ──
function initCurlZones() {
  document.querySelectorAll('.curl-zone').forEach(zone => {
    if (zone.dataset.bound === 'true') return
    zone.dataset.bound = 'true'
    const isLeft = zone.classList.contains('curl-left')
    zone.addEventListener('click', e => {
      e.stopPropagation()
      if (BookState.isAnimating) return
      const surface = zone.querySelector('.curl-surface')
      if (surface) {
        gsap.timeline()
          .to(surface, { scale: 0.76, duration: 0.08, ease: 'power3.in' })
          .to(surface, { scale: 1, duration: 0.15, ease: 'power4.out' })
      }
      isLeft ? goToPrevSpread() : goToNextSpread()
    })
  })
}

// ── EDGE ARROWS ──
const EDGE_ZONE   = 160
const arrowL = document.querySelector('.nav-arrow-left')
const arrowR = document.querySelector('.nav-arrow-right')
const INTERACTIVE = 'input,textarea,a,button,.curl-zone,.dt-tag,.fav-btn,.save-recipe-btn,.share-recipe-btn,.bottom-tab'

document.getElementById('book-spreads')?.addEventListener('mousemove', e => {
  if (e.target.closest(INTERACTIVE) || BookState.isAnimating) {
    hideArrow(arrowL); hideArrow(arrowR); return
  }
  const rect = e.currentTarget.getBoundingClientRect()
  const x    = e.clientX - rect.left
  const FADE = 60

  x < EDGE_ZONE
    ? showArrow(arrowL, Math.min(1, (EDGE_ZONE - x) / FADE) * 0.9)
    : hideArrow(arrowL)

  x > rect.width - EDGE_ZONE
    ? showArrow(arrowR, Math.min(1, (x - (rect.width - EDGE_ZONE)) / FADE) * 0.9)
    : hideArrow(arrowR)
})

document.getElementById('book-spreads')?.addEventListener('mouseleave', () => {
  hideArrow(arrowL); hideArrow(arrowR)
})

function showArrow(el, opacity) {
  if (!el) return
  opacity = opacity || 0.9
  el.classList.add('is-visible')
  gsap.to(el, { opacity, duration: 0.2, ease: 'power2.out' })
}
function hideArrow(el) {
  if (!el) return
  gsap.to(el, { opacity: 0, duration: 0.35, ease: 'power2.out',
    onComplete: () => el.classList.remove('is-visible') })
}

arrowL?.addEventListener('click', e => { e.stopPropagation(); goToPrevSpread() })
arrowR?.addEventListener('click', e => { e.stopPropagation(); goToNextSpread() })

// ── SWIPE (touch + mouse drag) ──
let tStart = 0
document.addEventListener('touchstart', e => { tStart = e.touches[0].clientX }, { passive: true })
document.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - tStart
  if (Math.abs(dx) < 40) return
  if (isMobileLayout()) {
    const spread = document.querySelector(`[data-spread="${BookState.currentSpread}"]`)
    const showingRight = spread?.classList.contains('mobile-right')
    if (dx < 0 && !showingRight) {
      spread?.classList.add('mobile-right')
      BookState.mobileSide = 'right'
      updatePagePosition('right')
      return
    }
    if (dx > 0 && showingRight) {
      spread?.classList.remove('mobile-right')
      BookState.mobileSide = 'left'
      updatePagePosition('left')
      return
    }
  }
  dx < 0 ? goToNextSpread() : goToPrevSpread()
}, { passive: true })

let mStart = 0, dragged = false
document.addEventListener('mousedown', e => { mStart = e.clientX; dragged = false })
document.addEventListener('mousemove', e => { if (Math.abs(e.clientX - mStart) > 10) dragged = true })
document.addEventListener('mouseup', e => {
  if (!dragged) return
  dragged = false
  if (window.getSelection()?.toString().length > 0) return
  const dx = e.clientX - mStart
  if (Math.abs(dx) < 80) return
  dx < 0 ? goToNextSpread() : goToPrevSpread()
})

// ── KEYBOARD ──
document.addEventListener('keydown', e => {
  if (document.activeElement.matches('input,textarea,[contenteditable]')) return
  const shortcutsOpen = document.getElementById('shortcuts-overlay')?.style.display === 'flex'
  if (shortcutsOpen) {
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') changeShortcutPage(-1)
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') changeShortcutPage(1)
    else if (e.key === 'Escape' || e.key === '?') toggleShortcutsOverlay()
    else return
    e.preventDefault()
    return
  }
  if (BookState.phase === 'cover') return
  const map = {
    ArrowRight: goToNextSpread, PageDown: goToNextSpread,
    ArrowLeft:  goToPrevSpread, PageUp:   goToPrevSpread,
    Escape: goToCover,
    '?': toggleShortcutsOverlay,
    Home: () => goToSection('toc'),
    '/': () => goToSection('search'),
    f: toggleCurrentPageFavorite,
    F: toggleCurrentPageFavorite,
    p: printCurrentSpread,
    P: printCurrentSpread,
    l: () => applyLang(currentLang === 'pt' ? 'en' : 'pt'),
    L: () => applyLang(currentLang === 'pt' ? 'en' : 'pt'),
  }
  if (map[e.key]) { e.preventDefault(); map[e.key]() }
})

// ── COVER / BACKCOVER HOVER TILT ──
function applyBookHoverTilt(e) {
  const bw = document.querySelector('.book-wrapper')
  if (!bw) return
  const rect = bw.getBoundingClientRect()
  const rx = ((e.clientY - rect.top    - rect.height / 2) / (rect.height / 2)) * -3
  const ry = ((e.clientX - rect.left   - rect.width  / 2) / (rect.width  / 2)) * 2.5
  gsap.to(bw, { rotationX: rx, rotationY: ry, transformPerspective: 2500, transformOrigin: 'center center', duration: 0.6, ease: 'power2.out' })
}
function resetBookHoverTilt() {
  gsap.to('.book-wrapper', { rotationX: 0, rotationY: 0, duration: 0.8, ease: 'power4.out' })
}

const coverWrapper = document.getElementById('cover-wrapper')
const bookEdgeControls = () => ['#divider-tabs', '#bottom-tabs']
  .map(selector => document.querySelector(selector))
  .filter(Boolean)
if (coverWrapper) {
  const coverFront = document.getElementById('cover-front')
  if (coverFront) {
    coverFront.addEventListener('mousemove', e => {
      if (BookState.phase !== 'cover') return
      applyBookHoverTilt(e)
    })
    coverFront.addEventListener('mouseleave', () => {
      if (BookState.phase !== 'cover') return
      resetBookHoverTilt()
    })
  }

  // Same hover tilt on the back cover
  const bookBackcover = document.getElementById('book-backcover')
  if (bookBackcover) {
    bookBackcover.addEventListener('mousemove', e => {
      if (BookState.phase !== 'backcover') return
      applyBookHoverTilt(e)
    })
    bookBackcover.addEventListener('mouseleave', () => {
      if (BookState.phase !== 'backcover') return
      resetBookHoverTilt()
    })
  }
  coverWrapper.addEventListener('click', () => {
    if (BookState.phase === 'cover') animateCoverOpen()
  })
}

document.getElementById('book-backcover')?.addEventListener('click', goBackCoverToFront)
document.getElementById('book-backcover')?.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    goBackCoverToFront()
  }
})

// ── RIBBON: FAVORITO / IMPRESSÃO ──
let ribbonClickTimer = null
document.getElementById('ribbon-pages')?.addEventListener('click', () => {
  if (BookState.phase === 'cover' || BookState.isAnimating) return
  clearTimeout(ribbonClickTimer)
  ribbonClickTimer = setTimeout(toggleCurrentPageFavorite, 240)
})
document.getElementById('ribbon-pages')?.addEventListener('dblclick', event => {
  event.preventDefault()
  clearTimeout(ribbonClickTimer)
  printCurrentSpread()
})

// ── TOC LINKS ──
function handleTocLinkClick(e) {
  const link = e.target.closest('.toc-entry[data-target-role], .toc-entry[data-target-key]')
  if (!link) return
  e.preventDefault()
  const spread = findSpreadByTarget(link.dataset.targetRole, link.dataset.targetKey)
  const target = Number(spread?.dataset.spread)
  if (!target) return
  const dir = target > BookState.currentSpread ? 'forward' : 'backward'
  animatePageTurn(BookState.currentSpread, target, dir).then(() => animateContentIn(target))
}
document.getElementById('toc-spreads-container')?.addEventListener('click', handleTocLinkClick)
document.getElementById('favorites-toc-container')?.addEventListener('click', handleTocLinkClick)

// ── SVG MAP FOR ILLUSTRATIONS ──
const illustrationSVG = {
  herbs:   `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"><path d="M40,115 C40,90 38,70 42,40 C44,25 40,10 40,10"/><path d="M38,85 C28,78 22,65 30,58 C35,55 40,62 38,85"/><path d="M42,75 C52,68 58,55 50,48 C45,45 40,52 42,75"/><path d="M39,55 C29,48 24,36 32,30 C37,27 41,34 39,55"/><path d="M41,45 C51,38 56,26 48,20 C43,17 40,24 41,45"/><circle cx="40" cy="10" r="3"/></svg>`,
  grain:   `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"><path d="M40,115 L40,30"/><path d="M40,40 C36,34 33,26 36,20 C38,16 42,18 40,40"/><path d="M40,52 C44,46 47,38 44,32 C42,28 38,30 40,52"/><path d="M40,64 C36,58 33,50 36,44 C38,40 42,42 40,64"/><path d="M40,76 C44,70 47,62 44,56 C42,52 38,54 40,76"/><path d="M40,88 C36,82 33,74 36,68 C38,64 42,66 40,88"/></svg>`,
  bowl:    `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="40" cy="60" rx="30" ry="8"/><path d="M10,60 Q10,90 40,92 Q70,90 70,60"/><line x1="20" y1="60" x2="60" y2="60"/><path d="M40,33 L40,20"/><path d="M34,22 C36,18 40,16 40,20"/><path d="M46,22 C44,18 40,16 40,20"/></svg>`,
  vanilla: `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"><path d="M40,110 C40,80 38,60 40,30"/><path d="M40,110 C42,80 44,60 40,30"/><circle cx="40" cy="10" r="1.5"/><path d="M32,25 C34,15 40,10 40,10 C40,10 46,15 48,25"/><path d="M32,25 C30,30 32,35 40,36 C48,35 50,30 48,25"/></svg>`,
  citrus:  `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="40" cy="65" r="28"/><ellipse cx="40" cy="65" rx="20" ry="28"/><line x1="40" y1="37" x2="40" y2="93"/><line x1="12" y1="65" x2="68" y2="65"/></svg>`,
  spice:   `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"><path d="M28,115 L28,40 C28,35 32,30 36,28 C40,26 40,20 40,15"/><circle cx="40" cy="15" r="4"/><path d="M52,70 C52,50 55,35 58,20"/><ellipse cx="55" cy="20" rx="5" ry="8" transform="rotate(-10,55,20)"/></svg>`,
  mortar:  `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20,85 Q18,100 40,102 Q62,100 60,85 L55,60 Q50,55 40,55 Q30,55 25,60 Z"/><path d="M15,60 L65,60"/><path d="M55,40 L55,60"/><ellipse cx="55" cy="38" rx="4" ry="8" transform="rotate(10,55,38)"/></svg>`,
}

// ── POPULATE RESULT SPREAD ──
function populateResultSpread(recipe) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '' }
  set('res-category',  recipe.category)
  set('res-name',      recipe.name)
  set('res-subtitle',  recipe.subtitle)
  set('res-prep',      recipe.prep_time)
  set('res-servings',  recipe.servings)
  set('res-difficulty',recipe.difficulty)
  set('res-story',     recipe.story)
  set('res-tip',       recipe.tip)
  set('res-annotation',recipe.annotation || '')

  const ingEl = document.getElementById('res-ingredients')
  if (ingEl && recipe.ingredients)
    ingEl.innerHTML = recipe.ingredients.map(i => `<li data-stagger>${i}</li>`).join('')

  const stepsEl = document.getElementById('res-steps')
  if (stepsEl && recipe.steps)
    stepsEl.innerHTML = recipe.steps.map((s, i) =>
      `<li data-stagger><span class="step-number">${i+1}</span><span class="step-text">${s}</span></li>`).join('')

  const illEl = document.getElementById('res-illustration')
  if (illEl) {
    const key = recipe.illustration_key || 'mortar'
    illEl.innerHTML = illustrationSVG[key] || illustrationSVG.mortar
  }

  // demo stamp — shown when recipe comes from offline fallback
  const stamp = document.getElementById('res-demo-stamp')
  if (stamp) {
    stamp.classList.toggle('visible', !!recipe._demo)
  }

  BookState.currentRecipe = recipe
  if (!BookState.currentRecipeVariants[currentLang]) {
    BookState.currentRecipeVariants[currentLang] = recipe
  }

  syncRibbonFavorite()
}

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

function ensureResultPagination(recipe) {
  const host = document.getElementById('result-continuation-container')
  if (!host) return
  host.innerHTML = ''

  const resultSpread = document.querySelector('[data-role="result"]')
  const wasHidden = resultSpread && getComputedStyle(resultSpread).display === 'none'
  const previousDisplay = resultSpread?.style.display || ''
  const previousVisibility = resultSpread?.style.visibility || ''
  if (wasHidden && resultSpread) {
    resultSpread.style.display = 'grid'
    resultSpread.style.visibility = 'hidden'
  }

  const leftCard = document.getElementById('result-left-card')
  const rightCard = document.querySelector('#result-right .recipe-card-border')
  const ingredients = document.getElementById('res-ingredients')
  const steps = document.getElementById('res-steps')
  const overflowIngredients = extractOverflowItems(ingredients, leftCard, 4)
  const overflowSteps = extractOverflowItems(steps, rightCard, 3)

  if (wasHidden && resultSpread) {
    resultSpread.style.display = previousDisplay
    resultSpread.style.visibility = previousVisibility
  }

  document.querySelectorAll('.continues-hint').forEach(el => el.remove())

  if (!overflowIngredients.length && !overflowSteps.length) {
    rebuildBookLayout({ keepCurrent: true })
    return
  }

  const continuesLabel = currentLang === 'en' ? 'continues →' : 'continua →'
  if (overflowIngredients.length) {
    const hint = document.createElement('p')
    hint.className = 'continues-hint'
    hint.textContent = continuesLabel
    document.getElementById('res-ingredients')?.insertAdjacentElement('afterend', hint)
  }
  if (overflowSteps.length) {
    const hint = document.createElement('p')
    hint.className = 'continues-hint'
    hint.textContent = continuesLabel
    document.getElementById('res-steps')?.insertAdjacentElement('afterend', hint)
  }

  const continuation = document.createElement('div')
  continuation.className = 'book-spread'
  continuation.dataset.role = 'result-continuation'
  continuation.innerHTML = `
    <div class="page-turn-layer"><div class="turn-front"></div><div class="turn-back"></div></div>
    <div class="page page-left">
      <div class="curl-zone curl-left" role="button" aria-label="Página anterior"><div class="curl-surface"></div><div class="curl-hint">‹</div></div>
      <div class="recipe-card-border result-continuation-card">
        <span class="recipe-eyebrow">${recipe.category || ''}</span>
        <h2 class="continuation-title">${recipe.name || ''}</h2>
        <span class="section-label">${currentLang === 'en' ? 'Ingredients, continued' : 'Ingredientes, continuação'}</span>
        <ul class="ingredients-list">
          ${overflowIngredients.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
      <div class="page-footer"><span class="footer-brand">Foodpedia</span><span class="page-number"></span></div>
    </div>
    <div class="page page-right">
      <div class="curl-zone curl-right" role="button" aria-label="Próxima página"><div class="curl-surface"></div><div class="curl-hint">›</div></div>
      <div class="recipe-card-border result-continuation-card">
        <span class="section-label">${currentLang === 'en' ? 'Instructions, continued' : 'Modo de preparo, continuação'}</span>
        <ol class="steps-list">
          ${overflowSteps.map((item, index) => `<li><span class="step-number">${steps.children.length + index + 1}</span><span class="step-text">${item.replace(/^\d+\s*/, '')}</span></li>`).join('')}
        </ol>
        <div class="continuation-ornament">${illustrationSVG[recipe.illustration_key] || illustrationSVG.mortar}</div>
      </div>
      <div class="page-footer"><span class="footer-brand">Foodpedia</span><span class="page-number"></span></div>
    </div>`
  host.appendChild(continuation)
  rebuildBookLayout({ keepCurrent: true })
}

// ── PROVIDER + MODEL SELECTOR ──
const _PROVIDER_ORDER = ['gemini', 'ollama']
let apiAvailable = true

async function fetchStaticJson(path) {
  const cleanPath = path.replace(/^\/+/, '')
  const candidates = [
    cleanPath,
    `./${cleanPath}`,
    cleanPath.startsWith('static/') ? cleanPath.replace('static/', '/static/') : `/${cleanPath}`,
  ]
  for (const candidate of [...new Set(candidates)]) {
    try {
      const res = await fetch(candidate)
      if (res.ok) return res.json()
    } catch {}
  }
  throw new Error(`Could not load ${path}`)
}

function localDemoRecipe(dish, recipes) {
  if (!recipes?.length) throw new Error('DEMO_RECIPES_UNAVAILABLE')
  const query = (dish || '').toLowerCase().trim()
  const exact = recipes.find(recipe => (recipe.name || '').toLowerCase() === query)
  const partial = recipes.find(recipe => {
    const name = (recipe.name || '').toLowerCase()
    return name.includes(query) || query.includes(name)
  })
  const source = exact || partial || recipes[Math.floor(Math.random() * recipes.length)]
  return { ...source, _demo: true }
}

async function loadProviders() {
  const list = document.getElementById('model-list')
  if (!list) return

  let data = {}
  try {
    const res = await fetch('/api/models')
    if (!res.ok) throw new Error('models unavailable')
    data = await res.json()
  } catch {
    apiAvailable = false
    data = { providers: {} }
  }

  const providers = data.providers || {}
  const items = []

  for (const pid of _PROVIDER_ORDER) {
    const p = providers[pid]
    if (!p?.available) continue
    const models = p?.models?.length ? p.models : [pid]
    const label = { ollama: 'Ollama', gemini: 'Gemini' }[pid] || pid
    items.push({ type: 'header', label })
    for (const m of models) {
      items.push({ type: 'model', provider: pid, model: m, label: m })
    }
  }

  if (items.length === 0) {
    list.innerHTML = '<li class="model-option loading-models">Nenhum modelo disponível</li>'
    return
  }

  // auto-select: first available provider in priority order
  if (!BookState.selectedProvider) {
    const first = items.find(i => i.type === 'model')
    if (first) {
      BookState.selectedProvider = first.provider
      BookState.selectedModel    = first.model
    }
  }

  list.innerHTML = items.map(item => {
    if (item.type === 'header') {
      return `<li class="model-option provider-section-header">${item.label}</li>`
    }
    const sel = item.provider === BookState.selectedProvider && item.model === BookState.selectedModel
    return `<li class="model-option${sel ? ' selected' : ''}" data-provider="${item.provider}" data-model="${item.model}">${item.label}</li>`
  }).join('')

  list.querySelectorAll('.model-option[data-provider]').forEach(el => {
    el.addEventListener('click', () => {
      BookState.selectedProvider = el.dataset.provider
      BookState.selectedModel    = el.dataset.model
      list.querySelectorAll('.model-option').forEach(o => o.classList.remove('selected'))
      el.classList.add('selected')
    })
  })
}

loadProviders()

// ── GEMINI KEY MANAGEMENT ──

function getGeminiKey() {
  return localStorage.getItem('gemini_key') || ''
}

function saveGeminiKey() {
  const input = document.getElementById('gemini-key-input')
  const key = (input?.value || '').trim()
  if (!key) return
  localStorage.setItem('gemini_key', key)
  const status = document.getElementById('gemini-key-status')
  if (status) { status.textContent = '✓ Chave salva'; setTimeout(() => { status.textContent = '' }, 2500) }
}

function removeGeminiKey() {
  localStorage.removeItem('gemini_key')
  const input = document.getElementById('gemini-key-input')
  if (input) input.value = ''
  const status = document.getElementById('gemini-key-status')
  if (status) { status.textContent = 'Chave removida'; setTimeout(() => { status.textContent = '' }, 2500) }
}

function prefillGeminiKeyInput() {
  const input = document.getElementById('gemini-key-input')
  if (!input) return
  const stored = getGeminiKey()
  input.value = stored
  if (!stored) setTimeout(() => input.focus(), 120)
}

// ── FETCH RECIPE ──

async function fetchRecipe(query) {
  if (!apiAvailable) {
    const recipes = await fetchStaticJson('static/data/demo_recipes.json')
    return localDemoRecipe(query, recipes)
  }

  const body = { dish: query, lang: currentLang }
  if (BookState.selectedProvider) body.provider = BookState.selectedProvider
  if (BookState.selectedModel)    body.model    = BookState.selectedModel
  const geminiKey = getGeminiKey()
  if (geminiKey) body.gemini_key = geminiKey
  const res = await fetch('/api/recipe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    if (res.status === 404 || res.status === 405) {
      apiAvailable = false
      const recipes = await fetchStaticJson('static/data/demo_recipes.json')
      return localDemoRecipe(query, recipes)
    }
    let errorCode = 'INTERNAL_ERROR'
    try { errorCode = (await res.json()).error || errorCode } catch {}
    BookState.lastErrorCode = errorCode
    throw new Error(errorCode)
  }
  return res.json()
}

// ── LOADING NOTIFY ──
function notifyRecipeReady(recipe) {
  BookState.resultAvailable = true
  BookState.errorActive = false
  BookState.setupActive = false
  BookState.currentRecipeVariants = { [currentLang]: recipe }
  populateResultSpread(recipe)
  ensureResultPagination(recipe)
  rebuildBookLayout({ keepCurrent: true })
  document.querySelector('[data-section="result"]')?.classList.add('is-ready')
  gsap.to('#ribbon-pages', {
    opacity: 0.25, duration: 0.45, repeat: 7, yoyo: true, ease: 'power1.inOut',
    onComplete: () => gsap.set('#ribbon-pages', { opacity: 1 })
  })
  showArrow(arrowR, 0.9)
}

// ── ERROR SPREAD ──
function populateErrorSpread(code) {
  const heading = document.getElementById('error-heading')
  const body    = document.getElementById('error-body')
  const action  = document.getElementById('error-action')
  if (!heading || !body || !action) return

  const t = (key, fallback) => {
    const map = window._i18nStrings?.[currentLang] || {}
    return map[key] || fallback
  }

  const map = {
    OLLAMA_OFFLINE:    ['error_ollama_heading',  'error_ollama_body',  'error_ollama_action',  () => showSetup('ollama')],
    GEMINI_KEY_MISSING:['error_gemini_heading',  'error_gemini_body',  'error_gemini_action',  () => showSetup('gemini')],
    TIMEOUT:           ['error_timeout_heading', 'error_timeout_body', null,                   null],
    PARSE_ERROR:       ['error_parse_heading',   'error_parse_body',   null,                   null],
  }

  const entry = map[code] || ['error_heading', 'error_body', null, null]
  heading.textContent = t(entry[0], 'Algo deu errado')
  body.textContent    = t(entry[1], 'Não foi possível obter a receita.')
  if (entry[2] && entry[3]) {
    action.textContent = t(entry[2], 'Como configurar →')
    action.onclick = entry[3]
    action.style.display = ''
  } else {
    action.style.display = 'none'
  }
}

// ── RETRY ──
function retryLastSearch() {
  if (BookState.loadingQuery) startRecipeSearch(BookState.loadingQuery)
}

// ── SHOW RESULT ──
function showRecipeResult(recipe) {
  BookState.phase = 'result'
  BookState.pendingRecipe = null
  BookState.resultAvailable = true
  BookState.errorActive = false
  BookState.setupActive = false
  BookState.currentRecipeVariants = { [currentLang]: recipe }
  document.querySelector('[data-section="result"]')?.classList.remove('is-ready')
  rebuildBookLayout({ keepCurrent: true })
  populateResultSpread(recipe)
  if (!searchHistory().some(item => item.recipe?.name === recipe.name)) saveSearchHistory(recipe)
  const direction = SPREAD_RESULT > BookState.currentSpread ? 'forward' : 'backward'
  animatePageTurn(BookState.currentSpread, SPREAD_RESULT, direction).then(() => {
    const spread = document.querySelector(`[data-spread="${SPREAD_RESULT}"]`)
    if (!spread) return
    const items = spread.querySelectorAll('[data-stagger]')
    gsap.fromTo(items,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: DUR.content, ease: 'expo.out',
        stagger: reducedMotion ? 0 : 0.025 }
    )
    updateDividerTabs(SPREAD_RESULT)
    ensureResultPagination(recipe)
  })
}

function showSetup(mode = 'all') {
  const setupSpread = document.querySelector('[data-role="setup"]')
  if (setupSpread) setupSpread.dataset.setupMode = mode

  // update privacy note based on mode
  const privacyEl = document.getElementById('setup-privacy')
  if (privacyEl) {
    const t = (key, fallback) => window._i18nStrings?.[currentLang]?.[key] || fallback
    if (mode === 'gemini') {
      privacyEl.dataset.i18n = 'setup_privacy_gemini'
      privacyEl.textContent = t('setup_privacy_gemini', 'With Gemini, queries go to Google.')
    } else {
      privacyEl.dataset.i18n = 'setup_privacy_ollama'
      privacyEl.textContent = t('setup_privacy_ollama', 'Runs completely offline with Ollama.')
    }
  }

  BookState.errorActive = true
  BookState.setupActive = true
  BookState.resultAvailable = false
  prefillGeminiKeyInput()
  rebuildBookLayout({ keepCurrent: BookState.phase !== 'cover' })
  if (BookState.phase === 'cover') {
    animateCoverOpen()
    setTimeout(() => navigateToSpread(SPREAD_SETUP), 1300)
    return
  }
  navigateToSpread(SPREAD_SETUP)
}

function showOllamaSetup() { showSetup('ollama') }

function navigateToSpread(target) {
  if (!target || BookState.isAnimating || target === BookState.currentSpread) return Promise.resolve()
  const direction = target > BookState.currentSpread ? 'forward' : 'backward'
  return animatePageTurn(BookState.currentSpread, target, direction).then(() => animateContentIn(target))
}

// ── START SEARCH ──
const FAST_THRESHOLD_MS = 1500

async function startRecipeSearch(query) {
  if (BookState.phase === 'loading') return
  BookState.resultAvailable = false
  BookState.errorActive = false
  BookState.setupActive = false
  BookState.lastErrorCode = null
  rebuildBookLayout({ keepCurrent: true })
  BookState.phase = 'loading'
  BookState.loadingQuery = query
  BookState.pendingRecipe = null

  let resolved = false
  let recipe = null
  let fetchError = null

  const fetchPromise = fetchRecipe(query).then(r => { recipe = r }).catch(e => { fetchError = e })
  const timerPromise = new Promise(res => setTimeout(res, FAST_THRESHOLD_MS))

  // race: if fetch wins before threshold, go straight to result
  await Promise.race([fetchPromise, timerPromise])

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

  if (recipe) {
    // fast path: response came before threshold
    resolved = true
    BookState.pendingRecipe = recipe
    showRecipeResult(recipe)
    return
  }

  // slow path: browse while loading
  const recipeDirection = SPREAD_RECIPES_START > BookState.currentSpread ? 'forward' : 'backward'
  await animatePageTurn(BookState.currentSpread, SPREAD_RECIPES_START, recipeDirection)
  animateContentIn(SPREAD_RECIPES_START)

  // wait for fetch to complete
  await fetchPromise

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

  BookState.pendingRecipe = recipe
  notifyRecipeReady(recipe)
  const t = (key, fallback) => window._i18nStrings?.[currentLang]?.[key] || fallback
  showToast(t('recipe_ready_toast', 'Receita pronta! Avance para ver o resultado.'))
}

// ── SEARCH INPUT ──
const searchInput = document.getElementById('recipe-search')
if (searchInput) {
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim())
      startRecipeSearch(e.target.value.trim())
  })
}

// ── SAVED RECIPES ──
const MAX_SAVED = 10

function saveCurrentRecipe() {
  const recipe = BookState.currentRecipe
  if (!recipe) return

  let saved = JSON.parse(localStorage.getItem('fp_saved_recipes') || '[]')

  if (saved.length >= MAX_SAVED) {
    showToast('Limite de 10 receitas. Remova uma para adicionar.'); return
  }
  if (saved.some(s => s.recipe.name === recipe.name)) {
    showToast(`"${recipe.name}" já está salva.`); return
  }

  saved.push({
    id: Date.now().toString(),
    savedAt: Date.now(),
    recipe,
    variants: { ...BookState.currentRecipeVariants },
    sourceLang: currentLang,
    userAnnotation: '',
  })
  localStorage.setItem('fp_saved_recipes', JSON.stringify(saved))
  rebuildSavedSpreads()
  rebuildBookLayout({ keepCurrent: true })
  showSavedTab()
  showToast(`"${recipe.name}" salva no seu livro.`)
}

function deleteSavedRecipe(id) {
  const currentRole = document.querySelector(`[data-spread="${BookState.currentSpread}"]`)?.dataset.role
  let saved = JSON.parse(localStorage.getItem('fp_saved_recipes') || '[]')
  saved = saved.filter(s => s.id !== id)
  localStorage.setItem('fp_saved_recipes', JSON.stringify(saved))
  rebuildSavedSpreads()
  rebuildBookLayout({ keepCurrent: currentRole !== 'saved' })
  if (!saved.length) hideSavedTab()
  if (currentRole === 'saved') {
    showSpread(SPREAD_RECIPES_END)
    animateContentIn(SPREAD_RECIPES_END)
  }
}

function saveAnnotation(id, text) {
  let saved = JSON.parse(localStorage.getItem('fp_saved_recipes') || '[]')
  const entry = saved.find(s => s.id === id)
  if (entry) {
    entry.userAnnotation = text
    localStorage.setItem('fp_saved_recipes', JSON.stringify(saved))
  }
}

function rebuildSavedSpreads() {
  const container = document.getElementById('saved-spreads-container')
  if (!container) return
  container.innerHTML = ''

  const saved = savedRecipes()
  const labels = currentLang === 'en'
    ? { prep: 'Prep', servings: 'Serves', level: 'Level', ingredients: 'Ingredients', notes: 'Notes', story: 'The Story', steps: 'Instructions', tip: 'Tip', placeholder: 'write here...' }
    : { prep: 'Preparo', servings: 'Porções', level: 'Nível', ingredients: 'Ingredientes', notes: 'Anotações', story: 'A História', steps: 'Modo de Preparo', tip: 'Dica', placeholder: 'escreva aqui...' }
  saved.forEach((entry, i) => {
    const r = entry.variants?.[currentLang] || entry.recipe
    const illKey = r.illustration_key || 'mortar'
    const ill = illustrationSVG[illKey] || illustrationSVG.mortar

    const ingredients = (r.ingredients || [])
      .map(ing => `<li>${ing}</li>`).join('')
    const steps = (r.steps || [])
      .map((s, si) => `<li><span class="step-number">${si+1}</span><span class="step-text">${s}</span></li>`).join('')

    const el = document.createElement('div')
    el.className = 'book-spread'
    el.dataset.role = 'saved'
    el.dataset.savedId = entry.id
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
            <h3 class="section-label">${labels.ingredients}</h3>
            <ul class="ingredients-list">${ingredients}</ul>
          </div>
        </div>
        <div class="saved-controls">
          <button class="ctrl-delete" onclick="deleteSavedRecipe('${entry.id}')" title="Remover">✕</button>
        </div>
        <div class="handwritten-annotation annotation-0">${r.annotation || ''}</div>
        <div class="page-footer">
          <span class="footer-brand">Foodpedia</span>
          <span class="page-number"></span>
        </div>
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
          <div class="chef-tip">
            <span class="tip-label">${labels.tip}</span>
            <p class="tip-text">${r.tip || ''}</p>
          </div>
        </div>
        <div class="page-footer">
          <span class="footer-brand">Foodpedia</span>
          <span class="page-number"></span>
        </div>
      </div>`

    container.appendChild(el)
  })

  initCurlZones()
}

function updateTOCSavedSection() {
  rebuildBookLayout({ keepCurrent: true })
}

function filterSavedRecipes(query) {
  const saved = savedRecipes()
  const q = query.toLowerCase().trim()
  document.querySelectorAll('.toc-saved-item').forEach(item => {
    const entry = saved.find(recipe => recipe.id === item.dataset.recipeId)
    const recipe = entry?.variants?.[currentLang] || entry?.recipe || {}
    const haystack = `${recipe.name || ''} ${recipe.category || ''}`.toLowerCase()
    item.style.display = !q || haystack.includes(q) ? '' : 'none'
  })
}

function showSavedTab() {
  const tab = document.getElementById('tab-saved')
  if (!tab) return
  tab.style.display = 'flex'
  /* badge removed */
  gsap.fromTo(tab, { opacity: 0, x: 6 }, { opacity: 1, x: 0, duration: 0.35, ease: 'expo.out' })
}

function hideSavedTab() {
  const tab = document.getElementById('tab-saved')
  /* badge removed */
  if (tab) gsap.to(tab, { opacity: 0, x: 6, duration: 0.2,
    onComplete: () => tab.style.display = 'none' })
}


const HISTORY_KEY = 'fp_search_history'

function searchHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

function saveSearchHistory(recipe) {
  if (!recipe?.name) return
  const history = searchHistory().filter(item => item.recipe?.name !== recipe.name)
  history.unshift({
    id: `${Date.now()}-${recipe.name}`,
    recipe,
    variants: { ...BookState.currentRecipeVariants },
    sourceLang: currentLang,
  })
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 5)))
  renderSearchHistory()
}

function renderSearchHistory() {
  const host = document.getElementById('history-marks')
  if (!host) return
  const history = searchHistory()
  host.innerHTML = history.map((item, index) => {
    const recipe = item.variants?.[currentLang] || item.recipe
    const name = recipe?.name || item.recipe?.name || ''
    return `<button class="history-mark" type="button" data-history-index="${index}"
      aria-label="${name.replaceAll('"', '&quot;')}"
      title="${name.replaceAll('"', '&quot;')}"><span>${name}</span></button>`
  }).join('')
  host.style.display = history.length ? 'flex' : 'none'
}

document.getElementById('history-marks')?.addEventListener('click', event => {
  const mark = event.target.closest('[data-history-index]')
  if (!mark) return
  const item = searchHistory()[Number(mark.dataset.historyIndex)]
  if (!item) return
  BookState.currentRecipeVariants = { ...(item.variants || {}), [item.sourceLang || 'pt']: item.recipe }
  const recipe = BookState.currentRecipeVariants[currentLang] || item.recipe
  BookState.phase = 'result'
  BookState.resultAvailable = true
  BookState.errorActive = false
  BookState.setupActive = false
  populateResultSpread(recipe)
  rebuildBookLayout({ keepCurrent: true })
  navigateToSpread(SPREAD_RESULT).then(() => ensureResultPagination(recipe))
})

// ── FAVORITES ──
function currentFavoriteKey() {
  if (BookState.phase === 'cover' || BookState.phase === 'backcover') return ''
  return spreadKey(document.querySelector(`[data-spread="${BookState.currentSpread}"]`))
}

function favoriteKeys() {
  try {
    return JSON.parse(localStorage.getItem('fp_favs') || '[]')
  } catch {
    return []
  }
}

function syncRibbonFavorite() {
  const ribbon = document.getElementById('ribbon-pages')
  if (!ribbon) return
  const active = Boolean(currentFavoriteKey()) && favoriteKeys().includes(currentFavoriteKey())
  ribbon.classList.toggle('is-favorite', active)
  ribbon.setAttribute('aria-pressed', String(active))
  ribbon.setAttribute('aria-label', active
    ? (currentLang === 'en' ? 'Remove page from favorites' : 'Remover página dos favoritos')
    : (currentLang === 'en' ? 'Add page to favorites' : 'Favoritar página'))
  if (BookState.phase !== 'cover') {
    gsap.to(ribbon, {
      y: 0,
      height: active ? 90 : 72,
      duration: 0.22,
      ease: 'power4.out',
    })
  }
}

function syncFavoritesTab() {
  const tab = document.getElementById('tab-favorites')
  const available = favoriteKeys()
    .filter(key => BookState.layout.some(spread => spreadKey(spread) === key))
  if (!tab) return
  const visible = available.length > 0
  if (visible) {
    tab.style.display = 'flex'
    tab.setAttribute('aria-label', currentLang === 'en'
      ? `${available.length} favorite pages`
      : `${available.length} páginas favoritas`)
  } else {
    tab.style.display = 'none'
  }
}

function toggleCurrentPageFavorite() {
  const id = currentFavoriteKey()
  if (!id) return
  let favs = JSON.parse(localStorage.getItem('fp_favs') || '[]')
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

function loadFavorites() {
  syncRibbonFavorite()
  syncFavoritesTab()
}

function printCurrentSpread() {
  if (BookState.phase === 'cover' || BookState.phase === 'backcover') return
  const recipe = currentPrintableRecipe()
  if (!recipe) {
    showToast(currentLang === 'en'
      ? 'Open a recipe before printing its cards.'
      : 'Abra uma receita antes de imprimir as fichas.')
    return
  }
  buildPrintRecipe(recipe)
  window.print()
}

function currentPrintableRecipe() {
  const spread = document.querySelector(`[data-spread="${BookState.currentSpread}"]`)
  if (!spread) return null
  if (spread.dataset.role === 'base-recipe') return staticRecipeData(spread, currentLang)
  if (spread.dataset.role === 'result' || spread.dataset.role === 'result-continuation') {
    return BookState.currentRecipeVariants[currentLang] || BookState.currentRecipe
  }
  if (spread.dataset.role === 'saved') {
    const entry = savedRecipes().find(item => item.id === spread.dataset.savedId)
    if (!entry) return null
    const recipe = entry.variants?.[currentLang] || entry.recipe
    return { ...recipe, userAnnotation: entry.userAnnotation || '' }
  }
  return null
}

function escapePrintText(value) {
  const element = document.createElement('span')
  element.textContent = value || ''
  return element.innerHTML
}

function buildPrintRecipe(recipe) {
  const host = document.getElementById('print-recipe')
  if (!host) return
  const labels = currentLang === 'en'
    ? {
        card: 'Recipe card', prep: 'Prep', servings: 'Serves', level: 'Level',
        ingredients: 'Ingredients', steps: 'Instructions',
        tip: 'Kitchen note', notes: 'Personal notes',
      }
    : {
        card: 'Ficha de receita', prep: 'Preparo', servings: 'Porções', level: 'Nível',
        ingredients: 'Ingredientes', steps: 'Modo de preparo',
        tip: 'Nota de cozinha', notes: 'Anotações pessoais',
      }
  host.innerHTML = `
    <article class="print-card-sheet">
      <header class="print-card-header">
        <span class="print-card-kicker">${labels.card} · Foodpedia</span>
        <h1>${escapePrintText(recipe.name)}</h1>
        <p>${escapePrintText(recipe.subtitle)}</p>
      </header>
      <dl class="print-card-meta">
        <div><dt>${labels.prep}</dt><dd>${escapePrintText(recipe.prep_time)}</dd></div>
        <div><dt>${labels.servings}</dt><dd>${escapePrintText(recipe.servings)}</dd></div>
        <div><dt>${labels.level}</dt><dd>${escapePrintText(recipe.difficulty)}</dd></div>
      </dl>
      <div class="print-card-body">
        <section class="print-card-section">
          <h2>${labels.ingredients}</h2>
          <ul>${(recipe.ingredients || []).map(item => `<li>${escapePrintText(item)}</li>`).join('')}</ul>
        </section>
        <div class="print-card-right-col">
          ${recipe.story ? `<div class="print-card-story"><p>${escapePrintText(recipe.story)}</p></div>` : ''}
          <section class="print-card-section">
            <h2>${labels.steps}</h2>
            <ol>${(recipe.steps || []).map(item => `<li>${escapePrintText(item)}</li>`).join('')}</ol>
          </section>
        </div>
      </div>
      <aside class="print-card-tip">
        <strong>${labels.tip}</strong>
        <p>${escapePrintText(recipe.tip)}</p>
      </aside>
      ${recipe.userAnnotation ? `
        <section class="print-card-personal-note">
          <strong>${labels.notes}</strong>
          <p>${escapePrintText(recipe.userAnnotation)}</p>
        </section>` : ''}
      <footer class="print-card-footer">${escapePrintText(recipe.category)}</footer>
    </article>`
  host.setAttribute('aria-hidden', 'false')
}

// ── SHARE ──
function shareCurrentPage() {
  let r = BookState.currentRecipe

  if (!r) {
    const spread = document.querySelector(`[data-spread="${BookState.currentSpread}"]`)
    if (spread) {
      const role = spread.dataset.role
      if (role === 'base-recipe') {
        const key = currentLang === 'en' ? '.base-recipe-data-en' : '.base-recipe-data'
        const scriptEl = spread.querySelector(key)
        if (scriptEl) { try { r = JSON.parse(scriptEl.textContent) } catch {} }
      } else if (role === 'saved') {
        const entry = savedRecipes().find(s => s.id === spread.dataset.savedId)
        if (entry) r = entry.variants?.[currentLang] || entry.recipe
      }
    }
  }

  if (!r) return
  const text = `🍽 ${r.name}\n— ${r.subtitle || ''}\n📍 ${r.category}\n\n⏱ ${r.prep_time}  |  🥘 ${r.servings}  |  📊 ${r.difficulty}\n\nINGREDIENTES\n${(r.ingredients||[]).map(i=>`• ${i}`).join('\n')}\n\nMODO DE PREPARO\n${(r.steps||[]).map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\n💡 ${r.tip}\n\n— via Foodpedia`
  if (navigator.share) {
    navigator.share({ title: r.name, text })
  } else {
    navigator.clipboard.writeText(text).then(() => showToast(currentLang === 'en' ? 'Recipe copied!' : 'Receita copiada!'))
  }
}

// ── LANGUAGE ──
let currentLang = localStorage.getItem('fp_lang') || 'pt'
let i18nData = {}

function applyStaticText() {
  const t = i18nData[currentLang] || i18nData.pt || {}
  document.querySelectorAll('[data-i18n]').forEach(el => {
    if (t[el.dataset.i18n]) el.textContent = t[el.dataset.i18n]
  })
  const input = document.getElementById('recipe-search')
  if (input && t.search_placeholder) input.placeholder = t.search_placeholder
}

async function loadI18n() {
  try {
    const res = await fetch('/static/data/i18n.json')
    i18nData = await res.json()
    window._i18nStrings = i18nData
    applyLang(currentLang)
  } catch { /* fail silently — default strings in HTML */ }
}

async function applyLang(lang) {
  if (!['pt', 'en'].includes(lang) || BookState.languageTransition) return
  const languageChanged = currentLang !== lang
  if (!languageChanged) {
    applyStaticText()
    document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR'
    document.querySelectorAll('.lang-tab').forEach(btn => {
      const active = btn.dataset.lang === lang
      btn.classList.toggle('active', active)
      btn.setAttribute('aria-pressed', String(active))
    })
    return
  }
  const wasOpen = !['cover', 'backcover'].includes(BookState.phase)
  const currentSpread = document.querySelector(`[data-spread="${BookState.currentSpread}"]`)
  const targetKey = spreadKey(currentSpread)
  const targetSide = BookState.mobileSide
  BookState.languageTransition = true
  if (wasOpen) await goToCover()

  currentLang = lang
  localStorage.setItem('fp_lang', lang)
  applyStaticText()
  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR'
  document.querySelectorAll('.lang-tab').forEach(btn => {
    const active = btn.dataset.lang === lang
    btn.classList.toggle('active', active)
    btn.setAttribute('aria-pressed', String(active))
  })

  rebuildSavedSpreads()
  rebuildBookLayout()
  renderSearchHistory()

  if (wasOpen) {
    await animateCoverOpen(targetKey, targetSide)
  }
  BookState.languageTransition = false
  translateCurrentRecipe(lang)
  translateVisibleStaticRecipe()
}

loadI18n()

async function translateCurrentRecipe(targetLang) {
  if (!BookState.currentRecipe || BookState.translating) return
  const cached = BookState.currentRecipeVariants[targetLang]
  if (cached) {
    populateResultSpread(cached)
    return
  }

  BookState.translating = true
  const sourceRecipe = BookState.currentRecipe
  const resultSpread = document.querySelector('[data-role="result"]')
  resultSpread?.classList.add('is-translating')
  showToast(targetLang === 'en' ? 'Translating recipe…' : 'Traduzindo receita…')
  try {
    const body = {
      recipe: BookState.currentRecipe,
      target_lang: targetLang,
      provider: BookState.selectedProvider || 'ollama',
      model: BookState.selectedModel || 'gemma3:latest',
      gemini_key: getGeminiKey() || undefined,
    }
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error('translation failed')
    const translated = await response.json()
    BookState.currentRecipeVariants[targetLang] = translated
    populateResultSpread(translated)
    ensureResultPagination(translated)
    persistCurrentRecipeTranslation(targetLang, translated, sourceRecipe)
  } catch {
    showToast(targetLang === 'en'
      ? 'The interface changed, but the recipe could not be translated.'
      : 'A interface mudou, mas não foi possível traduzir a receita.')
  } finally {
    BookState.translating = false
    resultSpread?.classList.remove('is-translating')
  }
}

function staticRecipeData(spread, lang = 'pt') {
  const selector = lang === 'en' ? '.base-recipe-data-en' : '.base-recipe-data'
  const raw = spread?.querySelector(selector)?.textContent
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function renderStaticRecipe(spread, recipe) {
  if (!spread || !recipe) return
  const set = (selector, value) => {
    const element = spread.querySelector(selector)
    if (element) element.textContent = value || ''
  }
  set('.recipe-eyebrow', recipe.category)
  set('.recipe-title', recipe.name)
  set('.recipe-subtitle-italic', recipe.subtitle)
  const meta = spread.querySelectorAll('.meta-value')
  if (meta[0]) meta[0].textContent = recipe.prep_time || ''
  if (meta[1]) meta[1].textContent = recipe.servings || ''
  if (meta[2]) meta[2].textContent = recipe.difficulty || ''
  const ingredients = spread.querySelector('.ingredients-list')
  if (ingredients) ingredients.innerHTML = (recipe.ingredients || []).map(item => `<li>${item}</li>`).join('')
  set('.story-text', recipe.story)
  const steps = spread.querySelector('.steps-list')
  if (steps) steps.innerHTML = (recipe.steps || []).map((step, index) =>
    `<li><span class="step-number">${index + 1}</span><span class="step-text">${step}</span></li>`).join('')
  set('.tip-text', recipe.tip)
  set('.handwritten-annotation', recipe.annotation)
}

async function translateVisibleStaticRecipe() {
  const spread = document.querySelector(`[data-spread="${BookState.currentSpread}"][data-role="base-recipe"]`)
  if (!spread) return
  const recipe = staticRecipeData(spread, currentLang)
  if (recipe) renderStaticRecipe(spread, recipe)
}

function persistCurrentRecipeTranslation(lang, translated, sourceRecipe) {
  const sourceName = sourceRecipe?.name
  const saved = savedRecipes()
  let savedChanged = false
  saved.forEach(entry => {
    const originalName = entry.recipe?.name
    const knownNames = Object.values(entry.variants || {}).map(variant => variant?.name)
    if (originalName === sourceName || knownNames.includes(sourceName)) {
      entry.variants = { ...(entry.variants || {}), [lang]: translated }
      savedChanged = true
    }
  })
  if (savedChanged) localStorage.setItem('fp_saved_recipes', JSON.stringify(saved))

  const history = searchHistory()
  let historyChanged = false
  history.forEach(entry => {
    const originalName = entry.recipe?.name
    const knownNames = Object.values(entry.variants || {}).map(variant => variant?.name)
    if (originalName === sourceName || knownNames.includes(sourceName)) {
      entry.variants = { ...(entry.variants || {}), [lang]: translated }
      historyChanged = true
    }
  })
  if (historyChanged) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    renderSearchHistory()
  }
}

// ── SHORTCUTS OVERLAY ──
function toggleShortcutsOverlay() {
  const o = document.getElementById('shortcuts-overlay')
  if (!o) return
  const isOpen = o.style.display === 'flex'
  o.style.display = isOpen ? 'none' : 'flex'
  if (!isOpen) changeShortcutPage(-BookState.shortcutPage)
  if (!isOpen && o.firstElementChild)
    gsap.fromTo(o.firstElementChild,
      { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.3, ease: 'expo.out' })
}

function changeShortcutPage(delta) {
  const sheets = [...document.querySelectorAll('.shortcut-sheet')]
  if (!sheets.length) return
  BookState.shortcutPage = (BookState.shortcutPage + delta + sheets.length) % sheets.length
  sheets.forEach((sheet, index) => sheet.classList.toggle('active', index === BookState.shortcutPage))
  const label = document.getElementById('shortcut-page-label')
  if (label) label.textContent = `${BookState.shortcutPage + 1} / ${sheets.length}`
}

// ── ANNOTATIONS (editorial + user-created) ──
const ANNOTATION_POSITIONS_KEY = 'fp_annotation_positions'
const USER_ANNOTATIONS_KEY = 'fp_user_annotations'

function annotationPositions() {
  try { return JSON.parse(localStorage.getItem(ANNOTATION_POSITIONS_KEY) || '{}') } catch { return {} }
}

function userAnnotationsData() {
  try { return JSON.parse(localStorage.getItem(USER_ANNOTATIONS_KEY) || '[]') } catch { return [] }
}

function saveUserAnnotationsData(list) {
  localStorage.setItem(USER_ANNOTATIONS_KEY, JSON.stringify(list))
}

function annotationStorageKey(annotation) {
  const spread = annotation.closest('.book-spread')
  // Use element id, or a stable class-based key for heirloom notes
  const noteClass = [...annotation.classList]
    .find(c => c.startsWith('note-') || c === 'heirloom-crossout') || ''
  return `${spreadKey(spread)}:${annotation.id || noteClass || 'editorial-note'}`
}

function restoreAnnotationPosition(annotation) {
  const saved = annotationPositions()[annotationStorageKey(annotation)]
  if (!saved) return
  annotation.style.left = `${saved.x}%`
  annotation.style.top = `${saved.y}%`
  annotation.style.right = 'auto'
  annotation.style.bottom = 'auto'
  annotation.style.transform = `rotate(${saved.rotation || 0}deg)`
}

function bindAnnotationDrag(annotation, page, onFinish) {
  if (annotation.dataset.dragBound === 'true') return
  annotation.dataset.dragBound = 'true'
  annotation.setAttribute('role', 'note')
  annotation.setAttribute('tabindex', '0')
  annotation.addEventListener('mousedown', e => e.stopPropagation())
  annotation.addEventListener('touchstart', e => e.stopPropagation(), { passive: true })
  annotation.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return
    // Don't start drag if clicking delete button or editing text
    if (event.target.classList.contains('annotation-delete-btn')) return
    if (annotation.classList.contains('user-annotation') && document.activeElement === annotation) return
    event.preventDefault()
    event.stopPropagation()
    const pageEl = page || annotation.closest('.page')
    if (!pageEl) return
    const pageRect = pageEl.getBoundingClientRect()
    const noteRect = annotation.getBoundingClientRect()
    const offsetX = event.clientX - noteRect.left
    const offsetY = event.clientY - noteRect.top
    const rotation = Number((annotation.style.transform.match(/rotate\((-?[\d.]+)/) || [])[1] || 0)
    annotation.classList.add('is-dragging')
    annotation.setPointerCapture?.(event.pointerId)

    const move = moveEvent => {
      const w = annotation.offsetWidth
      const h = annotation.offsetHeight
      const left = Math.min(pageRect.width - w - 8, Math.max(8, moveEvent.clientX - pageRect.left - offsetX))
      const top  = Math.min(pageRect.height - h - 44, Math.max(8, moveEvent.clientY - pageRect.top - offsetY))
      annotation.style.left = `${left}px`
      annotation.style.top  = `${top}px`
      annotation.style.right = 'auto'
      annotation.style.bottom = 'auto'
      annotation.style.transform = `rotate(${rotation}deg)`
    }

    const finish = () => {
      annotation.classList.remove('is-dragging')
      annotation.removeEventListener('pointermove', move)
      annotation.removeEventListener('pointerup', finish)
      annotation.removeEventListener('pointercancel', finish)
      const left = parseFloat(annotation.style.left) || 0
      const top  = parseFloat(annotation.style.top)  || 0
      onFinish?.(left / pageRect.width, top / pageRect.height, rotation)
    }
    annotation.addEventListener('pointermove', move)
    annotation.addEventListener('pointerup', finish)
    annotation.addEventListener('pointercancel', finish)
  })
}

function initAnnotationDragging() {
  // Editorial annotations (handwritten + heirloom notes, all pages)
  document.querySelectorAll(
    '.handwritten-annotation:not(.user-annotation), .heirloom-note, .heirloom-crossout'
  ).forEach(annotation => {
    restoreAnnotationPosition(annotation)
    const page = annotation.closest('.page')
    bindAnnotationDrag(annotation, page, (xRatio, yRatio, rotation) => {
      const positions = annotationPositions()
      positions[annotationStorageKey(annotation)] = {
        x: Number((xRatio * 100).toFixed(3)),
        y: Number((yRatio * 100).toFixed(3)),
        rotation,
      }
      localStorage.setItem(ANNOTATION_POSITIONS_KEY, JSON.stringify(positions))
    })
  })

}

function createUserAnnotationEl(data, page) {
  const el = document.createElement('div')
  el.className = 'handwritten-annotation user-annotation'
  el.id = data.id
  el.contentEditable = 'true'
  el.textContent = data.text || ''
  el.style.cssText = `left:${data.x}%;top:${data.y}%;right:auto;bottom:auto;transform:rotate(${data.rotation}deg)`

  const delBtn = document.createElement('button')
  delBtn.className = 'annotation-delete-btn'
  delBtn.textContent = '×'
  delBtn.setAttribute('aria-label', currentLang === 'en' ? 'Delete note' : 'Apagar nota')
  delBtn.addEventListener('click', e => {
    e.stopPropagation()
    el.remove()
    saveUserAnnotationsData(userAnnotationsData().filter(a => a.id !== data.id))
  })
  el.appendChild(delBtn)

  el.addEventListener('blur', () => {
    const clone = el.cloneNode(true)
    clone.querySelectorAll('button').forEach(b => b.remove())
    const text = clone.innerText.trim()
    const list = userAnnotationsData()
    const entry = list.find(a => a.id === data.id)
    if (entry) { entry.text = text; saveUserAnnotationsData(list) }
  })

  page.appendChild(el)

  bindAnnotationDrag(el, page, (xRatio, yRatio, rotation) => {
    const list = userAnnotationsData()
    const entry = list.find(a => a.id === data.id)
    if (entry) {
      entry.x = Number((xRatio * 100).toFixed(3))
      entry.y = Number((yRatio * 100).toFixed(3))
      entry.rotation = rotation
      saveUserAnnotationsData(list)
    }
  })
  return el
}

function restoreUserAnnotations() {
  userAnnotationsData().forEach(data => {
    const spread = BookState.layout.find(s => spreadKey(s) === data.spreadKey)
    if (!spread) return
    const page = spread.querySelector(data.pageClass === 'right' ? '.page-right' : '.page-left')
    if (!page || page.querySelector(`#${CSS.escape(data.id)}`)) return
    createUserAnnotationEl(data, page)
  })
}

function initAnnotationAdding() {
  document.querySelectorAll('.page').forEach(page => {
    if (page.dataset.annotAddBound) return
    page.dataset.annotAddBound = 'true'
    page.addEventListener('dblclick', e => {
      if (BookState.isAnimating || ['cover', 'backcover'].includes(BookState.phase)) return
      if (e.target.closest('button,input,[contenteditable],.curl-zone,.nav-edge-arrow,.recipe-card-border .ingredients-list,.steps-list')) return
      const spread = page.closest('.book-spread')
      if (!spread) return

      const pageRect = page.getBoundingClientRect()
      const rotation = (Math.random() - 0.5) * 7
      const x = Math.min(72, Math.max(5, ((e.clientX - pageRect.left) / pageRect.width) * 100))
      const y = Math.min(82, Math.max(5, ((e.clientY - pageRect.top) / pageRect.height) * 100))

      const data = {
        id: `ua-${Date.now()}`,
        spreadKey: spreadKey(spread),
        pageClass: page.classList.contains('page-right') ? 'right' : 'left',
        x, y, rotation, text: '',
      }
      const list = userAnnotationsData()
      list.push(data)
      saveUserAnnotationsData(list)

      const el = createUserAnnotationEl(data, page)
      requestAnimationFrame(() => el.focus())
    })
  })
}

// ── TOAST ──
function showToast(msg) {
  const t = document.createElement('div')
  t.textContent = msg
  t.style.cssText = `position:fixed;bottom:32px;left:50%;transform:translateX(-50%);
    background:rgba(30,15,8,.9);color:#FAF7F0;font-family:'Indie Flower',cursive;
    font-size:13px;padding:10px 20px;border-radius:2px;z-index:300;white-space:nowrap;pointer-events:none;`
  document.body.appendChild(t)
  gsap.fromTo(t, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3 })
  gsap.to(t, { opacity: 0, duration: 0.3, delay: 2.5, onComplete: () => t.remove() })
}

// ── ONBOARDING ──
function checkOnboarding() {
  if (localStorage.getItem('fp_onboarded')) return
  localStorage.setItem('fp_onboarded', '1')
  setTimeout(() => {
    const h = document.getElementById('onboarding-hint')
    if (!h) return
    h.style.display = 'flex'
    gsap.fromTo(h, { opacity: 0, y: 8 }, {
      opacity: 1, y: 0, duration: 0.5, ease: 'expo.out',
      onComplete: () => gsap.to(h, {
        opacity: 0, delay: 4, duration: 0.4,
        onComplete: () => h.style.display = 'none'
      })
    })
  }, 800)
}

// ── DRAG TO REORDER SAVED ──
function initDragReorder() {
  const items = document.querySelectorAll('.toc-saved-item')
  if (!items.length) return
  let srcId = null
  items.forEach(item => {
    if (item.dataset.dragBound === 'true') return
    item.dataset.dragBound = 'true'
    item.setAttribute('draggable', true)
    item.addEventListener('dragstart', () => { srcId = item.dataset.recipeId; item.style.opacity = '.5' })
    item.addEventListener('dragend', () => item.style.opacity = '1')
    item.addEventListener('dragover', e => { e.preventDefault(); item.style.background = 'rgba(176,125,42,.08)' })
    item.addEventListener('dragleave', () => item.style.background = '')
    item.addEventListener('drop', e => {
      e.preventDefault(); item.style.background = ''
      if (srcId === item.dataset.recipeId) return
      let saved = JSON.parse(localStorage.getItem('fp_saved_recipes') || '[]')
      const fi = saved.findIndex(s => s.id === srcId)
      const ti = saved.findIndex(s => s.id === item.dataset.recipeId)
      const [moved] = saved.splice(fi, 1); saved.splice(ti, 0, moved)
      localStorage.setItem('fp_saved_recipes', JSON.stringify(saved))
      rebuildSavedSpreads()
      rebuildBookLayout({ keepCurrent: true })
    })
  })
}

// ── PRINT ──
window.addEventListener('beforeprint', () => {
  document.querySelector(`[data-spread="${BookState.currentSpread}"]`)?.classList.add('is-active')
})
window.addEventListener('afterprint', () => {
  document.querySelectorAll('.book-spread').forEach(s => s.classList.remove('is-active'))
  const printRecipe = document.getElementById('print-recipe')
  if (printRecipe) {
    printRecipe.innerHTML = ''
    printRecipe.setAttribute('aria-hidden', 'true')
  }
})

// ── SETUP COLUMN DBLCLICK ──
document.addEventListener('dblclick', e => {
  const title = e.target.closest('.setup-col-title')
  if (!title) return
  const col = title.closest('.setup-col')
  if (!col) return
  const colId = col.dataset.setupCol
  const spread = col.closest('[data-role="setup"]')
  if (!spread) return
  const current = spread.dataset.setupMode
  spread.dataset.setupMode = current === colId ? 'all' : colId
})

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  // Restore saved recipes
  rebuildSavedSpreads()
  rebuildBookLayout()
  const saved = JSON.parse(localStorage.getItem('fp_saved_recipes') || '[]')
  if (saved.length) showSavedTab()
  /* badge removed */
  renderSearchHistory()

  // Restore favorites
  loadFavorites()

  // Init curl zones
  initCurlZones()

  // Show onboarding hint on cover before user clicks
  checkOnboarding()

  document.fonts?.ready.then(() => rebuildBookLayout({ keepCurrent: true }))
})

let layoutResizeTimer = null
window.addEventListener('resize', () => {
  clearTimeout(layoutResizeTimer)
  layoutResizeTimer = setTimeout(() => rebuildBookLayout({ keepCurrent: true }), 180)
})
