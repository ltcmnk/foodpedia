import json
import re
from pathlib import Path
from flask import Flask, request, jsonify, render_template
from ollama import chat, list as ollama_list

app = Flask(__name__)

def load_recipes():
    path = Path(__file__).parent / 'static' / 'data' / 'base_recipes.json'
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def call_ollama(system: str, prompt: str, model: str = 'gemma3:latest') -> str:
    response = chat(
        messages=[
            {'role': 'system', 'content': system},
            {'role': 'user',   'content': prompt},
        ],
        model=model,
        format='json',
    )
    return response.message.content

@app.route('/api/models', methods=['GET'])
def get_models():
    try:
        result = ollama_list()
        names = [m.model for m in result.models]
        return jsonify({'models': names})
    except Exception as e:
        print(f"Erro ao listar modelos: {e}")
        return jsonify({'models': ['gemma3:latest']})

@app.route('/')
def index():
    return render_template('index.html', base_recipes=load_recipes())

@app.route('/ask_food', methods=['POST'])
def ask_food():
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({'error': 'Missing "message" field'}), 400
    user_message = data['message']
    try:
        raw = call_ollama(
            system='Você é o Foodpedia, uma enciclopédia culinária. Responda SEMPRE apenas com JSON válido, sem markdown.',
            prompt=f'Retorne APENAS um JSON válido sobre {user_message} com estas chaves: "name", "origin", "ingredients" (lista), "preparation", "fun_fact". SEM markdown.'
        )
        cleaned = raw.replace('```json', '').replace('```', '').strip()
        return jsonify(json.loads(cleaned))
    except Exception as e:
        print(f"Erro: {e}")
        return jsonify({'error': 'Failed to process food information'}), 500

@app.route('/api/recipe', methods=['POST'])
def get_recipe():
    data = request.get_json()
    dish  = (data or {}).get('dish', '').strip()
    model = (data or {}).get('model', 'gemma3:latest').strip() or 'gemma3:latest'
    if not dish:
        return jsonify({'error': 'Prato não informado'}), 400

    SYSTEM = 'Você é o Foodpedia, uma enciclopédia culinária. Responda SEMPRE apenas com JSON válido, sem markdown.'
    PROMPT = f"""Para o prato "{dish}", retorne APENAS este JSON:
{{
  "name": "nome oficial completo",
  "subtitle": "frase curta e poética que descreve o prato",
  "category": "origem culinária (ex: Culinária Brasileira)",
  "illustration_key": "uma das chaves: herbs, grain, bowl, vanilla, citrus, spice, mortar",
  "prep_time": "tempo total",
  "servings": "número de porções",
  "difficulty": "Fácil, Médio ou Difícil",
  "story": "2-3 frases sobre a história e origem do prato, tom nostálgico",
  "annotation": "anotação curta estilo receita manuscrita (max 3 linhas, informal)",
  "ingredients": ["quantidade + ingrediente"],
  "steps": ["passo descrito de forma clara (max 6 passos)"],
  "tip": "dica pessoal e útil, voz de quem cozinha muito"
}}"""

    try:
        raw = call_ollama(system=SYSTEM, prompt=PROMPT, model=model)
        match = re.search(r'\{[\s\S]*\}', raw)
        if not match:
            return jsonify({'error': 'Resposta inválida'}), 500
        recipe = json.loads(match.group(0))
        recipe['spread_index'] = 12
        recipe['page_left'] = '20'
        recipe['page_right'] = '21'
        return jsonify(recipe)
    except Exception as e:
        print(f"Erro: {e}")
        return jsonify({'error': 'Falha ao processar receita'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
