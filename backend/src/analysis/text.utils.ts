// Lista básica de stopwords en español
const stopwords = [
  'el',
  'la',
  'los',
  'las',
  'de',
  'del',
  'y',
  'a',
  'en',
  'un',
  'una',
  'unos',
  'unas',
  'con',
  'por',
  'para',
  'es',
  'al',
  'lo',
  'como',
  'más',
  'pero',
  'sus',
  'le',
  'ya',
  'o',
  'este',
  'sí',
  'porque',
  'esta',
  'entre',
  'cuando',
  'muy',
  'sin',
  'sobre',
  'también',
  'me',
  'hasta',
  'hay',
  'donde',
  'quien',
  'desde',
  'todo',
  'nos',
];

// 🔹 Limpiar texto
export function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/gi, '') // quitar signos
    .split(' ')
    .filter((word) => word && !stopwords.includes(word))
    .join(' ');
}

// 🔹 Segmentos tipo párrafo (PDF a menudo trae \n; queremos cubrir más del documento)
export function splitIntoParagraphs(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const byBlankLine = normalized
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 12);

  if (byBlankLine.length >= 2) {
    return byBlankLine;
  }

  return normalized
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 12);
}
