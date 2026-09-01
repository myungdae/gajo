import { Body, Controller, Delete, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { AnonymousTripService } from './anonymous-trip.service';
@Controller('trips/anonymous')
export class AnonymousTripController {
  constructor(private readonly trips: AnonymousTripService) {}
  @Get(':id') get(
    @Param('id') id: string,
    @Query('regionId') regionId: string,
    @Headers('x-trip-owner-token') ownerToken: string,
  ) {
    return this.trips.get(id, regionId, ownerToken);
  }
  @Post('sync') sync(@Body() body: any, @Headers('x-trip-owner-token') ownerToken: string) {
    return this.trips.sync(body, ownerToken);
  }
  @Delete(':id') delete(@Param('id') id:string,@Query('regionId') regionId:string,@Headers('x-trip-owner-token') ownerToken:string){return this.trips.delete(id,regionId,ownerToken)}
}
