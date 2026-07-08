import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SeedModule } from '../seed/seed.module';
import { OntologyModule } from '../ontology/ontology.module';

@Module({
  imports: [SeedModule, OntologyModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
