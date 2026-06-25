[![read in english](https://img.shields.io/badge/read%20in-english-1E88E5?style=flat-square)](./README.md)

<br>

<p align="center">
  <img src="./docs/cover.png" alt="Foodpedia — capa do livro" width="480"/>
</p>

<h1 align="center">foodpedia</h1>

<p align="center">
  <em>cinco abas de curiosidade culinária, encadernadas num só livro.</em>
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
  <img src="./docs/demo.gif" alt="Abertura do livro e fluxo de receita do Foodpedia" width="900"/>
</p>

<br>

<table align="center">
  <tr>
    <td align="center">
      <img src="./docs/search.png" alt="Página de busca do Foodpedia" width="420"/>
    </td>
    <td align="center">
      <img src="./docs/recipe.png" alt="Spread de receita gerada por IA" width="420"/>
    </td>
  </tr>
</table>

<br>

Uma enciclopédia gastronômica para quem abre cinco abas só para entender um ingrediente. A interface organiza técnicas, pratos e descobertas dentro de um livro skeuomórfico; o backend conecta a curadoria ao Gemini, ao Ollama local ou a um modo demo sem configuração. Começou como projeto acadêmico na PUCPR (nota: 10/10) — esta é sua evolução pessoal contínua.

## providers

| | provider | configuração | gratuito | melhor para |
|--|----------|--------------|----------|-------------|
| ◆ | **demo** | nenhuma | sempre | olhar rápido, sem instalar |
| ◆ | **gemini** | chave de API | plano gratuito disponível | acesso de qualquer lugar |
| ◆ | **ollama** | instalação local | ilimitado | uso offline e privado |

Pegue uma chave Gemini em [aistudio.google.com](https://aistudio.google.com/apikey) · confira os [limites atuais da API Gemini](https://ai.google.dev/gemini-api/docs/rate-limits) · baixe o Ollama em [ollama.com](https://ollama.com)

## getting started

```bash
git clone https://github.com/ltcmnk/foodpedia.git
cd foodpedia
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# demo — edite .env → DEMO_MODE=true
flask run --port 5001

# gemini — edite .env → AI_PROVIDER=gemini + GEMINI_API_KEY=sua_chave
flask run --port 5001

# ollama — instale em ollama.com, então:
ollama pull gemma3
# edite .env → AI_PROVIDER=ollama
flask run --port 5001
```

## stack

backend · Python + Flask · templates Jinja2<br>
frontend · HTML, CSS e JavaScript vanilla<br>
camada de IA · Ollama (local) · Google Gemini (API REST) · modo demo

Sem framework — a metáfora do livro precisava de controle direto sobre cada página, transição e pixel.

## structure

```text
foodpedia/
├── app/
│   ├── routes/        # rotas da API e das páginas
│   └── services/      # router de IA · Ollama · Gemini · demo
├── static/            # CSS, JavaScript, dados de receitas
├── templates/         # HTML Jinja2 e ilustrações SVG
├── docs/              # screenshots do README
├── scripts/           # automação dos screenshots
├── tests/
├── app.py
└── .env.example
```

## api

| método | endpoint | descrição |
|--------|----------|-----------|
| `GET` | `/api/health` | status dos providers |
| `GET` | `/api/models` | modelos disponíveis por provider |
| `POST` | `/api/recipe` | gera uma receita a partir de um prato |

```bash
curl -X POST http://localhost:5001/api/recipe \
  -H "Content-Type: application/json" \
  -d '{"dish": "feijoada", "provider": "demo"}'
```

---

*começou como projeto acadêmico na PUCPR · agora segue em evolução pessoal.*

feito por [letícia miniuk](https://ltcmnk.github.io/portfolio) &nbsp;·&nbsp; [/home/mishka](https://github.com/ltcmnk)
