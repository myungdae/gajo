import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RegionalReportModule } from './regional-report.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/gajo',
      { autoIndex: false, autoCreate: false },
    ),
    RegionalReportModule,
  ],
})
export class RegionalNetworkMaintenanceModule {}
