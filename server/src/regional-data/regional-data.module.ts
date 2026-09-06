import { BusinessRegistrationService } from './business-registration.service';
import { BusinessRegistrationController } from './business-registration.controller';
import { LocationReviewService } from './location-review.service';
import { AdminLocationReviewController } from './location-review.controller';
import{Global,Module}from'@nestjs/common';import{MongooseModule}from'@nestjs/mongoose';import{RegionalDataRecord,RegionalDataRecordSchema}from'./regional-data.schema';import{RegionalDataService}from'./regional-data.service';import{RegionalDataController}from'./regional-data.controller';import{AdminTokenGuard}from'./admin-token.guard';
@Global()@Module({imports:[MongooseModule.forFeature([{name:RegionalDataRecord.name,schema:RegionalDataRecordSchema}])],providers:[LocationReviewService,BusinessRegistrationService,RegionalDataService,AdminTokenGuard],controllers:[AdminLocationReviewController,BusinessRegistrationController,RegionalDataController],exports:[LocationReviewService,RegionalDataService,AdminTokenGuard]})export class RegionalDataModule{}
