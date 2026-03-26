from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer, util

app = Flask(__name__)

# Este modelo es excelente para español y corre localmente
print("Cargando modelo de IA... Esto puede tardar un minuto la primera vez.")
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
print("¡Modelo IA cargado correctamente!")

@app.route('/compare', methods=['POST'])
def compare():
    data = request.json
    texto_nuevo = data.get('texto_nuevo', '')
    textos_base = data.get('textos_base', []) # Lista de textos de otros documentos

    if not textos_base:
        return jsonify({"similitud_ia": 0.0, "mensaje": "No hay documentos previos para comparar"})

    # La IA convierte el texto en "vectores" para entender el significado
    emb1 = model.encode(texto_nuevo, convert_to_tensor=True)
    emb2 = model.encode(textos_base, convert_to_tensor=True)

    # Comparamos qué tan cerca están los significados (Similitud de Coseno)
    cos_sim = util.cos_sim(emb1, emb2)
    max_sim = float(cos_sim.max().item()) * 100

    print(f"Análisis completado: {max_sim:.2f}% de similitud detectada.")
    return jsonify({"similitud_ia": round(max_sim, 2)})

if __name__ == '__main__':
    # El servicio correrá en el puerto 5000
    app.run(port=5000, debug=False)