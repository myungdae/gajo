import { VisitorAnalyticsEvent,VisitorAnalyticsEventSchema,VisitorAnalyticsState,VisitorAnalyticsStateSchema,VisitorAnalyticsMarker,VisitorAnalyticsMarkerSchema } from './visitor-event.schema';
import { VisitorAnalyticsService } from './visitor-analytics.service';
import { VisitorAnalyticsController } from './visitor-analytics.controller';
import { Partner,PartnerSchema } from '../partner/partner.schema';
import{Module}from'@nestjs/common';import{MongooseModule}from'@nestjs/mongoose';import{PilotEvent,PilotEventSchema}from'../schemas/pilot-event.schema';import{AnalyticsService}from'./analytics.service';import{AnalyticsController}from'./analytics.controller';
import{RegionalDataModule}from'../regional-data/regional-data.module';import{PartnerModule}from'../partner/partner.module';
@Module({imports:[MongooseModule.forFeature([{name:PilotEvent.name,schema:PilotEventSchema},{name:VisitorAnalyticsEvent.name,schema:VisitorAnalyticsEventSchema},{name:Partner.name,schema:PartnerSchema},{name:VisitorAnalyticsState.name,schema:VisitorAnalyticsStateSchema},{name:VisitorAnalyticsMarker.name,schema:VisitorAnalyticsMarkerSchema}]),RegionalDataModule,PartnerModule],providers:[AnalyticsService,VisitorAnalyticsService],controllers:[AnalyticsController,VisitorAnalyticsController],exports:[AnalyticsService,VisitorAnalyticsService]})export class AnalyticsModule{}
