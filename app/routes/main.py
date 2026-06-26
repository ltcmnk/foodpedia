import json
from pathlib import Path
from flask import Blueprint, render_template, request, send_from_directory, current_app

main_bp = Blueprint('main', __name__)


def _load_json(filename: str) -> list | dict:
    path = Path(current_app.root_path).parent / 'static' / 'data' / filename
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


@main_bp.route('/')
def index():
    root = Path(current_app.root_path).parent
    demo_mode = (
        request.args.get('demo') == 'true'
        or current_app.config.get('DEMO_MODE', False)
    )
    base_recipes = _load_json('base_recipes.json')
    base_recipes_en_list = _load_json('base_recipes_en.json')
    base_recipes_en = {r['spread_index']: r for r in base_recipes_en_list}

    css_path = root / 'static' / 'css' / 'book.css'
    js_path = root / 'static' / 'js' / 'book.js'
    asset_version = max(
        css_path.stat().st_mtime_ns,
        js_path.stat().st_mtime_ns,
    )

    from app.services.demo_service import list_demo_dishes
    demo_dishes_raw = list_demo_dishes()[:3]
    demo_dishes = [d for d in demo_dishes_raw if d]

    return render_template(
        'index.html',
        base_recipes=base_recipes,
        base_recipes_en=base_recipes_en,
        demo_mode=demo_mode,
        demo_dishes=demo_dishes or ['Feijoada Brasileira', 'Crème Brûlée', 'Pad Thai'],
        asset_version=asset_version,
    )


@main_bp.route('/dev/illustrations-preview')
def illustrations_preview():
    return render_template('illustrations-preview.html')


@main_bp.route('/dev/illustrations-svg/<path:filename>')
def illustrations_svg(filename):
    svg_dir = Path(current_app.root_path).parent / 'templates' / 'svg'
    return send_from_directory(svg_dir, filename, mimetype='image/svg+xml')
