import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { extractTextFromPDF } from './pdf.service';
import axios from 'axios';

// 1️⃣ Definimos la forma de los datos que vienen de Python
interface DetalleIA {
  texto: string;
  similitud: number;
  referencia: string;
}

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async saveDocument(file: Express.Multer.File, userId: number, title: string) {
    try {
      console.log('1. Extrayendo texto del PDF...');
      const text: string = await extractTextFromPDF(file.path);
      
      if (!text || text.trim().length === 0) throw new Error('PDF vacío');

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('Usuario no encontrado');

      const existingDocs = await this.prisma.document.findMany();
      const allBaseTexts = existingDocs.map(doc => doc.content);

      let aiSimilarity = 0;
      // 2️⃣ Le decimos que es una lista de nuestro tipo DetalleIA
      let analisisDetallado: DetalleIA[] = [];

      if (allBaseTexts.length > 0) {
        console.log('🤖 Enviando a IA para análisis frase por frase...');
        try {
          const response = await axios.post('http://localhost:5000/compare', {
            texto_nuevo: text,
            textos_base: allBaseTexts
          });

          aiSimilarity = response.data.similitud_ia;
          analisisDetallado = response.data.analisis_detallado;
          
          console.log(`✅ Análisis finalizado. Similitud global: ${aiSimilarity}%`);
        } catch (error) {
          console.error('❌ La IA de Python no respondió.');
        }
      }

      const document = await this.prisma.document.create({
        data: {
          title,
          filePath: file.path,
          userId,
          content: text,
        },
      });

      return {
        message: 'Análisis detallado completado',
        document,
        summary: [{
          title: "Similitud Semántica (IA)",
          similarity: aiSimilarity
        }],
        // 3️⃣ Ahora TypeScript ya sabe qué es "item" y no dará error
        matches: analisisDetallado.map((item, index) => ({
          documentId: index,
          title: item.similitud > 80 ? "Coincidencia Exacta" : "Parafraseo Detectado",
          similarity: item.similitud,
          text1: item.texto,
          text2: item.referencia
        }))
      };

    } catch (error) {
      console.error('🔥 Error en el servicio:', error);
      throw error;
    }
  }
}