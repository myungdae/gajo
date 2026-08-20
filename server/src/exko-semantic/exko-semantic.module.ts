import { Module } from '@nestjs/common';
import { ExkoSemanticAdapter } from './exko-semantic.service';
import { ExkoSemanticController } from './exko-semantic.controller';
@Module({
  providers: [ExkoSemanticAdapter],
  controllers: [ExkoSemanticController],
  exports: [ExkoSemanticAdapter],
})
export class ExkoSemanticModule {}
