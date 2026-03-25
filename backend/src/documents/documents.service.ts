import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { extractTextFromPDF } from './pdf.service';
import { splitIntoParagraphs } from '../analysis/text.utils';
import axios from 'axios'; // ⬅️ Nueva importación

type DetailedMatch = {
  documentId: number;
  title: string;
  similarity: number;
  text1: string;
  text2: string;
};

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async saveDocument(file: Express.Multer.File, userId: number, title: string) {
    try {
      console.log('1. Iniciando proceso...');

      // 1️⃣ Extraer texto del PDF
      const text: string = await extractTextFromPDF(file.path);
      if (!text || text.trim().length === 0) throw new Error('No se pudo extraer texto');

      // 2️⃣ Validar usuario
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('El usuario no existe');

      // 3️⃣ Obtener todos los textos de la base de datos para comparar
      const existingDocs = await this.prisma.document.findMany();
      const allBaseTexts = existingDocs.map(doc => doc.content);

      let aiSimilarity = 0;

      // 🔥 LLAMADA A LA IA (Python)
      // Solo si hay documentos previos en la BD
      if (allBaseTexts.length > 0) {
        console.log('🤖 Consultando a la IA (Puerto 5000)...');
        try {
          const response = await axios.post('http://localhost:5000/compare', {
            texto_nuevo: text,
            textos_base: allBaseTexts
          });
          aiSimilarity = response.data.similitud_ia;
          console.log(`✅ IA detectó: ${aiSimilarity}% de similitud semántica`);
        } catch (error) {
          console.error('❌ Error conectando con la IA de Python. ¿Está encendida?');
        }
      }

      // 4️⃣ Guardar el documento analizado en PostgreSQL
      const document = await this.prisma.document.create({
        data: {
          title,
          filePath: file.path,
          userId,
          content: text,
        },
      });

      // Estructuramos la respuesta para el Frontend
      return {
        message: 'Análisis de IA completado',
        document,
        // Enviamos el porcentaje que calculó la IA
        summary: [{
          title: "Similitud Semántica (IA)",
          similarity: aiSimilarity
        }],
        // Dejamos los matches vacíos por ahora o puedes mantener tu lógica anterior
        matches: aiSimilarity > 10 ? [{
            documentId: 0,
            title: "Detección por IA",
            similarity: aiSimilarity,
            text1: "Análisis semántico global realizado por Sentence-BERT",
            text2: "Comparado contra toda la base de datos"
        }] : [], 
      };

    } catch (error) {
      console.error('🔥 ERROR:', error);
      throw error;
    }
  }
}