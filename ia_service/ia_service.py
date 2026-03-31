from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer, util
import nltk
import torch
import sys

# Descargamos el divisor de frases (solo la primera vez)
try:
    nltk.download('punkt')
    nltk.download('punkt_tab') # Recurso adicional para versiones nuevas de nltk
except Exception as e:
    print(f"Aviso descarga nltk: {e}")

app = Flask(__name__)

print("--- Iniciando Servicio de IA ---")
try:
    # Mantenemos tu modelo multilingüe para soporte en español
    model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    print("¡Modelo IA cargado correctamente!")
except Exception as e:
    print(f"Error cargando el modelo: {e}")
    sys.exit(1)

@app.route('/compare', methods=['POST'])
def compare():
    try:
        data = request.json
        texto_nuevo = data.get('texto_nuevo', '')
        textos_base = data.get('textos_base', [])

        # 1. Validación de entrada
        if not texto_nuevo:
            return jsonify({"similitud_ia": 0.0, "analisis_detallado": []})

        # 2. Segmentación en frases
        frases_nuevas = nltk.sent_tokenize(texto_nuevo)
        
        # 3. Preparar base de datos de frases
        todas_frases_base = []
        for doc in textos_base:
            if doc and isinstance(doc, str):
                todas_frases_base.extend(nltk.sent_tokenize(doc))

        # Si no hay nada previo en la BD, la similitud es 0 pero no debe dar error
        if not todas_frases_base:
            print("ℹ️ No hay documentos previos para comparar.")
            analisis_inicial = [{"texto": f, "similitud": 0.0, "referencia": ""} for f in frases_nuevas]
            return jsonify({
                "similitud_ia": 0.0,
                "analisis_detallado": analisis_inicial
            })

        # 4. Generar vectores (Embeddings)
        emb_nuevas = model.encode(frases_nuevas, convert_to_tensor=True)
        emb_base = model.encode(todas_frases_base, convert_to_tensor=True)

        # 5. Cálculo de similitud
        cos_sim_matrix = util.cos_sim(emb_nuevas, emb_base)
        
        analisis_detallado = []
        for i, frase in enumerate(frases_nuevas):
            # torch.max falla si la dimensión es 0, por eso validamos arriba
            max_val, max_idx = torch.max(cos_sim_matrix[i], dim=0)
            porcentaje = float(max_val.item()) * 100
            
            analisis_detallado.append({
                "texto": frase,
                "similitud": round(porcentaje, 2),
                "referencia": todas_frases_base[max_idx.item()] if porcentaje > 30 else ""
            })

        # 6. Cálculo Global
        # Usamos el promedio de todas las frases analizadas
        similitud_global = sum(f['similitud'] for f in analisis_detallado) / len(analisis_detallado)

        print(f"✅ Análisis completado. Similitud: {similitud_global:.2f}%")
        
        return jsonify({
            "similitud_ia": round(similitud_global, 2),
            "analisis_detallado": analisis_detallado
        })

    except Exception as e:
        # Esto imprimirá el error real en tu terminal de Python
        print(f"🔥 ERROR DETECTADO: {str(e)}")
        return jsonify({"error": "Error interno en el procesamiento", "detalle": str(e)}), 500

if __name__ == '__main__':
    # Ejecutamos en el puerto 5000 como lo tienes configurado en el Backend
    app.run(host='0.0.0.0', port=5000, debug=False)