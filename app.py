import json
import re
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_from_directory
from ollama import chat, list as ollama_list

app = Flask(__name__)
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

def load_recipes():
    path = Path(__file__).parent / 'static' / 'data' / 'base_recipes.json'
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_recipes_en():
    path = Path(__file__).parent / 'static' / 'data' / 'base_recipes_en.json'
    with open(path, 'r', encoding='utf-8') as f:
        return {recipe['name']: recipe for recipe in json.load(f)}

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

def build_prompts(dish, lang='pt'):
    lang_instruction = 'Respond entirely in English.' if lang == 'en' else 'Responda inteiramente em português.'
    system = f'Você é o Foodpedia, uma enciclopédia culinária. Responda SEMPRE apenas com JSON válido, sem markdown. {lang_instruction}'
    prompt = f'''Para o prato "{dish}", retorne APENAS este JSON:
{{
  "name": "nome oficial completo",
  "subtitle": "frase curta e poética",
  "category": "origem culinária",
  "illustration_key": "herbs|grain|bowl|vanilla|citrus|spice|mortar",
  "prep_time": "tempo total",
  "servings": "número de porções",
  "difficulty": "Fácil, Médio ou Difícil",
  "story": "2-3 frases sobre história e origem, tom nostálgico",
  "annotation": "anotação curta manuscrita, max 3 linhas, informal",
  "ingredients": ["quantidade + ingrediente"],
  "steps": ["passo claro, max 6"],
  "tip": "dica pessoal e útil"
}}'''
    return system, prompt

def build_translation_prompts(recipe, target_lang):
    target_name = 'English' if target_lang == 'en' else 'Brazilian Portuguese'
    system = (
        'You translate structured culinary content. Return only valid JSON, without markdown. '
        'Keep the exact same keys, array structure, numbers, quantities, units, temperatures, '
        'proper names, illustration_key, IDs and technical values.'
    )
    prompt = f'''Translate the reader-facing text values in this recipe to {target_name}.
Do not convert measurements. Do not add or remove information.
Return exactly one JSON object with the same structure:

{json.dumps(recipe, ensure_ascii=False)}'''
    return system, prompt

DEMO_RECIPES = {
    'butter chicken': {
        'name': 'Butter Chicken', 'subtitle': 'O curry que conquistou o mundo',
        'category': 'Culinária Indiana', 'illustration_key': 'spice',
        'prep_time': '1 hora', 'servings': '4 pessoas', 'difficulty': 'Médio',
        'story': 'O Murgh Makhani nasceu em 1947 no Moti Mahal de Delhi por acidente — sobras de frango tandoori mergulhadas em molho de tomate, manteiga e especiarias. O que era improviso virou o curry mais pedido do planeta.',
        'annotation': 'mais cremoso com\ncashew no molho.\ntenta!',
        'ingredients': ['800g frango sem osso', '400g tomates pelados', '200ml creme de leite',
            '100g manteiga', '2 col. garam masala', '1 col. cúrcuma', '1 col. páprica', 'Gengibre, alho, sal'],
        'steps': ['Marine frango em iogurte e especiarias 2h.',
            'Asse a 220°C por 20 min até dourar.',
            'Molho: frite manteiga, tomates, especiarias. Bata até homogêneo.',
            'Adicione frango ao molho. Cozinhe 10 min.',
            'Finalize com creme e manteiga. Sirva com arroz basmati.'],
        'tip': 'uma noite marinando faz diferença. o ácido do iogurte amacia de dentro.',
    },
    'tiramisu': {
        'name': 'Tiramisù', 'subtitle': 'Levanta-me — e levanta mesmo',
        'category': 'Confeitaria Italiana', 'illustration_key': 'vanilla',
        'prep_time': '30 min + 4h geladeira', 'servings': '8 pessoas', 'difficulty': 'Fácil',
        'story': 'Nasceu em Treviso nos anos 1960 no restaurante Le Beccherie. O nome significa "puxa-me para cima" — referência ao café e ao açúcar.',
        'annotation': 'café espresso frio\né insubstituível.\nnão use solúvel.',
        'ingredients': ['500g mascarpone', '4 ovos separados', '100g açúcar',
            '200ml café espresso frio', '30ml Marsala ou rum (opcional)',
            '200g biscoito savoiardi', 'Cacau em pó'],
        'steps': ['Bata gemas com açúcar até dobrar de volume e ficar pálido.',
            'Incorpore mascarpone sem bater demais.',
            'Bata claras em neve firme. Incorpore delicadamente ao creme.',
            'Mergulhe savoiardi rapidamente no café. Não encharque.',
            'Monte camadas: creme, biscoitos, creme. Geladeira 4h. Cacau antes de servir.'],
        'tip': 'fica melhor no dia seguinte. faça na véspera e esqueça na geladeira.',
    },
    'pierogi': {
        'name': 'Pierogi', 'subtitle': 'O abraço polonês em forma de massa',
        'category': 'Culinária Polonesa', 'illustration_key': 'grain',
        'prep_time': '1h 30min', 'servings': '4 pessoas (30 unid.)', 'difficulty': 'Médio',
        'story': 'O prato nacional não-oficial da Polônia — servido em festas, funerais e dias comuns. O recheio clássico é batata, queijo cottage e cebola caramelizada.',
        'annotation': 'cebola caramelizada\nno recheio faz toda\na diferença.',
        'ingredients': ['Massa: 300g farinha, 1 ovo, 150ml água morna, sal',
            'Recheio: 500g batata cozida, 200g queijo cottage, 2 cebolas',
            'Manteiga e cebola frita para servir', 'Creme azedo (sour cream)'],
        'steps': ['Massa: misture até suave. Descanse 30 min coberta.',
            'Recheio: amasse batatas, misture com cottage e cebola caramelizada. Tempere.',
            'Abra a massa (2mm). Corte círculos de 8cm.',
            'Recheie, feche em meia-lua e sele com garfo.',
            'Cozinhe em água salgada 4-5 min. Frite em manteiga até dourar.'],
        'tip': 'congelam crus perfeitamente. faça o dobro e congele antes de cozinhar.',
    },
}

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
    root = Path(__file__).parent
    demo_mode = request.args.get('demo') == 'true'
    asset_version = max(
        (root / 'static' / 'css' / 'book.css').stat().st_mtime_ns,
        (root / 'static' / 'js' / 'book.js').stat().st_mtime_ns,
    )
    return render_template(
        'index.html',
        base_recipes=load_recipes(),
        base_recipes_en=load_recipes_en(),
        demo_mode=demo_mode,
        demo_dishes=['Butter Chicken', 'Tiramisù', 'Pierogi'],
        asset_version=asset_version,
    )

