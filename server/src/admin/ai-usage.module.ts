import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiUsageEvent, AiUsageEventSchema } from '../schemas/ai-usage-event.schema';
import { AiUsageLedgerService } from './ai-usage-ledger.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiUsageEvent.name, schema: AiUsageEventSchema },
    ]),
  ],
  providers: [AiUsageLedgerService],
  exports: [AiUsageLedgerService],
})
export class AiUsageModule {}