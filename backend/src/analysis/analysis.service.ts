import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { calculateSimilarity } from './similarity.service';
import { cleanText, splitIntoParagraphs } from './text.utils';
import { WebSourceService } from './web-source.service';

export type AnalysisSource = {
  documentId: number;
  title: string;
  similarity: number;
  sourceType?: 'internal' | 'web';
  url?: string;
};

export type AnalysisMatch = {
  documentId: number;
  title: string;
  similarity: number;
  text1: string;
  text2: string;
  paragraphIndex?: number;
  sourceType?: 'internal' | 'web';
  url?: string;
};

export type AnalysisResponse = {
  message: string;
  document: {
    id: number;
    title: string;
    filePath: string;
    content: string;
    userId: number;
    createdAt: Date;
  };
  summary: AnalysisSource[];
  matches: AnalysisMatch[];
  overallSimilarity: number;
};

type SourceDocument = {
  id: number;
  title: string;
  content: string | null;
  sourceType: 'internal' | 'web';
  url?: string;
};

type SourceEvidence = {
  sourceId: number;
  sourceTitle: string;
  segmentIndex: number;
  segmentText: string;
  sourceSnippet: string;
  lexicalSimilarity: number;
  semanticSimilarity: number;
  combinedSimilarity: number;
  sourceType: 'internal' | 'web';
  sourceUrl?: string;
};

const semanticIaUrl =
  process.env.SEMANTIC_IA_URL ?? 'http://127.0.0.1:5000/compare';
const semanticIaTimeoutMs = Number(
  process.env.SEMANTIC_IA_TIMEOUT_MS ?? '120000',
);
const semanticIaTimeout =
  Number.isFinite(semanticIaTimeoutMs) && semanticIaTimeoutMs > 0
    ? semanticIaTimeoutMs
    : 120000;

