# Vercel Deploy UX — Design Spec

**Data:** 2026-06-27  
**Escopo:** Preparação do Foodpedia para deploy público no Vercel com chave Gemini do visitante

---

## Contexto

O Foodpedia está sendo preparado para deploy no Vercel. No deploy público:
- Ollama está desabilitado (já implementado)
- O visitante usa a própria chave Gemini gratuita
- Demo mode foi removido do código mas as receitas ainda existem em `demo_recipes.json`
- A experiência principal é desktop; mobile está em melhoria contínua

---

## 1. Spread de Pesquisa Adaptável

### Abordagem
Três seções irmãs no DOM dentro do spread de pesquisa, todas com `opacity: 0` exceto a ativa. GSAP faz crossfade de ~200ms na alternância entre estados.

```html
<div id="search-state-no-key">...</div>
<div id="search-state-demo">...</div>
<div id="search-state-search">...</div>
```

### Estado A — Sem chave (`#search-state-no-key`)
Estado inicial para todo visitante (não persiste nenhum estado alternativo).

**Conteúdo:**
- Texto editorial: *"para pesquisar receitas com IA, você precisa de uma chave Gemini gratuita"*
- Link externo: `aistudio.google.com`
- Input para a chave + botão confirmar
- Link secundário: *"ou experimente com receitas de demonstração →"*

**Comportamento ao confirmar:**
- Valida a chave chamando `/api/models` com a chave no header — o backend já usa `list_gemini_models()` que chama `GET /v1beta/models?key=...` no Google, endpoint leve e sem custo
- Sucesso → salva chave em `localStorage` (`gemini_key`) → fade para Estado C
- Falha → exibe erro inline no campo (ver Seção 2)

**Comportamento ao clicar no link de demo:**
- Ativa Estado B via fade
- Não salva nada no localStorage

### Estado B — Modo demo (`#search-state-demo`)
Experiência limitada, sem chave Gemini.

**Conteúdo:**
- Cards clicáveis com as receitas disponíveis em `demo_recipes.json`
- Linha discreta no rodapé: *"modo demonstração · configurar chave Gemini →"*

**Comportamento:**
- Clicar em um card dispara a busca com `body.demo = true`
- Link de configuração → fade para Estado A
- **Não persiste:** reload da página volta ao Estado A

**Backend:** restaurar suporte ao modo demo no Flask — rota `/api/recipe` deve aceitar `body.demo = true` e servir de `demo_recipes.json`.

### Estado C — Com chave (`#search-state-search`)
Experiência completa com Gemini.

**Conteúdo:**
- Formulário de busca normal (sem alteração visual existente)
- Linha discreta abaixo do campo: *"Chave Gemini salva · Trocar →"*

**Comportamento ao clicar em Trocar:**
- Fade para Estado A
- A chave existente permanece no localStorage até o usuário confirmar uma nova (ou seja, o campo de input no Estado A pode iniciar pré-preenchido com a chave atual para facilitar a troca)

### Lógica de inicialização
```js
// Na inicialização do spread de pesquisa:
if (getStoredGeminiKey()) {
  showSearchState('search')
} else {
  showSearchState('no-key')
}
// Demo mode nunca inicializa automaticamente
```

---

## 2. Mensagens de Erro Específicas do Gemini

### Contrato do backend
O Flask passa a incluir `error_code` nas respostas de erro:

```json
{ "error": "...", "error_code": "rate_limit" | "auth_error" | "generic" }
```

### Tratamento no frontend

| Código | Origem | Mensagem | Comportamento |
|--------|--------|----------|---------------|
| `rate_limit` | HTTP 429 | *"muitas pesquisas em pouco tempo — aguarde alguns minutos"* | Inline no spread de pesquisa, não navega para spread de erro |
| `auth_error` | HTTP 401/403 | *"chave inválida — verifique em aistudio.google.com"* + link "Trocar chave →" | Inline; link faz fade para Estado A |
| `generic` | outros | mensagem atual | Navega para spread de erro existente |

**Erro inline de validação (Estado A):**
- Input recebe classe de erro (borda laranja/vermelha)
- Mensagem abaixo do campo: *"Chave inválida — verifique em aistudio.google.com"*
- Desaparece ao usuário começar a editar o campo

---

## 3. Aviso Mobile

### Gatilho
Dispositivos com `window.innerWidth < 768px` na inicialização da página.

### Comportamento
- Aparece após a animação de abertura do livro, posicionado abaixo do livro fechado
- Não é modal bloqueante — o usuário pode dispensar e continuar
- Após dispensar, persiste em `localStorage` (`fp_mobile_notice_dismissed`) e não reaparece

### Conteúdo
> *"o Foodpedia foi projetado para desktop. em telas menores, algumas páginas podem não se comportar como esperado."*  
> `[continuar mesmo assim]`

### Visual
- Fundo: `var(--c-page-alt)` (tom de papel)
- Tipografia da família editorial do projeto
- Fade de entrada e saída ao dispensar

---

## 4. Scroll no Spread de Resultado (substitui spread de continuação)

### Decisão
O spread de continuação (`result-continuation`) é completamente removido. Receitas longas passam a rolar dentro do próprio spread de resultado.

### Comportamento
- Cada página do spread de resultado rola **independentemente** (esquerda e direita)
- Scroll via wheel, touch e teclado (setas verticais quando o foco está na página)
- Ao navegar para o spread de resultado, ambas as páginas resetam para o topo (`scrollTop = 0`)
- Swipe horizontal (virar página) não é afetado — o scroll vertical é capturado pela página, não pelo livro

### Scrollbar
- Scrollbar padrão do browser **oculta** (`scrollbar-width: none` / `::-webkit-scrollbar { display: none }`)
- Indicador visual: linha fina (`2px`) na cor `var(--c-border)` na borda direita de cada página, visível apenas quando há conteúdo além do limite — implementada via `box-shadow` interno ou pseudo-elemento

### Remoção
- Remover toda lógica de `result-continuation` no `book.js`: `buildResultContinuation()`, inserção no layout, referências em `rebuildBookLayout()`
- Remover container `#result-continuation-container` do `index.html`
- Remover CSS de `.result-continuation-card` e seletores associados
- Remover `SPREAD_RESULT_CONTINUATION` das constantes e do mapa de navegação

### Arquivos afetados (adicionais)
| Arquivo | Alteração |
|---------|-----------|
| `static/js/book.js` | Remover lógica de continuação; adicionar `overflow-y: auto` e reset de scroll no result spread |
| `static/css/book.css` | Ocultar scrollbar nativa; adicionar indicador de borda; `overflow-y: auto` nas páginas do result |
| `templates/index.html` | Remover `#result-continuation-container` |

---

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `templates/index.html` | Adicionar três seções irmãs no spread de pesquisa; adicionar container do aviso mobile |
| `static/js/book.js` | `showSearchState()`, lógica de inicialização, validação de chave, tratamento de `error_code`, aviso mobile |
| `static/css/book.css` | Estilos dos três estados, erro inline, aviso mobile |
| `app/routes/api.py` | Restaurar branch `demo` em `/api/recipe`, adicionar `error_code` nas respostas de erro |
| `static/data/demo_recipes.json` | Já existe — apenas o backend precisa voltar a servi-lo |

---

## Fora do escopo

- PDF export
- Mais receitas clássicas
- Geração de imagem via IA
- Melhorias gerais de mobile além do aviso
