# Donation Spread — Design Spec

**Date:** 2026-06-28
**Feature:** Spread de apoio ao projeto (colofão + selos Ko-fi / Livepix)

---

## Overview

Adicionar uma spread estática ao final do livro onde o usuário pode conhecer a origem do projeto e apoiá-lo via Ko-fi (internacional) ou Livepix (brasileiro). A spread usa o estilo de colofão editorial — o encerramento natural de um livro físico — integrada ao sumário e acessível por navegação sequencial.

---

## Arquitetura

### Posição no layout

A spread tem `data-role="apoio"` e é declarada **no HTML estático** (`templates/index.html`), imediatamente após o loop `{% for recipe in base_recipes %}` e antes dos containers dinâmicos (`#resultado-container`, `#favoritos-container`).

No `rebuildBookLayout()` em `book.js`:
- Selecionada via `document.querySelector('[data-role="apoio"]')`
- Inserida no array `layout` entre `...recipes` e `...conditional`
- Uma variável `SPREAD_APOIO` armazena seu índice, atualizada após o layout rebuild

### Navegação

- **Sequencial:** navegando → no final das receitas base, o usuário chega à spread de apoio; mais uma vez → vai para o back cover.
- **Sumário:** entrada especial no TOC com separador visual, link clicável para a spread.
- **Sem aba de divider** — não polui a barra lateral.

---

## Página Esquerda — Colofão

### Estrutura HTML

```html
<div class="page page-left about-page">
  <div class="curl-zone curl-left">...</div>

  <span class="about-eyebrow" data-stagger data-i18n="apoio_eyebrow">
    uma palavra do autor
  </span>

  <h2 class="about-heading" data-stagger data-i18n-html="apoio_heading">
    Feito com<br>curiosidade<br>e código.
  </h2>

  <div class="recipe-header-rule" data-stagger></div>

  <div class="about-body" data-stagger style="font-size:11.5px;line-height:1.58;">
    <p data-i18n="apoio_p1">O Foodpedia é um projeto independente...</p>
    <p data-i18n="apoio_p2">Se ele te trouxe uma receita nova...</p>
    <p data-i18n="apoio_p3">Qualquer contribuição ajuda...</p>
  </div>

  <div class="handwritten-annotation annotation-1" data-stagger
       data-i18n="apoio_annotation">
    obrigado<br>por estar aqui
  </div>

  <div class="page-footer">
    <span class="footer-brand">Foodpedia</span>
    <span class="page-number"></span>
  </div>
</div>
```

### Tipografia

| Elemento | Fonte | Tamanho | Cor |
|---|---|---|---|
| eyebrow | Cedarville Cursive | 9px uppercase | `c-red-accent` |
| heading | Homemade Apple | ~22px | `c-ink` |
| body | Indie Flower | 11.5px | `c-ink` |
| anotação manuscrita | Grape Nuts | 13px | `c-annotation` |

### Textos i18n

| Chave | PT | EN |
|---|---|---|
| `apoio_eyebrow` | uma palavra do autor | a word from the author |
| `apoio_heading` | Feito com\<br\>curiosidade\<br\>e código. | Made with\<br\>curiosity\<br\>and code. |
| `apoio_p1` | O Foodpedia é um projeto independente — sem investidores, sem anúncios, feito por uma pessoa só. | Foodpedia is an independent project — no investors, no ads, built by one person. |
| `apoio_p2` | Se ele te trouxe uma receita nova, uma história inesperada ou simplesmente um momento de curiosidade, considere apoiar. | If it brought you a new recipe, an unexpected story, or just a moment of curiosity, consider supporting it. |
| `apoio_p3` | Qualquer contribuição ajuda a manter o servidor ligado e o código evoluindo. | Any contribution helps keep the server running and the code evolving. |
| `apoio_annotation` | obrigado\npor estar aqui | thank you\nfor being here |

---

## Página Direita — Selos de Doação

### Estrutura HTML

