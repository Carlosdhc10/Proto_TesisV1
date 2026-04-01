import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { cleanText } from './text.utils';

export type ExternalSourceDocument = {
  id: number;
  title: string;
  content: string;
  sourceType: 'web';
  url?: string;
  provider: 'wikipedia' | 'openalex' | 'serpapi';
};

type SearchProvider = {
  name: 'wikipedia' | 'openalex' | 'serpapi';
  search(query: string, limit: number): Promise<ExternalSourceDocument[]>;
};

@Injectable()
export class WebSourceService {
  private providers: SearchProvider[];

  constructor() {
    this.providers = [
      this.createWikipediaProvider(),
      this.createOpenAlexProvider(),
      this.createSerpApiProvider(),
    ];
  }

  async searchRelevantSources(targetText: string): Promise<ExternalSourceDocument[]> {
    const query = this.extractSearchQuery(targetText);
    if (!query) return [];

    const results = await Promise.allSettled(
      this.providers.map((provider) => provider.search(query, 4)),
    );

    const merged: ExternalSourceDocument[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        merged.push(...result.value);
      }
    }

    return this.deduplicateByUrlOrContent(merged).slice(0, 12);
  }

  private createWikipediaProvider(): SearchProvider {
    return {
      name: 'wikipedia',
      search: async (query: string, limit: number): Promise<ExternalSourceDocument[]> => {
        const url = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=${limit}`;
        const searchResponse = await axios.get(url, { timeout: 7000 });
        const payload = searchResponse.data as {
          query?: { search?: Array<{ pageid: number; title: string }> };
        };
        const results = payload.query?.search || [];
        if (!results.length) return [];

        const docs: ExternalSourceDocument[] = [];
        for (const item of results) {
          const extractUrl = `https://es.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&pageids=${item.pageid}&format=json`;
          try {
            const extractResponse = await axios.get(extractUrl, { timeout: 7000 });
            const extractPayload = extractResponse.data as {
              query?: { pages?: Record<string, { extract?: string; title?: string }> };
            };
            const page = extractPayload.query?.pages?.[String(item.pageid)];
            const text = page?.extract?.trim() || '';
            if (!text) continue;

            docs.push({
              id: -(item.pageid || docs.length + 1),
              title: page?.title || item.title,
              content: text,
              sourceType: 'web',
              url: `https://es.wikipedia.org/?curid=${item.pageid}`,
              provider: 'wikipedia',
            });
          } catch {
            // Ignore individual page errors and continue.
          }
        }
        return docs;
      },
    };
  }

  private createOpenAlexProvider(): SearchProvider {
    return {
      name: 'openalex',
      search: async (query: string, limit: number): Promise<ExternalSourceDocument[]> => {
        const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}`;
        const response = await axios.get(url, { timeout: 7000 });
        const payload = response.data as {
          results?: Array<{
            id?: string;
            display_name?: string;
            abstract_inverted_index?: Record<string, number[]>;
            primary_location?: { landing_page_url?: string };
          }>;
        };
        const works = payload.results || [];
        const docs: ExternalSourceDocument[] = [];

        for (const work of works) {
          const abstractText = this.rebuildOpenAlexAbstract(work.abstract_inverted_index);
          if (!abstractText || abstractText.length < 60) continue;

          docs.push({
            id: -Math.abs(this.hashString(work.id || work.display_name || `${docs.length}`)),
            title: work.display_name || 'OpenAlex work',
            content: abstractText,
            sourceType: 'web',
            url: work.primary_location?.landing_page_url || work.id,
            provider: 'openalex',
          });
        }

        return docs;
      },
    };
  }

  private createSerpApiProvider(): SearchProvider {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return {
        name: 'serpapi',
        search: async () => [],
      };
    }

    return {
      name: 'serpapi',
      search: async (query: string, limit: number): Promise<ExternalSourceDocument[]> => {
        const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=${limit}&hl=es&api_key=${encodeURIComponent(apiKey)}`;
        const response = await axios.get(url, { timeout: 7000 });
        const payload = response.data as {
          organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
        };
        const results = payload.organic_results || [];

        return results
          .filter((item) => (item.snippet || '').trim().length > 60)
          .map((item, idx) => ({
            id: -Math.abs(this.hashString(`${item.link || ''}-${idx}`)),
            title: item.title || 'Resultado web',
            content: item.snippet || '',
            sourceType: 'web',
            url: item.link,
            provider: 'serpapi',
          }));
      },
    };
  }

  private extractSearchQuery(text: string): string {
    const tokens = cleanText(text)
      .split(/\s+/)
      .filter((token) => token.length >= 5);
    const unique = Array.from(new Set(tokens));
    return unique.slice(0, 9).join(' ');
  }

  private rebuildOpenAlexAbstract(
    invertedIndex?: Record<string, number[]>,
  ): string {
    if (!invertedIndex) return '';

    const positionToWord: Array<{ pos: number; word: string }> = [];
    Object.entries(invertedIndex).forEach(([word, positions]) => {
      positions.forEach((pos) => {
        positionToWord.push({ pos, word });
      });
    });

    positionToWord.sort((a, b) => a.pos - b.pos);
    return positionToWord.map((entry) => entry.word).join(' ');
  }

  private deduplicateByUrlOrContent(
    docs: ExternalSourceDocument[],
  ): ExternalSourceDocument[] {
    const unique = new Map<string, ExternalSourceDocument>();
    docs.forEach((doc) => {
      const key = doc.url
        ? `url:${doc.url}`
        : `content:${cleanText(doc.content).slice(0, 180)}`;
      if (!unique.has(key)) {
        unique.set(key, doc);
      }
    });
    return Array.from(unique.values());
  }

  private hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
