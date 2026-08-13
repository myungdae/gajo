import { Module } from '@nestjs/common';import { OntologyModule } from '../ontology/ontology.module';import { MasterDataService } from './master-data.service';
@Module({imports:[OntologyModule],providers:[MasterDataService],exports:[MasterDataService]}) export class MasterDataModule{}
