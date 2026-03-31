import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './upload-document.dto';
import {
  AnalysisService,
  type AnalysisResponse,
} from '../analysis/analysis.service';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly analysisService: AnalysisService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      dest: './uploads',
      limits: { fileSize: 10000000 }, // 10MB
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDocumentDto,
  ): Promise<AnalysisResponse> {
    if (!body?.title?.trim()) {
      throw new BadRequestException('El titulo es obligatorio');
    }

    const { userId, title } = body;
    const numericUserId = Number(userId);
    if (Number.isNaN(numericUserId) || numericUserId <= 0) {
      throw new BadRequestException('userId invalido');
    }

    const savedDocument = await this.documentsService.saveDocument(
      file,
      numericUserId,
      title.trim(),
    );

    const analysisService: AnalysisService = this.analysisService;
    return analysisService.analyzeDocument(savedDocument.id);
  }
}
