import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { VisitorService } from './visitor.service';

@Controller('api/visitors')
export class VisitorController {
  constructor(private readonly service: VisitorService) {}

  @Post()
  create(@Body() body: any) {
    return this.service.createVisitor(body);
  }

  @Get()
  list() {
    return this.service.listVisitors();
  }

  @Get(':visitorNo')
  get(@Param('visitorNo') visitorNo: string) {
    return this.service.getVisitor(visitorNo);
  }

  @Post(':visitorNo/companions')
  addCompanion(@Param('visitorNo') visitorNo: string, @Body() body: any) {
    return this.service.addCompanion(visitorNo, body);
  }

  @Get(':visitorNo/companions')
  listCompanions(@Param('visitorNo') visitorNo: string) {
    return this.service.listCompanions(visitorNo);
  }
}
