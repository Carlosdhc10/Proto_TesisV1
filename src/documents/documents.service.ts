import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Document } from '@prisma/client';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async saveDocument(
    file: Express.Multer.File,
    userId: number,
    title: string,
  ): Promise<Document> {
    return this.prisma.document.create({
      data: {
        title,
        filePath: file.path,
        userId,
      },
    });
  }
}
