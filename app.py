from dotenv import load_dotenv
load_dotenv()

from app import create_app

app = create_app()

if __name__ == '__main__':
    import os
    app.run(debug=True, port=int(os.getenv('PORT', 5001)))
