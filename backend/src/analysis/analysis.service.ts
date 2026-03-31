import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { calculateSimilarity } from './similarity.service';
import { splitIntoParagraphs } from './text.utils';

export type AnalysisSource = {
  documentId: number;
  title: string;
  similarity: number;
};

export type AnalysisMatch = {
  documentId: number;
  title: string;
  similarity: number;
  text1: string;
  text2: string;
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

@Injectable()
export class AnalysisService {
  constructor(private readonly prisma: PrismaService) {}

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

    const otherDocuments = await this.prisma.document.findMany({
      where: { id: { not: documentId } },
    });

    if (!otherDocuments.length) {
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

    const summary: AnalysisSource[] = [];
    for (const sourceDocument of otherDocuments) {
      const sourceText = sourceDocument.content?.trim() || '';
      if (!sourceText) continue;

      const lexicalSimilarity = calculateSimilarity(targetText, sourceText);
      const semanticSimilarity = await this.getSemanticSimilarity(targetText, sourceText);

      const hybridSimilarity = (semanticSimilarity * 0.7) + (lexicalSimilarity * 0.3);
      summary.push({
        documentId: sourceDocument.id,
        title: sourceDocument.title,
        similarity: this.round(hybridSimilarity),
      });
    }

    summary.sort((a, b) => b.similarity - a.similarity);

    const matches = this.buildParagraphMatches(targetText, otherDocuments);
    const overallSimilarity = summary.length
      ? this.round(summary.reduce((acc, item) => acc + item.similarity, 0) / summary.length)
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

  private buildParagraphMatches(
    targetText: string,
    sourceDocuments: Array<{ id: number; title: string; content: string | null }>,
  ): AnalysisMatch[] {
    const paragraphs = splitIntoParagraphs(targetText).slice(0, 25);
    const matches: AnalysisMatch[] = [];

    for (const paragraph of paragraphs) {
      let bestMatch: AnalysisMatch | null = null;

      for (const sourceDocument of sourceDocuments) {
        const sourceText = sourceDocument.content?.trim() || '';
        if (!sourceText) continue;

        const similarity = calculateSimilarity(paragraph, sourceText);
        if (similarity < 30) continue;

        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = {
            documentId: sourceDocument.id,
            title: sourceDocument.title,
            similarity: this.round(similarity),
            text1: paragraph,
            text2: sourceText.slice(0, 180),
          };
        }
      }

      if (bestMatch) {
        matches.push(bestMatch);
      }
    }

    return matches.slice(0, 12);
  }

  private async getSemanticSimilarity(text1: string, text2: string): Promise<number> {
    try {
      const response = await axios.post(
        'http://localhost:5000/compare',
        {
          texto_nuevo: text1,
          textos_base: [text2],
        },
        {
          timeout: 9000,
        },
      );

      const payload = response.data as { similitud_ia?: number };
      return this.round(payload.similitud_ia || 0);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error IA semantica:', error.message);
      } else {
        console.error('Error IA semantica desconocido');
      }
      return 0;
    }
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
