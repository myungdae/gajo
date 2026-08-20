import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OntologyModule } from './ontology/ontology.module';
import { SeedModule } from './seed/seed.module';
import { ContextModule } from './context/context.module';
import { PlannerModule } from './planner/planner.module';
import { AgentsModule } from './agents/agents.module';
import { RecommendationModule } from './recommendation/recommendation.module';
import { ReservationModule } from './reservation/reservation.module';
import { FacilityModule } from './facility/facility.module';
import { PolicyModule } from './policy/policy.module';
import { AdminModule } from './admin/admin.module';
import { ConciergeModule } from './concierge/concierge.module';
import { VisitorModule } from './visitor/visitor.module';
import { DemoModule } from './demo/demo.module';
import { NearbyModule } from './nearby/nearby.module';
import { ReplanningModule } from './replanning/replanning.module';
import { RegionModule } from './region/region.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RegionalDataModule } from './regional-data/regional-data.module';
import { AnonymousTripModule } from './anonymous-trip/anonymous-trip.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/gajo',
    ),
    OntologyModule,
    SeedModule,
    ContextModule,
    PlannerModule,
    AgentsModule,
    RecommendationModule,
    ReservationModule,
    FacilityModule,
    PolicyModule,
    AdminModule,
    ConciergeModule,
    VisitorModule,
    DemoModule,
    NearbyModule,
    ReplanningModule,
    RegionModule,
    AnalyticsModule,
    RegionalDataModule,
    AnonymousTripModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
