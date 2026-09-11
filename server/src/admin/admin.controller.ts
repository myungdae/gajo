import { Controller, Get } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ContextExtractionGateway } from '../context/context-extraction.gateway';
import { AiUsageLedgerService } from './ai-usage-ledger.service';

@Controller('api/admin')
export class AdminController {
  constructor(private readonly service: AdminService,private readonly extractionGateway:ContextExtractionGateway,private readonly aiUsageLedger:AiUsageLedgerService) {}

  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  @Get('context-extraction-metrics')
  contextExtractionMetrics(){ return this.extractionGateway.stats(); }
  @Get('ai-usage')
  aiUsage(){ return this.aiUsageLedger.summary(); }
}
