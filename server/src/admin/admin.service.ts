import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RuntimeContext, RuntimeContextDocument } from '../schemas/runtime-context.schema';
import { Recommendation, RecommendationDocument } from '../schemas/recommendation.schema';
import { Reservation, ReservationDocument } from '../schemas/reservation.schema';
import { OntologyIndividualDoc } from '../schemas/ontology-individual.schema';
import { OntologyGraphService } from '../ontology/ontology-graph.service';
import { MasterDataService } from '../master-data/master-data.service';

/**
 * AdminService: aggregate dashboard metrics + read access into the
 * ontology-derived operational data, for GET /api/admin/dashboard.
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectModel(RuntimeContext.name) private contextModel: Model<RuntimeContextDocument>,
    @InjectModel(Recommendation.name) private recModel: Model<RecommendationDocument>,
    @InjectModel(Reservation.name) private reservationModel: Model<ReservationDocument>,
    @InjectModel('FacilityModel') private facilityModel: Model<OntologyIndividualDoc>,
    @InjectModel('ProgramModel') private programModel: Model<OntologyIndividualDoc>,
    @InjectModel('AgentModel') private agentModel: Model<OntologyIndividualDoc>,
    private readonly graph: OntologyGraphService,
    private readonly masterData: MasterDataService,
  ) {}

  async dashboard() {
    const [contextCount, recCount, reservationCount, facilityCount, programCount, agentCount] = await Promise.all([
      this.contextModel.countDocuments(),
      this.recModel.countDocuments(),
      this.reservationModel.countDocuments(),
      this.facilityModel.countDocuments(),
      this.programModel.countDocuments(),
      this.agentModel.countDocuments(),
    ]);

    const recentContexts = await this.contextModel.find().sort({ createdAt: -1 }).limit(10).lean();
    const recentRecommendations = await this.recModel.find().sort({ createdAt: -1 }).limit(10).lean();
    const recentReservations = await this.reservationModel.find().sort({ createdAt: -1 }).limit(10).lean();

    return {
      totals: {
        runtimeContexts: contextCount,
        recommendations: recCount,
        reservations: reservationCount,
        facilities: facilityCount,
        programs: programCount,
        agents: agentCount,
        ontologyTriples: this.graph.size,
      },
      recentContexts,
      recentRecommendations,
      recentReservations,
      dataQuality: this.masterData.quality(),
    };
  }
}
