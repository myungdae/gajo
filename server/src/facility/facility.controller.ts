import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { FacilityService } from './facility.service';

@Controller('api')
export class FacilityController {
  constructor(private readonly service: FacilityService) {}

  @Get('facilities')
  listFacilities() {
    return this.service.listFacilities();
  }

  @Get('operational-places')
  operationalPlaces() {
    return this.service.operationalPlaces();
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
