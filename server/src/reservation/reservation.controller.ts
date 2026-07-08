import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ReservationService } from './reservation.service';

@Controller('api/reservations')
export class ReservationController {
  constructor(private readonly service: ReservationService) {}

  @Post('check')
  check(@Body() body: { facilityUri: string; date?: string }) {
    return this.service.checkAvailability(body.facilityUri, body.date);
  }

  @Post('create')
  create(
    @Body()
    body: {
      visitorNo: string;
      facilityUri: string;
      programUri?: string;
      date: string;
      timeSlot?: string;
      partySize?: number;
      note?: string;
    },
  ) {
    return this.service.create(body);
  }

  @Get()
  listAll(@Query('visitorNo') visitorNo?: string) {
    if (visitorNo) return this.service.listForVisitor(visitorNo);
    return this.service.listAll();
  }

  @Post(':reservationNo/cancel')
  cancel(@Param('reservationNo') reservationNo: string) {
    return this.service.cancel(reservationNo);
  }
}
