import{Body,Controller,Get,Post}from'@nestjs/common';import{AnalyticsService}from'./analytics.service';
@Controller('api/analytics')export class AnalyticsController{constructor(private service:AnalyticsService){}@Post('events')record(@Body()body:any){return this.service.record(body)}@Get('summary')summary(){return this.service.summary()}}
