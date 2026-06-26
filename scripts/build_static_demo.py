import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app import create_app


def _make_paths_relative(html: str) -> str:
    html = re.sub(r'(["(])/(static/)', r'\1\2', html)
    html = re.sub(r'(static/(?:css|js)/book\.(?:css|js))\?v=\d+', r'\1', html)
    return html


def main() -> None:
    app = create_app('demo')
    app.config.update(FREEZER_RELATIVE_URLS=True)
    with app.test_client() as client:
        response = client.get('/?demo=true')
        if response.status_code >= 400:
            raise RuntimeError(f'Static demo render failed: HTTP {response.status_code}')
        html = response.get_data(as_text=True)

    (ROOT / 'index.html').write_text(_make_paths_relative(html), encoding='utf-8')
    print('Generated index.html static demo')


if __name__ == '__main__':
    main()
