import json
from pathlib import Path
from flask import Blueprint, render_template, send_from_directory, current_app, make_response

main_bp = Blueprint('main', __name__)


def _load_json(filename: str) -> list | dict:
    path = Path(current_app.root_path).parent / 'static' / 'data' / filename
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def _load_botanical_svgs(root: Path) -> dict:
    """Single source of truth for illustrations: the botanical SVG files.

    Injected into the page so client-rendered cards (search result, favorites)
    use the exact same art as the server-rendered base recipe cards.
    """
    svg_dir = root / 'templates' / 'svg' / 'botanical'
    out = {}
    for p in sorted(svg_dir.glob('botanical_*.svg')):
        key = p.stem.replace('botanical_', '')
        out[key] = p.read_text(encoding='utf-8')
    return out


@main_bp.route('/')
def index():
    root = Path(current_app.root_path).parent
    base_recipes = _load_json('base_recipes.json')
    base_recipes_en_list = _load_json('base_recipes_en.json')
    base_recipes_en = {r['spread_index']: r for r in base_recipes_en_list}
    illustrations = _load_botanical_svgs(root)

    css_path = root / 'static' / 'css' / 'book.css'
    js_path = root / 'static' / 'js' / 'book.js'
    asset_version = max(
        css_path.stat().st_mtime_ns,
        js_path.stat().st_mtime_ns,
    )

    html = render_template(
        'index.html',
        base_recipes=base_recipes,
        base_recipes_en=base_recipes_en,
        illustrations=illustrations,
        asset_version=asset_version,
    )
    # The app shell inlines SVGs and recipe JSON server-side, so the document
    # must always revalidate — otherwise browsers/CDN serve stale illustrations.
    response = make_response(html)
    response.headers['Cache-Control'] = 'no-cache, must-revalidate'
    return response


@main_bp.route('/dev/illustrations-preview')
def illustrations_preview():
    return render_template('illustrations-preview.html')


@main_bp.route('/dev/illustrations-svg/<path:filename>')
def illustrations_svg(filename):
    svg_dir = Path(current_app.root_path).parent / 'templates' / 'svg'
    return send_from_directory(svg_dir, filename, mimetype='image/svg+xml')
