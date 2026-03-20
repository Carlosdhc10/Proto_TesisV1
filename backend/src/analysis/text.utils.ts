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

// 🔹 Separar por párrafos
export function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n|\r|\.\s+/) // separa por saltos o puntos
    .map((p) => p.trim())
    .filter((p) => p.length > 30); // evitar ruido
}
