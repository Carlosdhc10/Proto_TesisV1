import React from 'react';

export default function HighlightText({ text, matches = [] }) {
  if (!text) return null;

  const getPhraseColor = (similarity) => {
    // Si queremos detectar IA específicamente, podemos añadir un rango
    // Por ahora, usemos los colores de plagio de tu imagen de referencia:
    if (similarity >= 85) return 'rgba(255, 0, 0, 0.4)'; // Rojo fuerte (Casi exacto)
    if (similarity >= 50) return 'rgba(255, 165, 0, 0.35)'; // Naranja (Parafraseo alto)
    if (similarity >= 20) return 'rgba(255, 255, 0, 0.25)'; // Amarillo (Similitud leve/IA)
    return 'transparent'; 
  };

  return (
    <div className="highlighted-content" style={{ 
      lineHeight: '2', 
      fontSize: '1.1rem', 
      textAlign: 'justify',
      padding: '20px',
      backgroundColor: '#fff',
      borderRadius: '8px',
      color: '#333' // Aseguramos que el texto sea oscuro para que el fondo resalte
    }}>
      {matches && matches.length > 0 ? (
        matches.map((match, idx) => {
          const color = getPhraseColor(match.similarity);
          
          return (
            <span 
              key={idx} 
              style={{ 
                backgroundColor: color,
                padding: '3px 0',
                borderRadius: '4px',
                cursor: 'pointer',
                borderBottom: color !== 'transparent' ? `2px solid ${color.replace('0.4', '1')}` : 'none'
              }}
              title={`Similitud: ${match.similarity}% | Origen: ${match.text2 || 'No disponible'}`}
            >
              {match.text1}{' '} 
            </span>
          );
        })
      ) : (
        <p style={{ color: '#666' }}>{text}</p>
      )}
    </div>
  );
}