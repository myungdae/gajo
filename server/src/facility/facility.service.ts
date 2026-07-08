import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OntologyIndividualDoc } from '../schemas/ontology-individual.schema';

/**
 * FacilityService: CRUD over the Mongo-materialized `facilities` and
 * `programs` collections (see OntologySyncService). Reads/writes here
 * affect only the operational projection — the ontology graph itself
 * (source of truth for reasoning) is unaffected, so admin edits (e.g.
 * updating a facility's live capacity/comment) don't require touching the
 * .ttl files or restarting the ontology loader.
 */
@Injectable()
export class FacilityService {
  constructor(
    @InjectModel('FacilityModel') private facilityModel: Model<OntologyIndividualDoc>,
    @InjectModel('ProgramModel') private programModel: Model<OntologyIndividualDoc>,
  ) {}

  listFacilities() {
    return this.facilityModel.find().sort({ label: 1 }).lean();
  }

  getFacility(uri: string) {
    return this.facilityModel.findOne({ uri }).lean();
  }

  updateFacility(uri: string, patch: Partial<OntologyIndividualDoc>) {
    return this.facilityModel.findOneAndUpdate({ uri }, patch, { new: true });
  }

  createFacility(doc: Partial<OntologyIndividualDoc>) {
    return this.facilityModel.create(doc as any);
  }

  deleteFacility(uri: string) {
    return this.facilityModel.findOneAndDelete({ uri });
  }

  listPrograms() {
    return this.programModel.find().sort({ label: 1 }).lean();
  }

  getProgram(uri: string) {
    return this.programModel.findOne({ uri }).lean();
  }

  updateProgram(uri: string, patch: Partial<OntologyIndividualDoc>) {
    return this.programModel.findOneAndUpdate({ uri }, patch, { new: true });
  }

  createProgram(doc: Partial<OntologyIndividualDoc>) {
    return this.programModel.create(doc as any);
  }

  deleteProgram(uri: string) {
    return this.programModel.findOneAndDelete({ uri });
  }
}
