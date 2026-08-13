import { Controller, Get } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ContextExtractionGateway } from '../context/context-extraction.gateway';

@Controller('api/admin')
export class AdminController {
  constructor(private readonly service: AdminService,private readonly extractionGateway:ContextExtractionGateway) {}

  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  @Get('context-extraction-metrics')
  contextExtractionMetrics(){ return this.extractionGateway.stats(); }
}
