import { Controller, Get, Query, Res, ServiceUnavailableException } from '@nestjs/common';
import type { Response } from 'express';
import { OntologyGraphService } from './ontology-graph.service';

/**
 * Ontology Explorer API — GET-only, read-only view into the in-memory
 * Runtime Operational Ontology graph. Powers the frontend "Ontology
 * Explorer" page (classes / object properties / individuals / raw
 * traversal), and doubles as a way to sanity-check that the TTL files
 * were loaded correctly.
 */
@Controller('api/ontology')
export class OntologyController {
  constructor(private readonly graph: OntologyGraphService) {}

  @Get('classes')
  classes() {
    return this.graph.listClasses();
  }

  @Get('properties')
  properties() {
    return this.graph.listProperties();
  }

  @Get('individuals')
  individuals() {
    return this.graph.listIndividuals();
  }

  @Get('query')
  query(
    @Query('subject') subject?: string,
    @Query('predicate') predicate?: string,
    @Query('object') object?: string,
  ) {
    return this.graph.query(subject || null, predicate || null, object || null);
  }

  @Get('traverse')
  traverse(@Query('start') start: string, @Query('predicate') predicate: string, @Query('depth') depth?: string) {
    return this.graph.traverse(start, predicate, depth ? parseInt(depth, 10) : 3);
  }

  @Get('expand')
  expand(@Query('uris') uris: string) {
    const list = (uris || '').split(',').filter(Boolean);
    return this.graph.expand(list);
  }

  @Get('raw.ttl')
  raw(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/turtle; charset=utf-8');
    res.send(this.graph.getRawTurtle());
  }

  @Get('stats')
  stats() {
    if (this.graph.size === 0) throw new ServiceUnavailableException('Ontology engine is not ready');
    return {
      totalTriples: this.graph.size,
      classCount: this.graph.listClasses().length,
      propertyCount: this.graph.listProperties().length,
      individualCount: this.graph.listIndividuals().length,
    };
  }
}