@app.route('/dev/illustrations-preview')
def illustrations_preview():
    return render_template('illustrations-preview.html')

@app.route('/dev/illustrations-svg/<path:filename>')
def illustrations_svg(filename):
    svg_dir = Path(app.root_path) / 'templates' / 'svg'
    return send_from_directory(svg_dir, filename, mimetype='image/svg+xml')

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
    data  = request.get_json() or {}
    dish  = data.get('dish', '').strip()
    model = data.get('model', 'gemma3:latest').strip() or 'gemma3:latest'
    lang  = data.get('lang', 'pt')
    is_demo = request.args.get('demo') == 'true' or data.get('demo') is True

    if not dish:
        return jsonify({'error': 'Prato não informado'}), 400

    if is_demo:
        key = dish.lower()
        for dk, recipe in DEMO_RECIPES.items():
            if dk in key or key in dk:
                return jsonify(recipe)
        return jsonify({
            'error': 'demo',
            'message': 'Este prato não está no modo demo. Instale o Ollama para consultar qualquer receita.',
        }), 404

    system, prompt = build_prompts(dish, lang)
    try:
        raw = call_ollama(system=system, prompt=prompt, model=model)
        match = re.search(r'\{[\s\S]*\}', raw)
        if not match:
            return jsonify({'error': 'Resposta inválida'}), 500
        recipe = json.loads(match.group(0))
        return jsonify(recipe)
    except Exception as e:
        print(f"Erro: {e}")
        return jsonify({'error': 'Falha ao processar receita'}), 500

@app.route('/api/translate', methods=['POST'])
def translate_recipe():
    data = request.get_json() or {}
    recipe = data.get('recipe')
    target_lang = data.get('target_lang', 'pt')
    model = data.get('model', 'gemma3:latest').strip() or 'gemma3:latest'

    if not isinstance(recipe, dict):
        return jsonify({'error': 'Receita inválida'}), 400
    if target_lang not in ('pt', 'en'):
        return jsonify({'error': 'Idioma inválido'}), 400

    system, prompt = build_translation_prompts(recipe, target_lang)
    try:
        raw = call_ollama(system=system, prompt=prompt, model=model)
        match = re.search(r'\{[\s\S]*\}', raw)
        if not match:
            return jsonify({'error': 'Tradução inválida'}), 500
        translated = json.loads(match.group(0))
        translated['illustration_key'] = recipe.get('illustration_key', translated.get('illustration_key'))
        return jsonify(translated)
    except Exception as e:
        print(f"Erro ao traduzir: {e}")
        return jsonify({'error': 'Falha ao traduzir receita'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
