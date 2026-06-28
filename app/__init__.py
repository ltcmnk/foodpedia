import logging
import os
from flask import Flask, jsonify
from flask_cors import CORS


def create_app(config_name: str = None) -> Flask:
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')

    from app.config import config_map
    cfg = config_map.get(config_name, config_map['development'])

    app = Flask(__name__, template_folder='../templates', static_folder='../static')
    app.config.from_object(cfg)

    logging.basicConfig(
        level=logging.DEBUG if app.config.get('DEBUG') else logging.INFO,
        format='%(asctime)s %(levelname)s [%(name)s] %(message)s',
    )

    CORS(app, resources={r'/api/*': {'origins': '*'}})

    from app.routes.main import main_bp
    from app.routes.api import api_bp
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp)

    # Legacy route preserved for backward compatibility
    _register_legacy_routes(app)

    # Global JSON error handlers for /api/* paths
    @app.errorhandler(404)
    def not_found(e):
        if _is_api_path():
            return jsonify({'error': 'NOT_FOUND', 'message': str(e)}), 404
        return e

    @app.errorhandler(405)
    def method_not_allowed(e):
        if _is_api_path():
            return jsonify({'error': 'METHOD_NOT_ALLOWED', 'message': str(e)}), 405
        return e

    @app.errorhandler(500)
    def internal_error(e):
        if _is_api_path():
            return jsonify({'error': 'INTERNAL_ERROR', 'message': 'Erro interno'}), 500
        return e

    return app


def _is_api_path() -> bool:
    from flask import request
    return request.path.startswith('/api/')


def _register_legacy_routes(app: Flask):
    import json, re
    from flask import request, jsonify

    @app.route('/ask_food', methods=['POST'])
    def ask_food():
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({'error': 'Missing "message" field'}), 400
        user_message = data['message']
        try:
            from app.services.ollama_service import call_ollama
            raw = call_ollama(
                system='Você é o Foodpedia, uma enciclopédia culinária. Responda SEMPRE apenas com JSON válido, sem markdown.',
                prompt=(
                    f'Retorne APENAS um JSON válido sobre {user_message} com estas chaves: '
                    '"name", "origin", "ingredients" (lista), "preparation", "fun_fact". SEM markdown.'
                ),
            )
            return jsonify(raw)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("ask_food error: %s", e)
            return jsonify({'error': 'Failed to process food information'}), 500
