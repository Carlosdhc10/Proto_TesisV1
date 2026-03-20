import { TfIdf } from 'natural';
import { cleanText } from './text.utils';

export function calculateSimilarity(text1: string, text2: string): number {
  const tfidf = new TfIdf();

  const clean1 = cleanText(text1);
  const clean2 = cleanText(text2);

  tfidf.addDocument(clean1);
  tfidf.addDocument(clean2);

  const terms1 = tfidf.listTerms(0);
  const terms2 = tfidf.listTerms(1);

  const map1 = new Map(terms1.map((t) => [t.term, t.tfidf]));
  const map2 = new Map(terms2.map((t) => [t.term, t.tfidf]));

  const allTerms = new Set([...map1.keys(), ...map2.keys()]);

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  allTerms.forEach((term) => {
    const v1 = map1.get(term) || 0;
    const v2 = map2.get(term) || 0;

    dotProduct += v1 * v2;
    magnitude1 += v1 * v1;
    magnitude2 += v2 * v2;
  });

  const similarity =
    magnitude1 && magnitude2
      ? dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2))
      : 0;

  return similarity * 100;
}
