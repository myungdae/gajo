import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActionChannel, ActionChannelSchema } from './action-channel.schema';
import { ActionChannelService } from './action-channel.service';
import { ActionChannelController } from './action-channel.controller';
import { ChannelOutboundService } from './channel-outbound.service';
import { RegionalDataModule } from '../regional-data/regional-data.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PartnerModule } from '../partner/partner.module';
@Module({ imports: [MongooseModule.forFeature([{name: ActionChannel.name, schema: ActionChannelSchema}]), RegionalDataModule, AnalyticsModule, PartnerModule], providers: [ActionChannelService, ChannelOutboundService], controllers: [ActionChannelController] })
export class ActionChannelModule {}
