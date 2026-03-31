import { Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { AnalysisService } from './analysis.service';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post('document/:id')
  analyzeByDocumentId(@Param('id', ParseIntPipe) id: number) {
    return this.analysisService.analyzeDocument(id);
  }
}
