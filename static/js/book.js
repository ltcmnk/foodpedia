/* book.js — Foodpedia v3 */

const BookState = {
  currentSpread: 0,
  phase: 'cover',        // 'cover' | 'browsing' | 'loading' | 'result' | 'backcover'
  pendingRecipe: null,
  loadingQuery: null,
  animating: false,
  selectedModel: null,   // set after /api/models loads
};

// ── BUILD CHECKERBOARD ──
(function buildCheckerboard() {
  const cols = 12, rows = 16;
  ['checkerboard', 'backcover-checkerboard'].forEach(id => {
    const board = document.getElementById(id);
    if (!board) return;
    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    board.style.gridTemplateRows    = `repeat(${rows}, 1fr)`;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'cover-cell ' + ((r + c) % 2 === 0 ? 'red' : 'white');
        board.appendChild(cell);
      }
    }
  });
})();

// Livro fechado: capa frontal (metade direita do wrapper) centralizada no viewport
gsap.set('.book-wrapper', { x: '-25%' });

// ── REDUCED MOTION ──
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DUR = {
  coverOpen: reducedMotion ? 0.001 : 1.1,
  pageTurn:  reducedMotion ? 0.001 : 0.42,
  content:   reducedMotion ? 0.001 : 0.38,
};

// ── SHOW SPREAD (no animation, just swap) ──
function showSpread(index) {
  document.querySelectorAll('.book-spread').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('active');
  });
  const target = document.querySelector(`[data-spread="${index}"]`);
  if (target) {
    target.style.display = 'grid';
    target.classList.add('active');
  }
  BookState.currentSpread = index;
}

// ── ANIMATE TO SPREAD (curtain wipe — confiável, sem 3D glitch) ──
function animateToSpread(targetIndex) {
  return new Promise(resolve => {
    if (BookState.animating) { showSpread(targetIndex); resolve(); return; }
    if (targetIndex === BookState.currentSpread) { resolve(); return; }

    const currentEl = document.querySelector(`[data-spread="${BookState.currentSpread}"]`);
    const targetEl  = document.querySelector(`[data-spread="${targetIndex}"]`);
    if (!currentEl || !targetEl) { showSpread(targetIndex); resolve(); return; }

    BookState.animating = true;
    const forward = targetIndex > BookState.currentSpread;
    const curtain = document.getElementById('page-curtain');

    // Curtain começa colapsado: origin no lado de onde a página "vem"
    // Forward (→): curtain expande da direita para a esquerda
    // Backward (←): curtain expande da esquerda para a direita
    const originIn  = forward ? 'right center' : 'left center';
    const originOut = forward ? 'left center'  : 'right center';

    curtain.classList.toggle('forward',  forward);
    curtain.classList.toggle('backward', !forward);
    gsap.set(curtain, { scaleX: 0, transformOrigin: originIn });

    const tl = gsap.timeline({
      onComplete: () => {
        currentEl.style.display = 'none';
        currentEl.classList.remove('active');
        targetEl.classList.add('active');
        gsap.set(curtain, { scaleX: 0 });
        BookState.currentSpread = targetIndex;
        BookState.animating = false;
        resolve();
      }
    });

    // Fase 1 — curtain cobre o spread atual (varre da borda livre até a lombada)
    tl.to(curtain, {
      scaleX: 1,
      transformOrigin: originIn,
      duration: DUR.pageTurn,
      ease: 'power2.in',
    });

    // Troca de conteúdo exatamente no ponto de máxima cobertura
    tl.add(() => {
      gsap.set(currentEl, { display: 'none' });
      gsap.set(targetEl,  { display: 'grid' });
      targetEl.classList.add('active');
    });

    // Fase 2 — curtain descobre o spread destino (sai pelo lado oposto)
    tl.to(curtain, {
      scaleX: 0,
      transformOrigin: originOut,
      duration: DUR.pageTurn,
      ease: 'power2.out',
    });
  });
}

