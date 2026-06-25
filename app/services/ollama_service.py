import json
import re
import logging
from ollama import chat, list as ollama_list
from flask import current_app

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = {
    'name', 'subtitle', 'category', 'illustration_key',
    'prep_time', 'servings', 'difficulty', 'story',
    'annotation', 'ingredients', 'steps', 'tip',
}


def call_ollama(system: str, prompt: str, model: str = None) -> dict:
    if model is None:
        model = current_app.config.get('OLLAMA_MODEL', 'gemma3:latest')

    try:
        response = chat(
            messages=[
                {'role': 'system', 'content': system},
                {'role': 'user', 'content': prompt},
            ],
            model=model,
            format='json',
        )
    except Exception as e:
        msg = str(e)
        if 'connection' in msg.lower() or 'refused' in msg.lower():
            logger.error("Ollama offline: %s", e)
            raise ConnectionError("Ollama não está rodando") from e
        logger.error("Ollama error: %s", e)
        raise

    raw = response.message.content
    match = re.search(r'\{[\s\S]*\}', raw)
    if not match:
        logger.error("Ollama returned no JSON object: %s", raw[:200])
        raise ValueError("Resposta do Ollama não contém JSON")

    recipe = json.loads(match.group(0))
    return recipe


def check_ollama_available() -> bool:
    try:
        ollama_list()
        return True
    except Exception:
        return False


def list_ollama_models() -> list:
    try:
        result = ollama_list()
        return [m.model for m in result.models]
    except Exception as e:
        logger.warning("Ollama model list failed: %s", e)
        return []


def build_recipe_prompts(dish: str, lang: str = 'pt') -> tuple[str, str]:
    lang_instruction = (
        'Respond entirely in English.' if lang == 'en'
        else 'Responda inteiramente em português.'
    )
    system = (
        f'Você é o Foodpedia, uma enciclopédia culinária. '
        f'Responda SEMPRE apenas com JSON válido, sem markdown. {lang_instruction}'
    )
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


def build_translation_prompts(recipe: dict, target_lang: str) -> tuple[str, str]:
    import json as _json
    target_name = 'English' if target_lang == 'en' else 'Brazilian Portuguese'
    system = (
        'You translate structured culinary content. Return only valid JSON, without markdown. '
        'Keep the exact same keys, array structure, numbers, quantities, units, temperatures, '
        'proper names, illustration_key, IDs and technical values.'
    )
    prompt = (
        f'Translate the reader-facing text values in this recipe to {target_name}.\n'
        'Do not convert measurements. Do not add or remove information.\n'
        'Return exactly one JSON object with the same structure:\n\n'
        f'{_json.dumps(recipe, ensure_ascii=False)}'
    )
    return system, prompt
