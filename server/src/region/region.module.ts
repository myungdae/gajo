import{Global,Module}from'@nestjs/common';import{RegionConfigService}from'./region-config.service';import{RegionShareController}from'./region-share.controller';
@Global()@Module({providers:[RegionConfigService],controllers:[RegionShareController],exports:[RegionConfigService]})export class RegionModule{}
