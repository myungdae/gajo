import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OntologyModule } from '../ontology/ontology.module';
import { OntologySyncService } from './ontology-sync.service';
import { createIndividualSchema, ONTOLOGY_COLLECTIONS } from '../schemas/ontology-individual.schema';
import { Visitor, VisitorSchema } from '../schemas/visitor.schema';
import { Companion, CompanionSchema } from '../schemas/companion.schema';
import { VisitorGroup, VisitorGroupSchema } from '../schemas/visitor-group.schema';
import { Reservation, ReservationSchema } from '../schemas/reservation.schema';
import { Itinerary, ItinerarySchema } from '../schemas/itinerary.schema';
import { RuntimeContext, RuntimeContextSchema } from '../schemas/runtime-context.schema';
import { Recommendation, RecommendationSchema } from '../schemas/recommendation.schema';
import { ExecutionLog, ExecutionLogSchema } from '../schemas/execution-log.schema';

const individualModels = ONTOLOGY_COLLECTIONS.map(({ name, collection }) => ({
  name,
  schema: createIndividualSchema(),
  collection,
}));

@Module({
  imports: [
    OntologyModule,
    MongooseModule.forFeature([
      ...individualModels,
      { name: Visitor.name, schema: VisitorSchema },
      { name: Companion.name, schema: CompanionSchema },
      { name: VisitorGroup.name, schema: VisitorGroupSchema },
      { name: Reservation.name, schema: ReservationSchema },
      { name: Itinerary.name, schema: ItinerarySchema },
      { name: RuntimeContext.name, schema: RuntimeContextSchema },
      { name: Recommendation.name, schema: RecommendationSchema },
      { name: ExecutionLog.name, schema: ExecutionLogSchema },
    ]),
  ],
  providers: [OntologySyncService],
  controllers: [],
  exports: [MongooseModule],
})
export class SeedModule {}
