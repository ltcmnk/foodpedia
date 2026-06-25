import logging
from flask import Blueprint, request, jsonify, current_app

api_bp = Blueprint('api', __name__, url_prefix='/api')
logger = logging.getLogger(__name__)


# ── /api/health ─────────────────────────────────────────────────────────────

@api_bp.route('/health', methods=['GET'])
def health():
    from app.services.ollama_service import check_ollama_available, list_ollama_models
    from app.services.gemini_service import check_gemini_available, list_gemini_models
    from app.services.demo_service import count_demo_recipes

    ollama_ok = check_ollama_available()
    gemini_ok = check_gemini_available()

    providers = {
        'ollama': {
            'available': ollama_ok,
            'models': list_ollama_models() if ollama_ok else [],
            'host': current_app.config.get('OLLAMA_HOST'),
        },
        'gemini': {
            'available': gemini_ok,
            'key_configured': gemini_ok,
            'models': list_gemini_models(),
        },
        'demo': {
            'available': True,
            'recipes_count': count_demo_recipes(),
        },
    }

    if current_app.config.get('DEMO_MODE'):
        status = 'demo_only'
    elif ollama_ok or gemini_ok:
        status = 'ok'
    else:
        status = 'demo_only'

    return jsonify({
        'status': status,
        'providers': providers,
        'default_provider': current_app.config.get('AI_PROVIDER', 'ollama'),
        'demo_mode': current_app.config.get('DEMO_MODE', False),
    })


# ── /api/models ──────────────────────────────────────────────────────────────

@api_bp.route('/models', methods=['GET'])
def get_models():
    from app.services.ollama_service import check_ollama_available, list_ollama_models
    from app.services.gemini_service import check_gemini_available, list_gemini_models

    ollama_ok = check_ollama_available()
    gemini_ok = check_gemini_available()
    ollama_models = list_ollama_models() if ollama_ok else []

    # backward-compatible flat list (used by current frontend model selector)
    flat_models = ollama_models or (['gemma3:latest'] if not gemini_ok else [])

    return jsonify({
        'models': flat_models,
        'providers': {
            'ollama': {
                'available': ollama_ok,
                'models': ollama_models,
                'label': 'Ollama (local)',
                'requires_setup': True,
                'setup_url': 'https://ollama.com',
            },
            'gemini': {
                'available': gemini_ok,
                'models': list_gemini_models(),
                'label': 'Google Gemini (API key)',
                'requires_setup': False,
                'key_configured': gemini_ok,
                'free_tier_info': '15 req/min grátis — obtenha em aistudio.google.com',
            },
            'demo': {
                'available': True,
                'models': ['demo'],
                'label': 'Demonstração (sem IA)',
                'requires_setup': False,
            },
        },
    })


# ── /api/recipe ───────────────────────────────────────────────────────────────

@api_bp.route('/recipe', methods=['POST'])
def get_recipe():
    data = request.get_json() or {}
    dish = data.get('dish', '').strip()
    model = (data.get('model') or '').strip() or None
    lang = data.get('lang', 'pt')
    gemini_api_key = (data.get('gemini_api_key') or '').strip() or None

    # Provider resolution: body → config (DEMO_MODE overrides all)
    if current_app.config.get('DEMO_MODE') or data.get('demo') is True:
        provider = 'demo'
    else:
        provider = (data.get('provider') or '').strip() or current_app.config.get('AI_PROVIDER', 'ollama')

    if not dish:
        return jsonify({'error': 'MISSING_DISH', 'message': 'Prato não informado'}), 400
    if len(dish) < 2:
        return jsonify({'error': 'DISH_TOO_SHORT', 'message': 'Nome do prato muito curto'}), 400
    if len(dish) > 100:
        return jsonify({'error': 'DISH_TOO_LONG', 'message': 'Nome do prato muito longo'}), 400

    from app.services.ai_router import get_recipe_from_ai

    try:
        recipe = get_recipe_from_ai(dish, provider=provider, model=model, lang=lang, gemini_api_key=gemini_api_key)
        return jsonify(recipe)

    except ValueError as e:
        msg = str(e)
        if 'GEMINI_API_KEY' in msg:
            return jsonify({
                'error': 'GEMINI_KEY_MISSING',
                'message': 'Configure a variável GEMINI_API_KEY. Obtenha gratuitamente em aistudio.google.com',
            }), 400
        logger.error("Recipe parse error for '%s': %s", dish, e)
        return jsonify({'error': 'PARSE_ERROR', 'message': 'Resposta inválida do modelo'}), 500

    except ConnectionError as e:
        return jsonify({
            'error': 'OLLAMA_OFFLINE',
            'message': 'Ollama não está rodando. Inicie com: ollama serve',
        }), 503

    except TimeoutError as e:
        return jsonify({
            'error': 'TIMEOUT',
            'message': 'O modelo demorou demais para responder. Tente novamente.',
        }), 504

    except Exception as e:
        logger.error("Unexpected error for dish '%s' provider '%s': %s", dish, provider, e)
        return jsonify({'error': 'INTERNAL_ERROR', 'message': 'Falha ao processar receita'}), 500


# ── /api/translate ────────────────────────────────────────────────────────────

@api_bp.route('/translate', methods=['POST'])
def translate_recipe():
    data = request.get_json() or {}
    recipe = data.get('recipe')
    target_lang = data.get('target_lang', 'pt')
    model = (data.get('model') or '').strip() or None

    if not isinstance(recipe, dict):
        return jsonify({'error': 'INVALID_RECIPE', 'message': 'Receita inválida'}), 400
    if target_lang not in ('pt', 'en'):
        return jsonify({'error': 'INVALID_LANG', 'message': 'Idioma inválido'}), 400

    provider = current_app.config.get('AI_PROVIDER', 'ollama')

    from app.services.ai_router import translate_with_ai

    try:
        translated = translate_with_ai(recipe, target_lang, provider=provider, model=model)
        return jsonify(translated)

    except ConnectionError:
        return jsonify({
            'error': 'OLLAMA_OFFLINE',
            'message': 'Ollama não está rodando para tradução.',
        }), 503

    except TimeoutError:
        return jsonify({'error': 'TIMEOUT', 'message': 'Timeout ao traduzir'}), 504

    except Exception as e:
        logger.error("Translation error: %s", e)
        return jsonify({'error': 'TRANSLATION_FAILED', 'message': 'Falha ao traduzir receita'}), 500


# ── Legacy /ask_food ──────────────────────────────────────────────────────────
# Kept for backward compatibility — not used by current frontend

@api_bp.route('/ask_food_v2', methods=['POST'])
def ask_food_v2():
    """Internal alias; the legacy route lives in the root blueprint."""
    return jsonify({'error': 'Use /ask_food'}), 410
