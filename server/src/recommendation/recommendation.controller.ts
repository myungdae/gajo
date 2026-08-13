import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RuntimeContextService } from '../context/runtime-context.service';

@Controller('api/recommendations')
export class RecommendationController {
  constructor(
    private readonly recService: RecommendationService,
    private readonly contextService: RuntimeContextService,
  ) {}

  /**
   * POST /api/recommendations/itinerary
   * Body: either { contextNo } to build a recommendation for an already-
   * created RuntimeContext, or a full CreateContextInput to create the
   * context and immediately produce a recommendation in one call
   * (convenience for simple frontend flows / demo scenario).
   */
  @Post('itinerary')
  async itinerary(@Body() body: any) {
    let contextDoc: any = body.contextNo ? await this.contextService.getContext(body.contextNo) : null;
    let evidence: any[] = [];
    let firedRules: any[] = [];
    if (!contextDoc) {
      const result = await this.contextService.createContext(body);
      contextDoc = result.context;
      evidence = result.evidence;
      firedRules = result.firedRules;
    }
    const recommendation = await this.recService.buildRecommendation(contextDoc);
    return { context: contextDoc, evidence, firedRules, recommendation };
  }

  @Get(':recommendationNo')
  get(@Param('recommendationNo') recommendationNo: string) {
    return this.recService.getRecommendation(recommendationNo);
  }

  @Get('itinerary/:itineraryNo')
  getItinerary(@Param('itineraryNo') itineraryNo: string) {
    return this.recService.getItinerary(itineraryNo);
  }
}
