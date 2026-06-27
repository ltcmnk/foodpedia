import json
import re
import logging
import requests
from flask import current_app

logger = logging.getLogger(__name__)

_GEMINI_BASE_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models"
    "/{model}:generateContent"
)

_SYSTEM = (
    "Você é o Foodpedia, uma enciclopédia culinária. "
    "Responda SEMPRE apenas com JSON válido, sem markdown, sem texto extra."
)

_RECIPE_PROMPT = '''Para o prato "{dish}", retorne APENAS este JSON (sem markdown):
{{
  "name": "nome oficial completo",
  "subtitle": "frase curta e poética que descreve o prato",
  "category": "origem culinária (ex: Culinária Brasileira)",
  "illustration_key": "uma de: herbs, grain, bowl, vanilla, citrus, spice, mortar",
  "prep_time": "tempo total",
  "servings": "número de porções",
  "difficulty": "Fácil, Médio ou Difícil",
  "story": "2-3 frases sobre história e origem, tom nostálgico",
  "annotation": "anotação curta estilo receita manuscrita (max 3 linhas, informal)",
  "ingredients": ["quantidade + ingrediente"],
  "steps": ["passo claro (max 6 passos)"],
  "tip": "dica pessoal e útil, voz de quem cozinha muito"
}}'''

_TRANSLATION_PROMPT = '''Translate the reader-facing text values in this recipe to {target_name}.
Do not convert measurements. Do not add or remove information.
Return exactly one JSON object with the same structure:

{recipe_json}'''

AVAILABLE_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
]


def _post_gemini(prompt: str, model: str, api_key: str, timeout: int) -> dict:
    url = _GEMINI_BASE_URL.format(model=model)
    payload = {
        "system_instruction": {"parts": [{"text": _SYSTEM}]},
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.4,
            "maxOutputTokens": 2048,
        },
    }
    try:
        resp = requests.post(
            url,
            headers={'x-goog-api-key': api_key},
            json=payload,
            timeout=timeout,
        )
        resp.raise_for_status()
    except requests.exceptions.Timeout:
        logger.error("Gemini timeout após %ds", timeout)
        raise TimeoutError("Gemini demorou demais para responder")
    except requests.exceptions.HTTPError as e:
        logger.error("Gemini HTTP error %s: %s", e.response.status_code, e.response.text[:400])
        raise

    data = resp.json()
    try:
        raw = data['candidates'][0]['content']['parts'][0]['text']
    except (KeyError, IndexError) as e:
        logger.error("Gemini resposta inesperada: %s", data)
        raise ValueError("Resposta do Gemini em formato inesperado") from e

    cleaned = re.sub(r'```(?:json)?|```', '', raw).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error("Gemini JSON inválido: %s", cleaned[:300])
        raise ValueError("Resposta do Gemini não é JSON válido") from e


def call_gemini(dish: str, model: str = None, lang: str = 'pt', key: str = None) -> dict:
    api_key = key or current_app.config.get('GEMINI_API_KEY', '')
    if not api_key:
        raise ValueError("GEMINI_API_KEY não configurado")

    model = model or current_app.config.get('GEMINI_MODEL', 'gemini-2.5-flash')
    timeout = current_app.config.get('REQUEST_TIMEOUT', 30)

    lang_instruction = (
        ' Respond entirely in English.' if lang == 'en'
        else ' Responda inteiramente em português.'
    )
    prompt = _RECIPE_PROMPT.format(dish=dish) + lang_instruction

    return _post_gemini(prompt, model, api_key, timeout)


def translate_gemini(recipe: dict, target_lang: str, model: str = None, key: str = None) -> dict:
    api_key = key or current_app.config.get('GEMINI_API_KEY', '')
    if not api_key:
        raise ValueError("GEMINI_API_KEY não configurado")

    model = model or current_app.config.get('GEMINI_MODEL', 'gemini-2.5-flash')
    timeout = current_app.config.get('REQUEST_TIMEOUT', 30)
    target_name = 'English' if target_lang == 'en' else 'Brazilian Portuguese'

    prompt = _TRANSLATION_PROMPT.format(
        target_name=target_name,
        recipe_json=json.dumps(recipe, ensure_ascii=False),
    )
    translated = _post_gemini(prompt, model, api_key, timeout)
    translated['illustration_key'] = recipe.get('illustration_key', translated.get('illustration_key'))
    return translated


def check_gemini_available(key: str = None) -> bool:
    from app.services.ai_router import IS_VERCEL
    if IS_VERCEL:
        return True  # on Vercel, provider is always available; key comes from user
    api_key = key or current_app.config.get('GEMINI_API_KEY', '')
    return bool(api_key and api_key.strip())


def list_gemini_models() -> list:
    return AVAILABLE_MODELS
