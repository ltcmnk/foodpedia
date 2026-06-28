# Spec: README Redesign (EN + PT-BR)
**Date:** 2026-06-28

## Goal
Rewrite both READMEs to be professional, visually strong, and personality-driven — inspired by high-quality open-source projects (gofiber/fiber, areg-sdk, implot3d, create-go-app). Replace all placeholder image references with real playwright screenshots. Add a Support Me section with three donation platforms.

## Reference Inspiration
- **gofiber/fiber**: clean badge row, demo GIF at top, sharp visual hierarchy
- **areg-sdk**: problem-first narrative, evidence-driven, comparison tables
- **implot3d**: screenshot gallery hero, emoji section headers, approachable voice
- **create-go-app**: minimal getting-started flow, no fluff

## Section Structure (both READMEs, same order)

| # | Section | Notes |
|---|---------|-------|
| 1 | Language toggle | Badge top-right |
| 2 | Hero | Tag image (foodpedia-tag-eng.png / foodpedia-tag-ptbr.png) + one-line tagline |
| 3 | Badges | Tech stack + Live Demo → Vercel + Stars badge |
| 4 | Nav anchor links | Inline row |
| 5 | Demo GIF | Playwright recording of book opening + page turns, full width |
| 6 | Screenshot gallery 2×3 | 6 playwright screenshots: cover, TOC, search, AI result, recipe, favorites |
| 7 | About | Problem-first narrative with personality |
| 8 | Features | Key features with inline screenshot where impactful |
| 9 | AI Providers table | Polished version of existing table |
| 10 | Getting Started | Polished existing content |
| 11 | Usage | Numbered steps |
| 12 | Configuration | Env var table |
| 13 | API | Endpoint table + curl example |
| 14 | Structure | File tree |
| 15 | Roadmap | Checkbox list |
| 16 | Built With | Linked list |
| 17 | Support Me | NEW — 3 platforms + star request |
| 18 | Contributing | Brief |
| 19 | License | MIT |
| 20 | Footer | Author links |

## Screenshots (Playwright — taken locally, saved to docs/)
Sequence (full load before capture):
1. `cover.png` — closed book cover
2. `demo.gif` — ~5s: cover opens → TOC appears (playwright codegen/record)
3. `toc.png` — TOC spread fully rendered
4. `search.png` — search spread with input focused
5. `ai-result.png` — AI-generated recipe result spread
6. `recipe.png` — a classic hardcoded recipe spread
7. `favorites.png` — favorites/bookmarks spread
8. `spread-intro.png` — endpaper + title page spread

All saved to `docs/`. Overwrite stale files.

## Support Me Section

### English
```markdown
## support me

Foodpedia is a personal project built with care. If it helped you, inspired you,
or you just want to see it keep going — any form of support is genuinely appreciated.

[![Ko-fi](badge)](https://ko-fi.com/ltcmnk)
[![Livepix](badge)](https://livepix.gg/ltcmnk)
[![GitHub Sponsors](badge)](https://github.com/sponsors/ltcmnk)

Can't donate? A ⭐ on this repo goes a long way — it helps others discover the
project and keeps the motivation alive.
```

### PT-BR
```markdown
## apoie o projeto

O Foodpedia é um projeto pessoal feito com carinho. Se ele te ajudou, te inspirou
ou você só quer ver ele continuar — qualquer forma de apoio é muito bem-vinda.

[![Ko-fi](badge)](https://ko-fi.com/ltcmnk)
[![Livepix](badge)](https://livepix.gg/ltcmnk)
[![GitHub Sponsors](badge)](https://github.com/sponsors/ltcmnk)

Não pode contribuir financeiramente? Uma ⭐ no repositório já ajuda muito — 
ela faz outras pessoas encontrarem o projeto e mantém a motivação lá em cima.
```

## Live Demo URL
https://foodpedia-three.vercel.app

## Support Links
- Ko-fi: https://ko-fi.com/ltcmnk
- Livepix: https://livepix.gg/ltcmnk
- GitHub Sponsors: https://github.com/sponsors/ltcmnk

## Tone
- **English**: confident, direct, technical with dry wit — never marketing-speak
- **PT-BR**: mesmo tom, em português nativo — não é tradução literal

## Constraints
- No new dependencies in the app code
- All images committed to `docs/`
- READMEs must render correctly on GitHub
- GIF < 10MB (keep it tight, ~5s)
