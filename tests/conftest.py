import pytest
from app import create_app


@pytest.fixture
def client():
    app = create_app('testing')
    app.config['TESTING'] = True
    app.config['GEMINI_API_KEY'] = ''  # no server key in tests
    with app.test_client() as c:
        yield c
