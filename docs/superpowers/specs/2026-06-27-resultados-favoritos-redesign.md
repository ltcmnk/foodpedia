# Resultados & Favoritos — Design Spec

**Data:** 2026-06-27
**Status:** Aprovado

---

## Escopo

Redesenho do modelo de receitas geradas por IA no Foodpedia: a seção "Salvas" torna-se "Resultados" (efêmera por sessão), a persistência passa a ser controlada exclusivamente pelo ◆ (fita vermelha), e receitas favoritadas sobrevivem ao refresh na aba Favoritos e no Sumário.

Sem mudanças no backend.

---

## Contexto

**Modelo atual:**
- Busca → spread `data-role="result"` (único, sobrescreve a cada busca)
- Botão "Salvar no livro" → spread `data-role="saved"` em `#saved-spreads-container`, persiste em `fp_saved_recipes`
- ◆ → marca chaves em `fp_favorites` (sem salvar objeto completo)

**Modelo novo:**
- Busca → spread `data-role="resultado"` em `#resultado-container` (efêmero, por sessão)
- ◆ → único mecanismo de persistência; salva objeto completo e cria spread em `#favoritos-container`
- `data-role="result"` e o botão "Salvar no livro" são removidos

---

## 1. Modelo de Dados

### localStorage

| Chave | Antes | Depois |
|-------|-------|--------|
| `fp_saved_recipes` | Array de objetos de receita | **Removido** |
| `fp_favorites` | Array de chaves de spread | Mantido; passa a incluir chaves `favresult:<id>` |
| `fp_favorited_recipes` | — | **Novo:** array de `{ id, recipe, lang }` para receitas AI persistidas |

### BookState

Nenhum campo novo. A lógica de quem popula os containers muda, não a estrutura do estado.

### Containers no DOM

| Container | Antes | Depois |
|-----------|-------|--------|
| `#saved-spreads-container` | Receitas salvas (persistidas) | Renomeado para `#resultado-container`; spreads efêmeros `data-role="resultado"` |
| `#favoritos-container` | — | **Novo:** spreads persistidos `data-role="favorited-result"`, recriados do localStorage no load |
| `#result-continuation-container` | Overflow do result spread | **Removido** (já removido no plano Vercel) |

---

## 2. Fluxo de Busca

1. Usuário digita prato → loading comporta-se **igual ao atual** (livro vira para receitas clássicas enquanto a IA pensa)
2. Receita chega → spread `data-role="resultado"` criado em `#resultado-container` com ID único (`resultado-<timestamp>`)
3. Aba "Resultado" pulsa com classe `is-ready`
4. Entrada efêmera adicionada ao Sumário (marcada visualmente como temporária — ex: cor levemente diferente da receitas base)
5. Toast: *"Receita pronta! Clique em Resultado para ver."*
6. **Micro-hint:** no primeiro spread de resultado da sessão, exibe uma vez — *"◆ para guardar entre sessões"* — e some em 3s via GSAP fade-out

**Clique na aba "Resultado":**
- Com `is-ready` ativo → navega direto para o spread recém-criado; `is-ready` é removido ao chegar no spread
- Sem `is-ready` → navega para `data-role="resultado-toc"`: mini-sumário de sessão com uma entrada por receita buscada (nome + subtítulo), em ordem cronológica, clicáveis para navegar ao spread correspondente. O `resultado-toc` é um spread gerado dinamicamente com o mesmo estilo tipográfico do TOC principal, título "Pesquisadas".

**Aba "Resultado"** aparece quando `#resultado-container` tem ao menos um spread; some quando está vazio.

---

## 3. Favoritar e Persistência

### ◆ em spread de resultado (sessão)

1. Objeto da receita salvo em `fp_favorited_recipes`: `{ id: "resultado-<timestamp>", recipe: {...}, lang: "pt" | "en" }`
2. Chave `favresult:<id>` adicionada a `fp_favorites`
3. Spread `data-role="favorited-result"` criado imediatamente em `#favoritos-container` com o mesmo conteúdo
4. ◆ renderizado como ativo em ambos os spreads (resultado e favorited-result) enquanto a sessão dura

### ◆ novamente (desfavoritar)

1. Remove entrada de `fp_favorited_recipes`
2. Remove chave de `fp_favorites`
3. Remove spread de `#favoritos-container`
4. Spread de sessão em `#resultado-container` permanece intacto

### ◆ em receita clássica (base)

Comportamento atual preservado: apenas a chave do spread vai para `fp_favorites`, sem objeto completo (o spread já existe permanentemente no livro).

---

## 4. Comportamento após refresh

| O que acontece | Resultado |
|---------------|-----------|
| `#resultado-container` | Vazio — aba "Resultado" some |
| `fp_favorited_recipes` | Lido → spreads recriados em `#favoritos-container` |
| Aba "Favoritos" | Visível com as receitas AI persistidas |
| Sumário | Receitas base + receitas AI favoritadas |
| ◆ ativo | Nos spreads `favorited-result` recriados |

---

## 5. Sumário (TOC)

### Durante a sessão

- **Receitas base:** sempre presentes (sem mudança)
- **Resultados de sessão:** entradas efêmeras em `#resultado-container`; estilo visual diferenciado (ex: itálico ou cor levemente mais clara) para indicar que são temporárias
- **Receitas favoritadas:** entradas persistidas com ◆, vindas de `#favoritos-container`

### Após refresh

- Receitas base + receitas AI favoritadas (de `fp_favorited_recipes`)
- Entradas de sessão: desapareceram junto com os spreads

---

## 6. Spread de Favoritos

O spread `data-role="favorites-toc"` (planejado em `book-ui-enhancements`) é extendido:

- Lista receitas base favoritadas (por chave, navegando para o spread base existente)
- Lista receitas AI favoritadas (chave `favresult:<id>`, navegando para o spread `data-role="favorited-result"` correspondente)
- `buildFavoritesTocSpread()` deve incluir os spreads de `#favoritos-container` além das chaves base

**Dependência:** este spec depende da Feature 4 do spec `book-ui-enhancements-design.md` (Favorites as Second Table of Contents).

---

## 7. O que é removido

| Item | Arquivo |
|------|---------|
| `data-role="result"` spread | `templates/index.html` |
| `#result-continuation-container` | `templates/index.html` (já removido no plano Vercel) |
| Botão "Salvar no livro" | `templates/index.html` |
| `populateResultSpread()` | `static/js/book.js` |
| `showRecipeResult()` | `static/js/book.js` (substituído por lógica de criação de spread) |
| `saveCurrentRecipe()` | `static/js/book.js` |
| `rebuildSavedSpreads()` | `static/js/book.js` (substituído) |
| `MAX_SAVED` | `static/js/book.js` |
| `SPREAD_RESULT` | `static/js/book.js` |
| `fp_saved_recipes` | localStorage |
| CSS de `.result-*`, `#result-left`, `#result-right` | `static/css/book.css` |

---

## 8. Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `templates/index.html` | Remover spread `result`, botão salvar; adicionar `#resultado-container`, `#favoritos-container` |
| `static/js/book.js` | Nova lógica de criação de spreads, persistência via ◆, mini-TOC de sessão, rebuild do Favoritos TOC |
| `static/css/book.css` | Estilos para `data-role="resultado"`, `data-role="favorited-result"`, `data-role="resultado-toc"`, micro-hint |

Sem mudanças no backend.

---

## Fora do escopo

- Tradução de receitas de resultado (se implementada, segue o mesmo fluxo via `translateCurrentRecipe` adaptado para o spread ativo)
- Limite de resultados por sessão (sem limite imposto)
- Exportação / impressão de receitas de resultado