// ── ANIMATE CONTENT IN ──
function animateContentIn(spreadIndex) {
  const idx = spreadIndex !== undefined ? spreadIndex : BookState.currentSpread;
  const spread = document.querySelector(`[data-spread="${idx}"]`);
  if (!spread) return;
  const items = spread.querySelectorAll('[data-stagger]');
  gsap.fromTo(items,
    { opacity: 0, y: 8 },
    { opacity: 1, y: 0, duration: DUR.content, ease: 'expo.out',
      stagger: { amount: 0.55, from: 'start' } }
  );
}

// ── COVER OPEN ──
function animateCoverOpen() {
  if (BookState.phase !== 'cover') return;
  BookState.phase = 'browsing';

  const cover = document.getElementById('book-cover');
  const pages = document.getElementById('book-pages');

  gsap.set(pages, { display: 'block', opacity: 0 });
  showSpread(1);

  const tl = gsap.timeline({
    onComplete: () => {
      gsap.set(cover, { display: 'none' });
      animateContentIn(1);
      updateCornerVisibility();
    }
  });

  tl.to(cover, {
    rotationY: -175,
    duration: DUR.coverOpen,
    ease: 'power4.out',
    transformOrigin: 'left center',
    transformPerspective: 2500,
  });
  tl.to('.book-wrapper', { x: '0%', duration: DUR.coverOpen, ease: 'power4.out' }, 0);
  tl.to(pages, { opacity: 1, duration: 0.45, ease: 'power2.out' }, 0.65);
  tl.to('.opening-shadow', {
    scaleX: 0, transformOrigin: 'right center',
    duration: 0.8, ease: 'power2.inOut'
  }, 0.3);
}

// ── VOLTAR À CAPA ──
function goToCover() {
  if (BookState.phase === 'cover' || BookState.animating) return;
  BookState.phase = 'cover';

  const cover = document.getElementById('book-cover');
  const pages = document.getElementById('book-pages');

  // Posiciona a capa já "aberta" (rotacionada) para depois fechar
  gsap.set(cover, {
    display: 'block',
    rotationY: -175,
    transformOrigin: 'left center',
    transformPerspective: 2500,
  });

  document.getElementById('corner-next')?.classList.remove('active', 'ready');
  document.getElementById('corner-prev')?.classList.remove('active');

  const tl = gsap.timeline({
    onComplete: () => {
      gsap.set(pages, { display: 'none', opacity: 1 });
      gsap.set(cover, { clearProps: 'rotationY' });
      gsap.set('.opening-shadow', { scaleX: 1 });
      BookState.currentSpread = 0;
    }
  });

  tl.to(pages, { opacity: 0, duration: 0.25, ease: 'power2.in' });
  tl.to(cover, {
    rotationY: 0,
    duration: DUR.coverOpen * 0.85,
    ease: 'power4.out',
    transformOrigin: 'left center',
    transformPerspective: 2500,
  }, 0.1);
  tl.to('.book-wrapper', { x: '-25%', duration: DUR.coverOpen * 0.85, ease: 'power4.out' }, 0.1);
}

// ── CAPA TRASEIRA — aparece ao "virar a última página" ──
function goToBackCover() {
  if (BookState.animating) return;
  BookState.phase = 'backcover';

  const pages = document.getElementById('book-pages');
  const backcover = document.getElementById('book-backcover');

  gsap.set(backcover, { display: 'block', opacity: 0 });
  document.getElementById('corner-next')?.classList.remove('active', 'ready');
  document.getElementById('corner-prev')?.classList.remove('active');

  const tl = gsap.timeline({
    onComplete: () => {
      gsap.set(pages, { display: 'none', opacity: 1 });
    }
  });

  tl.to(pages, { opacity: 0, duration: 0.3, ease: 'power2.in' });
  tl.to('.book-wrapper', { x: '25%', duration: DUR.coverOpen, ease: 'power4.out' }, 0);
  tl.to(backcover, { opacity: 1, duration: 0.55, ease: 'power2.out' }, 0.35);
}

