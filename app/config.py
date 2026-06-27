import os


class BaseConfig:
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY', os.urandom(24))
    AI_PROVIDER = os.getenv('AI_PROVIDER', 'ollama')
    OLLAMA_HOST = os.getenv('OLLAMA_HOST', 'http://localhost:11434')
    OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'gemma3:latest')
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
    GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')
    REQUEST_TIMEOUT = int(os.getenv('REQUEST_TIMEOUT', '30'))


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    TEMPLATES_AUTO_RELOAD = True
    SEND_FILE_MAX_AGE_DEFAULT = 0


class ProductionConfig(BaseConfig):
    DEBUG = False


class TestingConfig(BaseConfig):
    TESTING = True
    DEBUG = False
    GEMINI_API_KEY = ''


config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
}
