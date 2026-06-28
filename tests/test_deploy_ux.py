import unittest.mock as mock
import pytest


# ── /api/models key validation ─────────────────────────────

def test_models_valid_key_returns_key_valid(client):
    with mock.patch('app.services.gemini_service.validate_gemini_key', return_value=True):
        resp = client.get('/api/models', headers={'X-Gemini-Key': 'AIzaFake'})
    assert resp.status_code == 200
    assert resp.get_json().get('key_valid') is True


def test_models_invalid_key_returns_401(client):
    with mock.patch('app.services.gemini_service.validate_gemini_key', return_value=False):
        resp = client.get('/api/models', headers={'X-Gemini-Key': 'AIzaBad'})
    assert resp.status_code == 401
    data = resp.get_json()
    assert data.get('error_code') == 'auth_error'


def test_models_no_key_header_works_normally(client):
    resp = client.get('/api/models')
    assert resp.status_code == 200
    assert 'models' in resp.get_json()


# ── /api/recipe demo mode ─────────────────────────────────

def test_recipe_demo_returns_demo_recipe(client):
    fake_recipe = {'name': 'Shakshuka', '_demo': True, 'illustration_key': 'spice'}
    with mock.patch('app.services.demo_service.get_demo_recipe', return_value=fake_recipe):
        resp = client.post('/api/recipe', json={'dish': 'Shakshuka', 'demo': True})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data.get('_demo') is True
    assert data.get('name') == 'Shakshuka'


def test_recipe_demo_requires_dish(client):
    resp = client.post('/api/recipe', json={'demo': True})
    assert resp.status_code == 400


# ── /api/recipe error_code field ─────────────────────────

def test_recipe_rate_limit_returns_error_code(client, monkeypatch):
    monkeypatch.setenv('VERCEL', '1')
    import requests as req_lib
    http_err = req_lib.exceptions.HTTPError(response=mock.MagicMock(status_code=429))
    with mock.patch('app.services.gemini_service._post_gemini', side_effect=http_err):
        resp = client.post('/api/recipe', json={
            'dish': 'pizza', 'provider': 'gemini', 'gemini_key': 'AIzaFake'
        })
    assert resp.status_code == 429
    data = resp.get_json()
    assert data.get('error_code') == 'rate_limit'


def test_recipe_auth_error_returns_error_code(client, monkeypatch):
    monkeypatch.setenv('VERCEL', '1')
    import requests as req_lib
    http_err = req_lib.exceptions.HTTPError(response=mock.MagicMock(status_code=401))
    with mock.patch('app.services.gemini_service._post_gemini', side_effect=http_err):
        resp = client.post('/api/recipe', json={
            'dish': 'pizza', 'provider': 'gemini', 'gemini_key': 'AIzaFake'
        })
    assert resp.status_code == 401
    data = resp.get_json()
    assert data.get('error_code') == 'auth_error'


def test_recipe_generic_error_has_error_code(client, monkeypatch):
    monkeypatch.setenv('VERCEL', '1')
    with mock.patch('app.services.gemini_service._post_gemini', side_effect=Exception('boom')):
        resp = client.post('/api/recipe', json={
            'dish': 'pizza', 'provider': 'gemini', 'gemini_key': 'AIzaFake'
        })
    assert resp.status_code == 500
    data = resp.get_json()
    assert data.get('error_code') == 'generic'