```html
<div class="page page-right about-page">
  <div class="curl-zone curl-right">...</div>

  <div class="apoio-stamps-container" data-stagger>

    <!-- Selo Ko-fi -->
    <a href="https://ko-fi.com/ltcmnk" target="_blank" rel="noopener"
       class="apoio-stamp">
      <div class="apoio-stamp-stripe apoio-stamp-stripe--kofi"></div>
      <div class="apoio-stamp-body">
        <div class="apoio-stamp-icon"><!-- SVG xícara --></div>
        <span class="apoio-stamp-platform">Ko-fi</span>
        <span class="apoio-stamp-url">ko-fi.com/ltcmnk</span>
      </div>
    </a>

    <p class="apoio-ornament" aria-hidden="true">✦</p>

    <!-- Selo Livepix -->
    <a href="https://livepix.gg/ltcmnk" target="_blank" rel="noopener"
       class="apoio-stamp">
      <div class="apoio-stamp-stripe apoio-stamp-stripe--livepix"></div>
      <div class="apoio-stamp-body">
        <div class="apoio-stamp-icon"><!-- SVG estrela/pix --></div>
        <span class="apoio-stamp-platform">Livepix</span>
        <span class="apoio-stamp-url">livepix.gg/ltcmnk</span>
        <span class="apoio-stamp-note" data-i18n="apoio_livepix_note">
          para brasileiros
        </span>
      </div>
    </a>

  </div>

  <div class="page-footer">
    <span class="footer-brand">Foodpedia</span>
    <span class="page-number"></span>
  </div>
</div>
```

### Estilo dos selos (`.apoio-stamp`)

```css
.apoio-stamp {
  display: block;
  border: 1.5px solid var(--c-border);
  position: relative;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: transform 120ms ease-out;
}
/* Borda interna dupla (padrão recipe-card-border) */
.apoio-stamp::before { inset: 4px; border: 0.75px; opacity: 0.5; }
.apoio-stamp::after  { inset: 7px; border: 0.5px;  opacity: 0.28; }

.apoio-stamp:hover { transform: rotate(-0.5deg) scale(1.01); }

/* Faixas coloridas */
.apoio-stamp-stripe          { height: 9px; }
.apoio-stamp-stripe--kofi    { background: #FF5E5B; }
.apoio-stamp-stripe--livepix { background: var(--c-cover-red); }

/* Separador linha dourada abaixo da faixa (como cover-badge) */
.apoio-stamp-stripe::after {
  content: '';
  display: block;
  height: 1.5px;
  background: var(--c-gold);
  opacity: 0.4;
}
```

### Tipografia dos selos

| Elemento | Fonte | Tamanho |
|---|---|---|
| `.apoio-stamp-platform` | Homemade Apple | 18px |
| `.apoio-stamp-url` | Cedarville Cursive | 10px, letter-spacing 1px |
| `.apoio-stamp-note` | La Belle Aurore | 11px, italic |
| `.apoio-ornament` | Cedarville Cursive | 11px, opacity 0.4 |

### Ícones SVG

Ícones simples com `stroke: var(--c-gold)`, `stroke-width: 0.8`, `stroke-linecap: round`, sem fill — mesmo padrão das ilustrações botânicas.

- **Ko-fi:** xícara de café com haste e asa (`viewBox="0 0 24 24"`)
- **Livepix:** estrela de cinco pontas com traço interno (`viewBox="0 0 24 24"`)

### Textos i18n adicionais

| Chave | PT | EN |
|---|---|---|
| `apoio_livepix_note` | para brasileiros | for Brazilian supporters |

---

## Integração no Sumário

O sumário é gerado dinamicamente por `renderTOCSpreads()`, que constrói as entradas de receitas como `<li>` dentro de um `<ul class="toc-entries">`. A entrada de apoio é adicionada como último item nessa lista — ou seja, dentro do HTML gerado pela função, não como um spread separado.

Após as entradas das receitas base e antes de fechar a lista:

```html
<li class="toc-apoio-separator"></li>
<li data-stagger>
  <a class="toc-entry toc-apoio-entry" href="#" data-target-key="apoio">
    <span class="toc-favorite-mark" aria-hidden="true">◆</span>
    <span class="toc-entry-title" data-i18n="toc_apoio">Apoiar o Projeto</span>
    <span class="toc-dots"></span>
    <span class="toc-page" data-toc-page></span>
  </a>
</li>
```

```css
.toc-apoio-separator {
  border-top: 0.75px solid var(--c-rule);
  margin: 6px 0;
  list-style: none;
}
.toc-apoio-entry .toc-entry-title { color: var(--c-ink-faded); }
.toc-apoio-entry .toc-favorite-mark { color: var(--c-gold); opacity: 0.7; }
```

i18n: `toc_apoio` → PT: `"Apoiar o Projeto"` / EN: `"Support the Project"`

---

## Arquivo i18n

Todas as chaves acima são adicionadas a `static/data/i18n.json` nas seções `pt` e `en`.

---

## O que NÃO está no escopo

- Integração com API de doações (tracking de cliques, webhook, etc.)
- Autenticação ou processamento de pagamento
- Analytics de conversão
- Aba de divider para a spread
