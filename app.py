from flask import Flask, request, jsonify, send_from_directory
from ollama import chat
from pydantic import BaseModel
import time  # Adicionado para tratamento de timeout

app = Flask(__name__, static_folder='static')

class FoodInfo(BaseModel):
    name: str
    origin: str
    ingredients: list[str]
    preparation: str
    fun_fact: str

@app.route('/ask_food', methods=['POST'])
def ask_food():
    data = request.get_json()

    if not data or 'message' not in data:
        return jsonify({'error': 'Missing "message" field'}), 400

    user_message = data['message']

    try:
        response = chat(
            messages=[{
                'role': 'user', 
                'content': f"""Retorne APENAS um JSON válido sobre {user_message} com estas chaves exatas:
                - "name" (nome do prato)
                - "origin" (origem)
                - "ingredients" (lista)
                - "preparation" (modo de preparo)
                - "fun_fact" (curiosidade)
                NÃO inclua markdown ou texto adicional."""
            }],
            model='gemma3:latest',
            format='json'
        )

        # Limpa a resposta removendo markdown e whitespace
        raw_content = response.message.content
        json_content = raw_content.replace('```json', '').replace('```', '').strip()
        
        food = FoodInfo.model_validate_json(json_content)
        return jsonify(food.model_dump())

    except Exception as e:
        print(f"Erro completo: {str(e)}")
        return jsonify({'error': 'Failed to process food information'}), 500

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5001)  