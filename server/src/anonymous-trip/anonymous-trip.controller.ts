import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AnonymousTripService } from './anonymous-trip.service';
@Controller('trips/anonymous')
export class AnonymousTripController {
  constructor(private readonly trips: AnonymousTripService) {}
  @Get(':id') get(
    @Param('id') id: string,
    @Query('regionId') regionId: string,
  ) {
    return this.trips.get(id, regionId);
  }
  @Post('sync') sync(@Body() body: any) {
    return this.trips.sync(body);
  }
}
