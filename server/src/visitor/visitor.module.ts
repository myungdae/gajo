import { Module } from '@nestjs/common';
import { VisitorService } from './visitor.service';
import { VisitorController } from './visitor.controller';
import { SeedModule } from '../seed/seed.module';

@Module({
  imports: [SeedModule],
  providers: [VisitorService],
  controllers: [VisitorController],
  exports: [VisitorService],
})
export class VisitorModule {}
