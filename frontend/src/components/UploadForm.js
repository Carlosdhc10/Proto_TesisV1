import React, { useState } from 'react';
import { uploadDocument } from '../services/api';

export default function UploadForm({ setResult }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Selecciona un PDF para analizar.');
      return;
    }

    if (!title.trim()) {
      setError('Escribe un título (te ayuda a identificar el documento).');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('userId', 1);

    try {
      setIsSubmitting(true);
      setProgress(0);
      const res = await uploadDocument(formData, {
        onUploadProgress: (evt) => {
          const total = evt.total || 0;
          const next = total > 0 ? Math.round((evt.loaded * 100) / total) : 0;
          setProgress(next);
        },
      });
      setResult(res.data);
    } catch (error) {
      console.error(error);
      setError('No se pudo subir/analizar el documento. Revisa el backend e inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="upload-form">
      <h2>Subir documento</h2>

      {error ? <div className="alert alert--error">{error}</div> : null}

      <input
        type="text"
        placeholder="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={isSubmitting}
      />

      <div className="upload-row">
        <label className="file-pill">
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={isSubmitting}
          />
          <span>{file ? 'Cambiar PDF' : 'Seleccionar PDF'}</span>
        </label>
        <div className="file-meta">
          {file ? (
            <>
              <div className="file-name">{file.name}</div>
              <div className="file-sub">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </div>
            </>
          ) : (
            <div className="file-sub">Solo PDF, máximo 10MB.</div>
          )}
        </div>
      </div>

      {isSubmitting ? (
        <div className="progress">
          <div className="progress__bar" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Analizando…' : 'Analizar'}
      </button>
    </form>
  );
}