// Clique na capa traseira → vira o livro de volta, capa frontal centraliza
function goBackCoverToFront() {
  if (BookState.phase !== 'backcover' || BookState.animating) return;
  BookState.phase = 'cover';

  const backcover = document.getElementById('book-backcover');
  const cover = document.getElementById('book-cover');
  gsap.set(cover, { display: 'block', rotationY: 0, transformOrigin: 'left center', transformPerspective: 2500 });

  const tl = gsap.timeline({
    onComplete: () => {
      gsap.set(backcover, { display: 'none' });
      BookState.currentSpread = 0;
    }
  });

  tl.to(backcover, { opacity: 0, duration: 0.4, ease: 'power2.in' });
  tl.to('.book-wrapper', { x: '-25%', duration: DUR.coverOpen * 0.85, ease: 'power4.out' }, 0);
}

// ── COVER HOVER 3D ──
const cover = document.getElementById('book-cover');
if (cover) {
  cover.addEventListener('mousemove', e => {
    const { left, top, width, height } = cover.getBoundingClientRect();
    const rx = ((e.clientY - top  - height / 2) / (height / 2)) * -3;
    const ry = ((e.clientX - left - width  / 2) / (width  / 2)) * 2;
    gsap.to(cover, { rotationX: rx, rotationY: ry,
      transformPerspective: 2000, duration: 0.6, ease: 'power2.out' });
  });
  cover.addEventListener('mouseleave', () => {
    gsap.to(cover, { rotationX: 0, rotationY: 0,
      duration: 0.8, ease: 'power4.out' });
  });
  cover.addEventListener('click', animateCoverOpen);
}

document.getElementById('book-backcover')?.addEventListener('click', goBackCoverToFront);

// ── TOC NAVIGATION ──
document.querySelectorAll('[data-goto]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const target = parseInt(link.dataset.goto);
    animateToSpread(target).then(() => {
      animateContentIn(target);
      updateCornerVisibility();
    });
  });
});

// Voltar à capa pelo sumário
document.getElementById('toc-capa-link')?.addEventListener('click', e => {
  e.preventDefault();
  goToCover();
});

// Ribbon → sumário (spread 3)
document.getElementById('ribbon-pages')?.addEventListener('click', () => {
  if (BookState.phase === 'cover' || BookState.animating) return;
  animateToSpread(3).then(() => {
    animateContentIn(3);
    updateCornerVisibility();
  });
});

// ── LOADING MODE ──
function activateManualLoadingMode() {
  document.getElementById('corner-next').classList.add('active');
  document.getElementById('corner-prev').classList.add('active');
}

function deactivateManualLoadingMode() {
  const cn = document.getElementById('corner-next');
  const cp = document.getElementById('corner-prev');
  cn.classList.remove('active', 'ready');
  cp.classList.remove('active');
}

function notifyRecipeReady() {
  // Animate the persistent ribbon (inside #book-pages, always visible when open)
  gsap.to('#ribbon-pages', {
    opacity: 0.25, duration: 0.45, repeat: 7, yoyo: true, ease: 'power1.inOut',
    onComplete: () => gsap.set('#ribbon-pages', { opacity: 1 })
  });
  document.getElementById('corner-next').classList.add('ready');
}

// ── MANUAL TURN DURING LOADING ──
function handleManualTurn(direction) {
  if (BookState.phase === 'cover') return;
  if (BookState.phase === 'loading') {
    // Recipe ready + going forward → show result immediately
    if (BookState.pendingRecipe && direction === 'next') {
      showRecipeResult(BookState.pendingRecipe);
      return;
    }
    // Free navigation through all spreads while waiting
  }

  // Normal browsing (also used as fallthrough during loading for free navigation)
  if (BookState.phase === 'browsing' || BookState.phase === 'result' || BookState.phase === 'loading') {
    const current = BookState.currentSpread;
    // During loading, cap at 15; during browsing/result, pressing next past last spread → back cover
    const max = BookState.phase === 'loading' ? 15 : 16;
    const min = 1;
    if (direction === 'next') {
      if (current < max) {
        animateToSpread(current + 1).then(() => {
          animateContentIn(current + 1);
          updateCornerVisibility();
        });
      } else if (BookState.phase !== 'loading') {
        goToBackCover();
      }
    } else if (direction === 'prev' && current > min) {
      animateToSpread(current - 1).then(() => {
        animateContentIn(current - 1);
        updateCornerVisibility();
      });
    }
  }
}

