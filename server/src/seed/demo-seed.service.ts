import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { RuntimeContextService } from '../context/runtime-context.service';
import { GraphTraversalService } from '../context/graph-traversal.service';
import { AgentOrchestratorService } from '../agents/agent-orchestrator.service';
import { Itinerary, ItineraryDocument } from '../schemas/itinerary.schema';
import { gajo } from '../ontology/ontology.constants';

/** A deterministic, ontology-labelled snapshot used only to demonstrate runtime re-planning. */
@Injectable()
export class DemoSeedService {
  constructor(
    private readonly contextService: RuntimeContextService,
    private readonly orchestrator: AgentOrchestratorService,
    private readonly traversal: GraphTraversalService,
    @InjectModel(Itinerary.name) private readonly itineraryModel: Model<ItineraryDocument>,
  ) {}

  async runDemoScenario() {
    const { context, evidence, firedRules } = await this.contextService.createContext({
      regionId: 'gajo',
      rawMessage: '58세 방문객이 무릎이 불편한 78세 어머님과 자동차로 방문합니다. 현재 날씨는 맑고 오후 5시까지 머물 예정입니다.',
      visitorAge: 58,
      wellnessGoals: ['familyHealingTrip'],
      companions: [{ age: 78, relationship: 'mother', healthConditions: ['kneePain', 'limitedMobility'] }],
      weather: 'clearWeather',
      currentTime: '10:00',
      currentDate: '2026-08-09',
      dayOfWeek: 'Sunday',
      precipitation: 0,
      transportMode: 'CAR',
      stayUntil: '17:00',
      walkingLevel: 'LOW',
      companionConstraints: ['elderlyCompanion', 'kneePain', 'shortWalkingDistance'],
    });
    if (!context.operationUri) return { context, evidence, firedRules, error: 'no operation resolved' };

    const runResult = await this.orchestrator.run(context.contextNo, context.operationUri, context);
    if (runResult.recommendation?.itineraryNo) {
      const itinerary = await this.itineraryModel.findOneAndUpdate(
        { itineraryNo: runResult.recommendation.itineraryNo },
        { $set: { label: '런타임 재계획 시연 일정', steps: this.buildRuntimeDemoSteps() } },
        { new: true },
      ).lean();
      if (itinerary) {
        runResult.recommendation.itinerary = itinerary;
        runResult.recommendation.recommendedPrograms = [gajo('lowIntensityHotSpringCourse'), gajo('localFoodHealingMeal')];
        runResult.recommendation.recommendedFacilities = [gajo('indoorHotSpringBath'), gajo('localFoodRestaurant'), gajo('healingWalkingTrail'), gajo('wellnessLounge')];
        runResult.recommendation.reasonSummary = '맑은 날씨와 짧은 보행 선호를 고려한 초기 일정입니다. 오후 야외 활동은 런타임 날씨 변화에 따라 다시 평가됩니다.';
      }
    }
    return { context, evidence, firedRules, runResult };
  }

  private buildRuntimeDemoSteps() {
    const makeStep = (order: number, status: 'COMPLETED' | 'PLANNED', facilityLocal: string, programLocal: string | undefined, durationMinutes: number) => {
      const facilityUri = gajo(facilityLocal);
      const programUri = programLocal ? gajo(programLocal) : undefined;
      const primaryLabel = programUri ? this.traversal.label(programUri) : this.traversal.label(facilityUri);
      return {
        itemId: `DEMO-${randomUUID().slice(0, 8)}`,
        order,
        label: `${order}단계: ${primaryLabel}`,
        facilityUri,
        facilityLabel: this.traversal.label(facilityUri),
        programUri,
        programLabel: primaryLabel,
        durationMinutes,
        requiresReservation: programLocal === 'localFoodHealingMeal',
        status,
      };
    };
    return [
      makeStep(1, 'COMPLETED', 'indoorHotSpringBath', 'lowIntensityHotSpringCourse', 60),
      makeStep(2, 'COMPLETED', 'localFoodRestaurant', 'localFoodHealingMeal', 60),
      makeStep(3, 'PLANNED', 'healingWalkingTrail', undefined, 45),
      makeStep(4, 'PLANNED', 'wellnessLounge', undefined, 30),
    ];
  }
}
