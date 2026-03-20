import React, { useState } from 'react';
import './App.css';
import UploadForm from './components/UploadForm';
import Results from './components/Results';

function App() {
  const [result, setResult] = useState(null);

  return (
    <>
      <div className="header">
        Detector de Plagio - Tipo Turnitin
      </div>

      <div className="container">

        <div className="card">
          <UploadForm setResult={setResult} />
        </div>

        {result && <Results result={result} />}

      </div>
    </>
  );
}

export default App;
