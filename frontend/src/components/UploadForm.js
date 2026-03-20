import React, { useState } from 'react';
import { uploadDocument } from '../services/api';

export default function UploadForm({ setResult }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      alert('Selecciona un PDF');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('userId', 1);

    try {
      const res = await uploadDocument(formData);
      setResult(res.data);
    } catch (error) {
      console.error(error);
      alert('Error al subir');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Subir Documento</h2>

      <input
        type="text"
        placeholder="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <br /><br />

      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <br /><br />

      <button type="submit">Analizar</button>
    </form>
  );
}