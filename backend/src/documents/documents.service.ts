import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type Document as PrismaDocument } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { extractTextFromPDF } from './pdf.service';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async saveDocument(
    file: Express.Multer.File,
    userId: number,
    title: string,
  ): Promise<PrismaDocument> {
    if (!file) {
      throw new BadRequestException('Debes enviar un archivo PDF');
    }

    const text: string = await extractTextFromPDF(file.path);
    if (!text || text.trim().length === 0) {
      throw new BadRequestException('No se pudo extraer texto del PDF');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('El usuario no existe');
    }

    return this.prisma.document.create({
      data: {
        title,
        filePath: file.path,
        userId,
        content: text,
      },
    });
  }
}
