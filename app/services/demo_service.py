import json
import time
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_RECIPES: list[dict] = []
_LOADED = False


def _load():
    global _RECIPES, _LOADED
    if _LOADED:
        return
    path = Path(__file__).parent.parent.parent / 'static' / 'data' / 'demo_recipes.json'
    try:
        with open(path, 'r', encoding='utf-8') as f:
            _RECIPES = json.load(f)
        _LOADED = True
        logger.info("Demo recipes loaded: %d recipes", len(_RECIPES))
    except Exception as e:
        logger.error("Failed to load demo_recipes.json: %s", e)
        _RECIPES = []


def get_demo_recipe(dish: str) -> dict:
    _load()
    if not _RECIPES:
        raise RuntimeError("Demo recipes unavailable")

    query = dish.lower().strip()

    for recipe in _RECIPES:
        if recipe.get('name', '').lower() == query:
            time.sleep(0.8)
            result = dict(recipe)
            result['_demo'] = True
            return result

    for recipe in _RECIPES:
        name_lower = recipe.get('name', '').lower()
        if query in name_lower or name_lower in query:
            time.sleep(0.8)
            result = dict(recipe)
            result['_demo'] = True
            return result

    time.sleep(0.8)
    result = dict(_RECIPES[0])
    result['_demo'] = True
    return result


def count_demo_recipes() -> int:
    _load()
    return len(_RECIPES)


def list_demo_dishes() -> list[str]:
    _load()
    return [r.get('name', '') for r in _RECIPES]
