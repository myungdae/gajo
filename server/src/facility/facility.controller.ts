import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { FacilityService } from './facility.service';

@Controller('api')
export class FacilityController {
  constructor(private readonly service: FacilityService) {}

  @Get('facilities')
  listFacilities(@Query('regionId') regionId?:string) {
    if(!regionId)throw new BadRequestException('regionId is required');
    return this.service.listFacilities(regionId);
  }

  @Get('operational-places')
  operationalPlaces(@Query('regionId') regionId?:string) {
    if(!regionId)throw new BadRequestException('regionId is required');
    return this.service.operationalPlaces(regionId);
  }

  @Get('facilities/:uri')
  getFacility(@Param('uri') uri: string) {
    return this.service.getFacility(decodeURIComponent(uri));
  }

  @Get('programs')
  listPrograms() {
    return this.service.listPrograms();
  }

  @Get('programs/:uri')
  getProgram(@Param('uri') uri: string) {
    return this.service.getProgram(decodeURIComponent(uri));
  }

  // --- Admin CRUD (mirrored under /api/admin/*) ---

  @Post('admin/facilities')
  createFacility(@Body() body: any) {
    return this.service.createFacility(body);
  }

  @Put('admin/facilities/:uri')
  updateFacility(@Param('uri') uri: string, @Body() body: any) {
    return this.service.updateFacility(decodeURIComponent(uri), body);
  }

  @Delete('admin/facilities/:uri')
  deleteFacility(@Param('uri') uri: string) {
    return this.service.deleteFacility(decodeURIComponent(uri));
  }

  @Post('admin/programs')
  createProgram(@Body() body: any) {
    return this.service.createProgram(body);
  }

  @Put('admin/programs/:uri')
  updateProgram(@Param('uri') uri: string, @Body() body: any) {
    return this.service.updateProgram(decodeURIComponent(uri), body);
  }

  @Delete('admin/programs/:uri')
  deleteProgram(@Param('uri') uri: string) {
    return this.service.deleteProgram(decodeURIComponent(uri));
  }
}