// Setas sempre visíveis quando o livro está aberto
function updateCornerVisibility() {
  const cn = document.getElementById('corner-next');
  const cp = document.getElementById('corner-prev');
  if (!cn || !cp) return;
  if (BookState.phase === 'cover' || BookState.phase === 'backcover') {
    cn.classList.remove('active', 'ready');
    cp.classList.remove('active');
    return;
  }
  // During loading, cap next at spread 15 (result only shows when recipe ready)
  // During browsing/result, next is always active — at the last spread leads to back cover
  const maxSpread = BookState.phase === 'loading' ? 15 : Infinity;
  cp.classList.toggle('active', BookState.currentSpread > 1);
  cn.classList.toggle('active', BookState.currentSpread < maxSpread);
}

// ── SVG MAP FOR RESULT ILLUSTRATIONS ──
const illustrationSVG = {
  herbs: `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"><path d="M40,115 C40,90 38,70 42,40 C44,25 40,10 40,10"/><path d="M38,85 C28,78 22,65 30,58 C35,55 40,62 38,85"/><path d="M42,75 C52,68 58,55 50,48 C45,45 40,52 42,75"/><path d="M39,55 C29,48 24,36 32,30 C37,27 41,34 39,55"/><path d="M41,45 C51,38 56,26 48,20 C43,17 40,24 41,45"/><circle cx="40" cy="10" r="3"/><path d="M37,10 C34,6 36,2 40,4"/><path d="M43,10 C46,6 44,2 40,4"/></svg>`,
  grain: `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"><path d="M40,115 L40,30"/><path d="M40,40 C36,34 33,26 36,20 C38,16 42,18 40,40"/><path d="M40,52 C44,46 47,38 44,32 C42,28 38,30 40,52"/><path d="M40,64 C36,58 33,50 36,44 C38,40 42,42 40,64"/><path d="M40,76 C44,70 47,62 44,56 C42,52 38,54 40,76"/><path d="M40,88 C36,82 33,74 36,68 C38,64 42,66 40,88"/></svg>`,
  bowl: `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="40" cy="60" rx="30" ry="8"/><path d="M10,60 Q10,90 40,92 Q70,90 70,60"/><line x1="20" y1="60" x2="60" y2="60"/><path d="M40,33 L40,20"/><path d="M34,22 C36,18 40,16 40,20"/><path d="M46,22 C44,18 40,16 40,20"/></svg>`,
  vanilla: `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"><path d="M40,110 C40,80 38,60 40,30"/><path d="M40,110 C42,80 44,60 40,30"/><circle cx="40" cy="10" r="1.5"/><path d="M32,25 C34,15 40,10 40,10 C40,10 46,15 48,25"/><path d="M32,25 C30,30 32,35 40,36 C48,35 50,30 48,25"/></svg>`,
  citrus: `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="40" cy="65" rx="28" cy="65"/><circle cx="40" cy="65" r="28"/><ellipse cx="40" cy="65" rx="20" ry="28"/><line x1="40" y1="37" x2="40" y2="93"/><line x1="12" y1="65" x2="68" y2="65"/></svg>`,
  spice: `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"><path d="M28,115 L28,40 C28,35 32,30 36,28 C40,26 40,20 40,15"/><circle cx="40" cy="15" r="4"/><path d="M52,70 C52,50 55,35 58,20"/><ellipse cx="55" cy="20" rx="5" ry="8" transform="rotate(-10,55,20)"/></svg>`,
  mortar: `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--c-gold)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20,85 Q18,100 40,102 Q62,100 60,85 L55,60 Q50,55 40,55 Q30,55 25,60 Z"/><path d="M15,60 L65,60"/><path d="M55,40 L55,60"/><ellipse cx="55" cy="38" rx="4" ry="8" transform="rotate(10,55,38)"/></svg>`,
};

