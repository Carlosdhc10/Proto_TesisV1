import React from 'react';
import HighlightText from './HighlightText';

export default function Results({ result }) {
  const getColor = (value) => {
    if (value > 80) return 'red';
    if (value > 50) return 'orange';
    return 'green';
  };

  const total =
    result.summary.length > 0
      ? result.summary.reduce((acc, doc) => acc + doc.similarity, 0) /
        result.summary.length
      : 0;

  return (
    <div>

      <div className="grid">

        <div className="card">
          <h3>Similitud Total</h3>
          <div
            className="similarity-box"
            style={{ color: getColor(total) }}
          >
            {total.toFixed(2)}%
          </div>
        </div>

        <div className="card">
          <h3>Fuentes detectadas</h3>

          {result.summary.map((doc) => (
            <div key={doc.documentId}>
              📄 {doc.title} —{' '}
              <span style={{ color: getColor(doc.similarity) }}>
                {doc.similarity.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>

      </div>

      <div className="card">
        <h3>Texto Analizado</h3>

        <HighlightText
          text={result.document.content}
          matches={result.matches}
        />
      </div>

    </div>
  );
}
