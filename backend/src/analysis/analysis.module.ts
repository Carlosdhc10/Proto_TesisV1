import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WebSourceService } from './web-source.service';

@Module({
  imports: [PrismaModule],
  controllers: [AnalysisController],
  providers: [AnalysisService, WebSourceService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