// ── POPULATE RESULT SPREAD ──
function populateResultSpread(recipe) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || ''; };
  set('res-category', recipe.category);
  set('res-name', recipe.name);
  set('res-subtitle', recipe.subtitle);
  set('res-prep', recipe.prep_time);
  set('res-servings', recipe.servings);
  set('res-difficulty', recipe.difficulty);
  set('res-story', recipe.story);
  set('res-tip', recipe.tip);
  set('res-annotation', recipe.annotation || '');

  const ingEl = document.getElementById('res-ingredients');
  if (ingEl && recipe.ingredients) {
    ingEl.innerHTML = recipe.ingredients
      .map(i => `<li>${i}</li>`).join('');
  }

  const stepsEl = document.getElementById('res-steps');
  if (stepsEl && recipe.steps) {
    stepsEl.innerHTML = recipe.steps
      .map((s, i) => `<li><span class="step-number">${i+1}</span><span class="step-text">${s}</span></li>`)
      .join('');
  }

  const illEl = document.getElementById('res-illustration');
  if (illEl) {
    const key = recipe.illustration_key || 'mortar';
    illEl.innerHTML = illustrationSVG[key] || illustrationSVG.mortar;
  }
}

// ── MODEL SELECTOR ──
async function loadModels() {
  try {
    const res = await fetch('/api/models');
    const data = await res.json();
    const models = data.models || [];
    const list = document.getElementById('model-list');
    if (!list) return;

    if (models.length === 0) {
      list.innerHTML = '<li class="model-option loading-models">nenhum modelo encontrado</li>';
      return;
    }

    // Default: first model
    if (!BookState.selectedModel) BookState.selectedModel = models[0];

    list.innerHTML = models.map(m => `
      <li class="model-option${m === BookState.selectedModel ? ' selected' : ''}"
          data-model="${m}">${m}</li>
    `).join('');

    list.querySelectorAll('.model-option').forEach(el => {
      el.addEventListener('click', () => {
        BookState.selectedModel = el.dataset.model;
        list.querySelectorAll('.model-option').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
      });
    });
  } catch (e) {
    console.warn('Não foi possível listar modelos:', e);
    const list = document.getElementById('model-list');
    if (list) list.innerHTML = '<li class="model-option loading-models">ollama offline</li>';
  }
}

// Load models as soon as the page loads (non-blocking)
loadModels();

// ── FETCH RECIPE FROM OLLAMA ──
async function fetchRecipeFromOllama(query) {
  const body = { dish: query };
  if (BookState.selectedModel) body.model = BookState.selectedModel;
  const res = await fetch('/api/recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Erro na consulta');
  return await res.json();
}

// ── SHOW RECIPE RESULT ──
function showRecipeResult(recipe) {
  BookState.phase = 'result';
  deactivateManualLoadingMode();
  populateResultSpread(recipe);
  animateToSpread(16).then(() => {
    const spread = document.querySelector('[data-spread="16"]');
    if (!spread) return;
    const items = spread.querySelectorAll('[data-stagger]');
    gsap.fromTo(items,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: DUR.content, ease: 'expo.out',
        stagger: { amount: 0.5, from: 'start' } }
    );
    updateCornerVisibility();
  });
}

// ── START RECIPE SEARCH ──
async function startRecipeSearch(query) {
  if (BookState.phase === 'loading') return;
  BookState.phase = 'loading';
  BookState.loadingQuery = query;
  BookState.pendingRecipe = null;

  await animateToSpread(6);
  animateContentIn(5);
  activateManualLoadingMode();

  try {
    const recipe = await fetchRecipeFromOllama(query);
    BookState.pendingRecipe = recipe;
    notifyRecipeReady();
  } catch (err) {
    console.error('Erro ao buscar receita:', err);
    BookState.phase = 'browsing';
    deactivateManualLoadingMode();
    alert('Não foi possível consultar a receita. Verifique se o Ollama está rodando.');
  }
}

// ── SEARCH INPUT ──
const searchInput = document.getElementById('recipe-search');
if (searchInput) {
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      startRecipeSearch(e.target.value.trim());
    }
  });
}

// ── KEYBOARD NAVIGATION ──
document.addEventListener('keydown', e => {
  if (BookState.phase === 'cover') return;
  if (document.activeElement === searchInput) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    handleManualTurn('next');
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    handleManualTurn('prev');
  }
});
