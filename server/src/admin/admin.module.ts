import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SeedModule } from '../seed/seed.module';
import { OntologyModule } from '../ontology/ontology.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { ContextModule } from '../context/context.module';

@Module({
  imports: [SeedModule, OntologyModule, MasterDataModule, ContextModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
