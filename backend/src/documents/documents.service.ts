import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { extractTextFromPDF } from './pdf.service';
import { calculateSimilarity } from '../analysis/similarity.service';
import { splitIntoParagraphs } from '../analysis/text.utils';

type DetailedMatch = {
  documentId: number;
  title: string;
  similarity: number;
  text1: string;
  text2: string;
};

type SummaryResult = {
  documentId: number;
  title: string;
  similarity: number;
};

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async saveDocument(file: Express.Multer.File, userId: number, title: string) {
    try {
      console.log('1. Iniciando proceso...');

      // 1️⃣ Extraer texto
      console.log('2. Extrayendo texto...');
      const text: string = await extractTextFromPDF(file.path);

      if (!text || text.trim().length === 0) {
        console.log('❌ Texto vacío');
        throw new Error('No se pudo extraer texto del PDF');
      }

      console.log('2. Texto extraído');

      // 2️⃣ Validar usuario
      console.log('4. Validando usuario...');
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        console.log('❌ Usuario no existe');
        throw new Error('El usuario no existe');
      }

      console.log('3. Usuario válido');

      // 🔹 Dividir en párrafos
      const paragraphs: string[] = splitIntoParagraphs(text);

      console.log('4. Párrafos detectados:', paragraphs.length);

      // 3️⃣ Obtener documentos existentes
      console.log('6. Consultando documentos...');
      const existingDocs = await this.prisma.document.findMany();

      // 🔥 Comparación tipo Turnitin
      const detailedMatches: DetailedMatch[] = [];

      existingDocs.forEach((doc) => {
        if (typeof doc.content !== 'string') return;

        const docParagraphs: string[] = splitIntoParagraphs(doc.content);

        paragraphs.forEach((p1) => {
          docParagraphs.forEach((p2) => {
            const similarity: number = calculateSimilarity(p1, p2);

            if (similarity > 70) {
              detailedMatches.push({
                documentId: doc.id,
                title: doc.title,
                similarity,
                text1: p1,
                text2: p2,
              });
            }
          });
        });
      });

      console.log('5. Comparación por párrafos lista');

      // 🔹 Agrupar por documento
      const grouped: Record<number, { title: string; similarities: number[] }> =
        {};

      detailedMatches.forEach((match: DetailedMatch) => {
        if (!grouped[match.documentId]) {
          grouped[match.documentId] = {
            title: match.title,
            similarities: [],
          };
        }

        grouped[match.documentId].similarities.push(match.similarity);
      });

      // 🔹 Calcular promedio
      const summary: SummaryResult[] = Object.entries(grouped).map(
        ([docId, data]) => ({
          documentId: Number(docId),
          title: data.title,
          similarity:
            data.similarities.reduce((a, b) => a + b, 0) /
            data.similarities.length,
        }),
      );

      // 4️⃣ Guardar documento
      const document = await this.prisma.document.create({
        data: {
          title,
          filePath: file.path,
          userId,
          content: text,
        },
      });

      console.log('6. Documento guardado');

      return {
        message: 'Documento analizado tipo Turnitin',
        document,
        summary, // 🔹 resumen general
        matches: detailedMatches, // 🔥 detalle por párrafo
      };
    } catch (error) {
      console.error('🔥 ERROR:', error);
      throw error;
    }
  }
}
