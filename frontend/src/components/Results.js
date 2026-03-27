import React, { useMemo, useState } from 'react';
import HighlightText from './HighlightText';

export default function Results({ result }) {
  const [activeTab, setActiveTab] = useState('originality');

  const getLevelClass = (value) => {
    if (value >= 80) return 'level level--high';
    if (value >= 50) return 'level level--mid';
    return 'level level--low';
  };

  const summary = result?.summary || [];
  const matches = result?.matches || [];
  const total = summary.length
    ? summary.reduce((acc, doc) => acc + doc.similarity, 0) / summary.length
    : 0;
  const content = result?.document?.content || '';

  const detailsMetrics = useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const paragraphs = content.trim()
      ? content.split(/\n{2,}|\r\n{2,}|\.\s+/).filter((p) => p.trim().length > 20).length
      : 0;

    return {
      words,
      paragraphs,
      sources: summary.length,
      matches: matches.length,
      risk:
        total >= 80 ? 'Riesgo Alto' : total >= 50 ? 'Riesgo Medio' : 'Riesgo Bajo',
    };
  }, [content, matches.length, summary.length, total]);

  return (
    <section className="analysis-shell">
      <div className="analysis-topbar">
        <div className="tabs">
          <button
            type="button"
            className={`tab ${activeTab === 'originality' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('originality')}
          >
            Originality
          </button>
          <button
            type="button"
            className={`tab ${activeTab === 'details' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button
            type="button"
            className={`tab ${activeTab === 'matches' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            Matches
          </button>
        </div>
        <div className="score-box">
          <span className="score-label">SIMILITUD</span>
          <span className="score-value">{total.toFixed(2)}%</span>
          <span className={`score-chip ${getLevelClass(total)}`}>
            {total >= 80 ? 'Alto' : total >= 50 ? 'Medio' : 'Bajo'}
          </span>
        </div>
      </div>

      <div className="analysis-layout">
        <article className="document-view">
          <header className="document-head">
            <h3>{result?.document?.title || 'Documento analizado'}</h3>
            <p>
              {activeTab === 'originality' && 'Vista de texto extraido desde PDF'}
              {activeTab === 'details' && 'Resumen tecnico del analisis'}
              {activeTab === 'matches' && 'Lista detallada de coincidencias detectadas'}
            </p>
          </header>

          <div className="document-content">
            {activeTab === 'originality' && (
              <HighlightText
                text={content}
                matches={matches}
                totalSimilarity={total}
              />
            )}

            {activeTab === 'details' && (
              <div className="details-grid">
                <div className="detail-item">
                  <span className="detail-label">Similitud global</span>
                  <span className="detail-value">{total.toFixed(2)}%</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Nivel de riesgo</span>
                  <span className="detail-value">{detailsMetrics.risk}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Palabras analizadas</span>
                  <span className="detail-value">{detailsMetrics.words}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Parrafos analizados</span>
                  <span className="detail-value">{detailsMetrics.paragraphs}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Fuentes comparadas</span>
                  <span className="detail-value">{detailsMetrics.sources}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Coincidencias detectadas</span>
                  <span className="detail-value">{detailsMetrics.matches}</span>
                </div>
              </div>
            )}

            {activeTab === 'matches' && (
              <div className="matches-detail-list">
                {matches.length ? (
                  matches.map((match, idx) => (
                    <div key={`${match.documentId}-${idx}`} className="matches-detail-card">
                      <div className="matches-detail-head">
                        <span className={`match-index ${getLevelClass(match.similarity)}`}>
                          {idx + 1}
                        </span>
                        <div className="matches-head-meta">
                          <div className="matches-head-title">{match.title}</div>
                          <div className="matches-head-score">
                            {match.similarity.toFixed(2)}% similitud
                          </div>
                        </div>
                      </div>
                      <div className="match-snippet">
                        <strong>Texto detectado:</strong> {match.text1}
                      </div>
                      <div className="match-snippet match-snippet--source">
                        <strong>Referencia:</strong> {match.text2}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">No se detectaron coincidencias detalladas.</p>
                )}
              </div>
            )}
          </div>
        </article>

        <aside className="matches-panel">
          <div className="matches-title">Resumen de coincidencias</div>

          {summary.length ? (
            <div className="matches-list">
              {summary.map((doc, idx) => (
                <div key={`${doc.title}-${idx}`} className="match-row">
                  <div className="match-left">
                    <span className={`match-index ${getLevelClass(doc.similarity)}`}>
                      {idx + 1}
                    </span>
                    <span className="match-source">{doc.title}</span>
                  </div>
                  <span className="match-value">{doc.similarity.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Sin fuentes detectadas todavia.</p>
          )}

          <div className="matches-footnote">
            Este reporte es de prototipo y usa una comparacion semantica global.
          </div>
        </aside>
      </div>
    </section>
  );
}
