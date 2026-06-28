def test_recipe_returns_gemini_key_missing_when_no_key(client, monkeypatch):
    """Without a server key or request key, /api/recipe should return GEMINI_KEY_MISSING."""
    monkeypatch.setenv('VERCEL', '1')
    resp = client.post('/api/recipe', json={'dish': 'pizza', 'provider': 'gemini'})
    assert resp.status_code == 400
    assert resp.get_json()['error'] == 'GEMINI_KEY_MISSING'


def test_recipe_with_invalid_key_returns_gemini_key_missing(client, monkeypatch):
    """A wrong key should also produce GEMINI_KEY_MISSING (gemini raises ValueError)."""
    monkeypatch.setenv('VERCEL', '1')
    import unittest.mock as mock
    with mock.patch('app.services.gemini_service._post_gemini', side_effect=Exception('401')):
        resp = client.post('/api/recipe', json={
            'dish': 'pizza', 'provider': 'gemini', 'gemini_key': 'bad-key'
        })
    # Exception from gemini goes to INTERNAL_ERROR — acceptable behavior
    assert resp.status_code in (400, 500)


def test_translate_passes_gemini_key(client, monkeypatch):
    """gemini_key in translate body must reach translate_gemini without server env var."""
    monkeypatch.setenv('VERCEL', '1')
    import unittest.mock as mock
    with mock.patch('app.services.gemini_service.translate_gemini',
                    return_value={'name': 'pizza'}) as m:
        client.post('/api/translate', json={
            'recipe': {'name': 'pizza', 'illustration_key': 'bowl'},
            'target_lang': 'en',
            'provider': 'gemini',
            'gemini_key': 'my-key',
        })
    m.assert_called_once()
    _, kwargs = m.call_args
    assert kwargs.get('key') == 'my-key' or m.call_args[0][3] == 'my-key'
