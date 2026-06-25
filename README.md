[![leia em pt-BR](https://img.shields.io/badge/leia%20em-pt--BR-4CAF50?style=flat-square)](./README.pt-BR.md)

<br>

<p align="center">
  <img src="./docs/cover.png" alt="Foodpedia — cookbook cover" width="480"/>
</p>

<h1 align="center">foodpedia</h1>

<p align="center">
  <em>five tabs of culinary curiosity, bound into one book.</em>
</p>

<br>

<p align="center">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.11%2B-3776AB?style=flat-square&logo=python&logoColor=white"/>
  <img alt="Flask" src="https://img.shields.io/badge/Flask-3.1-000000?style=flat-square&logo=flask&logoColor=white"/>
  <img alt="Ollama" src="https://img.shields.io/badge/Ollama-local_AI-FFFFFF?style=flat-square&logo=ollama&logoColor=black"/>
  <img alt="Gemini" src="https://img.shields.io/badge/Gemini-API-4285F4?style=flat-square&logo=google&logoColor=white"/>
  <img alt="License" src="https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square"/>
</p>

<p align="center">
  <img src="./docs/demo.gif" alt="Foodpedia book opening and recipe flow" width="900"/>
</p>

<br>

<table align="center">
  <tr>
    <td align="center">
      <img src="./docs/search.png" alt="Foodpedia search page" width="420"/>
    </td>
    <td align="center">
      <img src="./docs/recipe.png" alt="AI-generated recipe spread" width="420"/>
    </td>
  </tr>
</table>

<br>

A gastronomic encyclopedia for anyone who opens five tabs just to understand one ingredient. The interface organizes techniques, dishes, and discoveries inside a skeuomorphic cookbook; the backend connects curated content to Gemini, local Ollama models, or a no-setup demo. It started as a university project at PUCPR — this is its ongoing personal evolution.

## providers

| | provider | setup | free | best for |
|--|----------|-------|------|----------|
| ◆ | **demo** | none | always | a quick look, no install |
| ◆ | **gemini** | API key | free tier available | access from anywhere |
| ◆ | **ollama** | local install | unlimited | offline, privacy-first use |

Get a Gemini key at [aistudio.google.com](https://aistudio.google.com/apikey) · check current [Gemini API limits](https://ai.google.dev/gemini-api/docs/rate-limits) · get Ollama at [ollama.com](https://ollama.com)

## getting started

```bash
git clone https://github.com/ltcmnk/foodpedia.git
cd foodpedia
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# demo — edit .env → DEMO_MODE=true
flask run --port 5001

# gemini — edit .env → AI_PROVIDER=gemini + GEMINI_API_KEY=your_key
flask run --port 5001

# ollama — install from ollama.com, then:
ollama pull gemma3
# edit .env → AI_PROVIDER=ollama
flask run --port 5001
```

## stack

backend · Python + Flask · Jinja2 templates<br>
frontend · vanilla HTML, CSS, and JavaScript<br>
ai layer · Ollama (local) · Google Gemini (REST API) · demo mode

No framework — the book metaphor demanded direct control over every page, transition, and pixel.

## structure

```text
foodpedia/
├── app/
│   ├── routes/        # API and page routes
│   └── services/      # AI router · Ollama · Gemini · demo
├── static/            # CSS, JavaScript, recipe data
├── templates/         # Jinja2 HTML and SVG illustrations
├── docs/              # README screenshots
├── scripts/           # screenshot automation
├── tests/
├── app.py
└── .env.example
```

## api

| method | endpoint | description |
|--------|----------|-------------|
| `GET` | `/api/health` | provider status |
| `GET` | `/api/models` | available models per provider |
| `POST` | `/api/recipe` | generate a recipe from a dish name |

```bash
curl -X POST http://localhost:5001/api/recipe \
  -H "Content-Type: application/json" \
  -d '{"dish": "feijoada", "provider": "demo"}'
```

---

*started as an academic project at PUCPR · now in its ongoing personal evolution.*

made by [letícia miniuk](https://ltcmnk.github.io/portfolio) &nbsp;·&nbsp; [/home/mishka](https://github.com/ltcmnk)
