import { Controller, Get, Param, Query } from '@nestjs/common';
import { ExkoSemanticAdapter } from './exko-semantic.service';
@Controller('semantic/exko')
export class ExkoSemanticController {
  constructor(private readonly adapter: ExkoSemanticAdapter) {}
  @Get('inventory') inventory() {
    return this.adapter.inventory();
  }
  @Get('hapcheon/subgraph') subgraph() {
    return this.adapter.getHapcheonSubgraph('hapcheon');
  }
  @Get('hapcheon/entity/:uri') entity(
    @Param('uri') uri: string,
    @Query('depth') depth?: string,
  ) {
    return this.adapter.getSemanticNeighborhood(
      decodeURIComponent(uri),
      'hapcheon',
      Number(depth) || 1,
    );
  }
}
