import logging
from flask import current_app

logger = logging.getLogger(__name__)


def get_recipe_from_ai(dish: str, provider: str = None, model: str = None, lang: str = 'pt', gemini_api_key: str = None) -> dict:
    if provider is None:
        provider = current_app.config.get('AI_PROVIDER', 'ollama')

    if provider == 'demo':
        from app.services.demo_service import get_demo_recipe
        return get_demo_recipe(dish)

    if provider == 'gemini':
        from app.services.gemini_service import call_gemini
        return call_gemini(dish, model=model, lang=lang, gemini_api_key=gemini_api_key)

    # default: ollama
    from app.services.ollama_service import call_ollama, build_recipe_prompts
    system, prompt = build_recipe_prompts(dish, lang)
    return call_ollama(system, prompt, model=model)


def translate_with_ai(recipe: dict, target_lang: str, provider: str = None, model: str = None) -> dict:
    if provider is None:
        provider = current_app.config.get('AI_PROVIDER', 'ollama')

    if provider == 'gemini':
        from app.services.gemini_service import translate_gemini
        return translate_gemini(recipe, target_lang, model=model)

    # default: ollama (also covers demo — translate using ollama if available)
    from app.services.ollama_service import call_ollama, build_translation_prompts
    import re, json
    system, prompt = build_translation_prompts(recipe, target_lang)
    result = call_ollama(system, prompt, model=model)
    result['illustration_key'] = recipe.get('illustration_key', result.get('illustration_key'))
    return result
