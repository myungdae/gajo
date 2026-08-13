import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { Reservation, ReservationDocument } from '../schemas/reservation.schema';
import { GraphTraversalService } from '../context/graph-traversal.service';

/**
 * ReservationService: MVP mock reservation-availability + booking.
 * Availability is deterministically pseudo-randomized per facility+date so
 * demo runs are stable, while still modelling "requiresReservation"
 * (read from the ontology's gajo:requiresReservation literal) so the UI
 * can decide whether to show a reservation button at all.
 *
 * Swap-out path (explicitly scoped for later): replace `checkAvailability`
 * and `create` bodies with calls to gajo:reservationApiTool's real
 * `apiEndpoint`, keeping the same method signatures.
 */
@Injectable()
export class ReservationService {
  constructor(
    @InjectModel(Reservation.name) private model: Model<ReservationDocument>,
    private readonly traversal: GraphTraversalService,
  ) {}

  private pseudoRandomSlots(seed: string): string[] {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    const allSlots = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00'];
    return allSlots.filter((_, idx) => (hash >> idx) % 3 !== 0);
  }

  async checkAvailability(facilityUri: string, date?: string) {
    const literals = this.traversal.literalProps(facilityUri);
    const requiresReservation =
      literals.requiresReservation === 'true' ||
      // programs held at the facility that require reservation also imply the facility itself is bookable
      false;
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const availableSlots = this.pseudoRandomSlots(`${facilityUri}|${targetDate}`);
    return {
      facilityUri,
      facilityLabel: this.traversal.label(facilityUri),
      date: targetDate,
      requiresReservation,
      availableSlots,
      available: availableSlots.length > 0,
    };
  }

  async create(params: {
    visitorNo: string;
    facilityUri: string;
    programUri?: string;
    date: string;
    timeSlot?: string;
    partySize?: number;
    note?: string;
  }) {
    const reservationNo = `RSV-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const doc = await this.model.create({
      reservationNo,
      visitorNo: params.visitorNo,
      facilityUri: params.facilityUri,
      programUri: params.programUri,
      date: params.date,
      timeSlot: params.timeSlot,
      partySize: params.partySize || 1,
      status: 'confirmed',
      note: params.note,
    });
    return doc.toObject();
  }

  async listForVisitor(visitorNo: string) {
    return this.model.find({ visitorNo }).sort({ createdAt: -1 }).lean();
  }

  async listAll(limit = 100) {
    return this.model.find().sort({ createdAt: -1 }).limit(limit).lean();
  }

  async cancel(reservationNo: string) {
    return this.model.findOneAndUpdate({ reservationNo }, { status: 'cancelled' }, { new: true });
  }
}