const semanticTopKPerSegment = (() => {
  const n = Number(process.env.SEMANTIC_TOP_K_PER_SEGMENT ?? '4');
  if (!Number.isFinite(n) || n < 1) return 4;
  return Math.min(Math.floor(n), 12);
})();

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webSourceService: WebSourceService,
  ) {}
  private semanticCache = new Map<string, number>();

  async analyzeDocument(documentId: number): Promise<AnalysisResponse> {
    const targetDocument = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!targetDocument) {
      throw new NotFoundException('Documento no encontrado');
    }

    const targetText = targetDocument.content?.trim() || '';
    if (!targetText) {
      throw new NotFoundException('El documento no contiene texto analizable');
    }

    const internalDocuments = await this.prisma.document.findMany({
      where: { id: { not: documentId } },
    });

    const webDocuments = await this.webSourceService.searchRelevantSources(targetText);
    const sourceDocuments = this.deduplicateSources(
      [
        ...internalDocuments.map((item) => ({
          id: item.id,
          title: item.title,
          content: item.content,
          sourceType: 'internal' as const,
        })),
        ...webDocuments,
      ],
    );

    if (!sourceDocuments.length) {
      return {
        message: 'Análisis completado (sin documentos base)',
        document: {
          id: targetDocument.id,
          title: targetDocument.title,
          filePath: targetDocument.filePath,
          content: targetText,
          userId: targetDocument.userId,
          createdAt: targetDocument.createdAt,
        },
        summary: [],
        matches: [],
        overallSimilarity: 0,
      };
    }

    const segments = this.buildSegments(targetText);
    if (sourceDocuments.length) {
      this.logger.log(
        `Análisis documento ${documentId}: ${sourceDocuments.length} fuente(s), ${segments.length} segmento(s); hasta ${semanticTopKPerSegment} consulta(s) IA por segmento (el cliente espera hasta terminar).`,
      );
    }
    const evidence = await this.collectEvidenceBySegment(segments, sourceDocuments);
    const summary = this.buildSourceRanking(segments, evidence);
    const matches = this.buildMatchesFromEvidence(evidence);
    const overallSimilarity = summary.length
      ? this.round(
          summary.reduce((acc, item) => acc + item.similarity, 0) / summary.length,
        )
      : 0;

    return {
      message: 'Análisis de similitud completado',
      document: {
        id: targetDocument.id,
        title: targetDocument.title,
        filePath: targetDocument.filePath,
        content: targetText,
        userId: targetDocument.userId,
        createdAt: targetDocument.createdAt,
      },
      summary,
      matches,
      overallSimilarity,
    };
  }

  private buildSegments(targetText: string): string[] {
    const byParagraph = splitIntoParagraphs(targetText)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 40);
    const maxSegments = this.getMaxSegments(targetText);

    if (byParagraph.length) {
      return byParagraph.slice(0, maxSegments);
    }

    // Fallback for texts without clear paragraph delimiters.
    return targetText
      .split(/(?<=[.!?])\s+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 40)
      .slice(0, maxSegments);
  }

  private async collectEvidenceBySegment(
    segments: string[],
    sourceDocuments: SourceDocument[],
  ): Promise<SourceEvidence[]> {
    const evidence: SourceEvidence[] = [];

    const language = this.detectLanguage(segments.join(' '));
    const lexicalThreshold = language === 'es' ? 16 : 20;
    const combinedThreshold = language === 'es' ? 22 : 26;

    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
      const segment = segments[segmentIndex];
      let bestForSegment: SourceEvidence | null = null;

      const lexicalRanked: {
        sourceDocument: SourceDocument;
        lexicalSimilarity: number;
        sourceText: string;
      }[] = [];

      for (const sourceDocument of sourceDocuments) {
        const sourceText = sourceDocument.content?.trim() || '';
        if (!sourceText) continue;

        const lexicalSimilarity = calculateSimilarity(segment, sourceText);
        if (lexicalSimilarity < lexicalThreshold) continue;

        lexicalRanked.push({ sourceDocument, lexicalSimilarity, sourceText });
      }

      lexicalRanked.sort((a, b) => b.lexicalSimilarity - a.lexicalSimilarity);
      const candidatesForSemantic = lexicalRanked.slice(
        0,
        semanticTopKPerSegment,
      );

      for (const {
        sourceDocument,
        lexicalSimilarity,
        sourceText,
      } of candidatesForSemantic) {
        const semanticSimilarity = await this.getSemanticSimilarity(segment, sourceText);
        const combinedSimilarity = this.round(
          (lexicalSimilarity * 0.55) + (semanticSimilarity * 0.45),
        );

        if (combinedSimilarity < combinedThreshold) continue;

        const candidate: SourceEvidence = {
          sourceId: sourceDocument.id,
          sourceTitle: sourceDocument.title,
          segmentIndex,
          segmentText: segment,
          sourceSnippet: this.extractBestSnippet(sourceText, segment),
          lexicalSimilarity: this.round(lexicalSimilarity),
          semanticSimilarity: this.round(semanticSimilarity),
          combinedSimilarity,
          sourceType: sourceDocument.sourceType,
          sourceUrl: sourceDocument.url,
        };

        if (!bestForSegment || candidate.combinedSimilarity > bestForSegment.combinedSimilarity) {
          bestForSegment = candidate;
        }
      }

      if (bestForSegment) {
        evidence.push(bestForSegment);
      }
    }

    return evidence;
  }

  private buildSourceRanking(
    segments: string[],
    evidence: SourceEvidence[],
  ): AnalysisSource[] {
    if (!evidence.length || !segments.length) {
      return [];
    }

    const evidenceBySource = new Map<number, SourceEvidence[]>();
    for (const item of evidence) {
      const current = evidenceBySource.get(item.sourceId) || [];
      current.push(item);
      evidenceBySource.set(item.sourceId, current);
    }

    const ranking: AnalysisSource[] = [];
    evidenceBySource.forEach((items, sourceId) => {
      const sourceTitle = items[0]?.sourceTitle || `Fuente ${sourceId}`;
      const avgSegmentSimilarity =
        items.reduce((acc, item) => acc + item.combinedSimilarity, 0) / items.length;
      const coverage = (items.length / segments.length) * 100;
      const matchDensity = Math.min((items.length / 12) * 100, 100);

      // Weighted score for a more realistic source ranking.
      const sourceScore =
        (coverage * 0.5) + (avgSegmentSimilarity * 0.35) + (matchDensity * 0.15);

      ranking.push({
        documentId: sourceId,
        title: sourceTitle,
        similarity: this.round(sourceScore),
        sourceType: items[0]?.sourceType || 'internal',
        url: items[0]?.sourceUrl,
      });
    });

    ranking.sort((a, b) => b.similarity - a.similarity);
    return ranking;
  }

  private buildMatchesFromEvidence(evidence: SourceEvidence[]): AnalysisMatch[] {
    return evidence
      .sort((a, b) => b.combinedSimilarity - a.combinedSimilarity)
      .slice(0, 20)
      .map((item) => ({
        documentId: item.sourceId,
        title: item.sourceTitle,
        similarity: item.combinedSimilarity,
        text1: item.segmentText,
        text2: item.sourceSnippet,
        paragraphIndex: item.segmentIndex,
        sourceType: item.sourceType,
        url: item.sourceUrl,
      }));
  }

  private extractBestSnippet(sourceText: string, segment: string): string {
    const normalizedSource = cleanText(sourceText);
    const normalizedSegment = cleanText(segment);
    const segmentTokens = normalizedSegment.split(/\s+/).filter(Boolean).slice(0, 6);

    const rawSentences = sourceText
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 20);

    if (!rawSentences.length) {
      return sourceText.slice(0, 220);
    }

    let bestSentence = rawSentences[0];
    let bestScore = -1;

    for (const sentence of rawSentences.slice(0, 40)) {
      const normalizedSentence = cleanText(sentence);
      if (!normalizedSentence) continue;

      const lexical = calculateSimilarity(segment, sentence);
      const tokenBonus = segmentTokens.reduce((acc, token) => {
        if (token.length < 4) return acc;
        return normalizedSentence.includes(token) ? acc + 1 : acc;
      }, 0);

      const score = lexical + tokenBonus * 2;
      if (score > bestScore) {
        bestScore = score;
        bestSentence = sentence;
      }
    }

    if (bestScore < 0) {
      // Fallback to a deterministic snippet when no sentence could be scored.
      return normalizedSource.slice(0, 220);
    }

    return bestSentence.slice(0, 240);
  }

  private async getSemanticSimilarity(text1: string, text2: string): Promise<number> {
    const cacheKey = `${this.shortenForCache(text1)}::${this.shortenForCache(text2)}`;
    const cached = this.semanticCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const response = await axios.post(
        semanticIaUrl,
        {
          texto_nuevo: text1,
          textos_base: [text2],
        },
        {
          timeout: semanticIaTimeout,
        },
      );

      const payload = response.data as { similitud_ia?: number };
      const similarity = this.round(payload.similitud_ia || 0);
      this.semanticCache.set(cacheKey, similarity);
      return similarity;
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error IA semantica:', error.message);
      } else {
        console.error('Error IA semantica desconocido');
      }
      this.semanticCache.set(cacheKey, 0);
      return 0;
    }
  }

  private getMaxSegments(text: string): number {
    const words = text.trim().split(/\s+/).length;
    if (words <= 700) return 22;
    if (words <= 1800) return 38;
    return 52;
  }

  private detectLanguage(text: string): 'es' | 'unknown' {
    const normalized = text.toLowerCase();
    const spanishHints = [' de ', ' la ', ' que ', ' en ', ' y ', ' el ', ' los ', ' para '];
    const hits = spanishHints.reduce(
      (acc, token) => (normalized.includes(token) ? acc + 1 : acc),
      0,
    );
    return hits >= 3 ? 'es' : 'unknown';
  }

  private shortenForCache(text: string): string {
    return cleanText(text).slice(0, 280);
  }

  private deduplicateSources(sources: SourceDocument[]): SourceDocument[] {
    const unique = new Map<string, SourceDocument>();
    for (const source of sources) {
      const content = source.content?.trim() || '';
      if (!content) continue;
      const fingerprint = `${cleanText(source.title).slice(0, 40)}::${cleanText(content).slice(0, 220)}`;
      if (!unique.has(fingerprint)) {
        unique.set(fingerprint, source);
      }
    }
    return Array.from(unique.values());
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
