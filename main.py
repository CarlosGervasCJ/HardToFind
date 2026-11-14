import os

# Força o diretório HOME para /tmp (Essencial para o Astropy na Vercel)
os.environ["HOME"] = "/tmp"

from flask import Flask, jsonify
from flask_cors import CORS  # <--- Importante
from items import bp

# Inicializa o Flask diretamente para compatibilidade total com a Vercel
app = Flask(__name__)

# Habilita o CORS para permitir requisições de outras origens (como o front-end local ou web)
CORS(app)

# Registra o Blueprint de itens e buscas astronômicas
app.register_blueprint(bp)


@app.get("/")
def read_root():
  return jsonify(
      {
          "status": "online",
          "message": "API SPHEREx rodando com sucesso na Vercel!",
          "endpoint_busca": (
              "/api/search-spherex?ra=269.452083&dec=4.693333&band=d1"
          ),
      }
  )


if __name__ == "__main__":
  app.run(debug=True, host="0.0.0.0", port=5001)
