import { Injectable,Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OntologyIndividualDoc } from '../schemas/ontology-individual.schema';
import { MasterDataService } from '../master-data/master-data.service';
import { HAPCHEON_MAP_PLACES, HAPCHEON_MASTER_DATA } from '../regions/hapcheon/master-data';
import { RegionalDataService } from '../regional-data/regional-data.service';

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
    private readonly masterData: MasterDataService,@Optional() private readonly regionalData?:RegionalDataService,
  ) {}

  async listFacilities(regionId='gajo') {
    if(regionId!=='gajo'){const dataset=this.regionalData?await this.regionalData.effectiveDataset(regionId):undefined;const records:any[]=dataset?.records||(regionId==='hapcheon'?[...HAPCHEON_MASTER_DATA]:[]);return records.map(place=>({uri:place.entityUri,label:place.canonicalLabelKo,comment:place.description,literalProps:{address:place.address,telephone:place.telephone,website:place.website,reservationUrl:place.reservationUrl,latitude:place.latitude,longitude:place.longitude,category:place.category,actions:place.actions},masterData:{verificationStatus:place.runtimeDataStatus,provenance:place.source,lastVerifiedAt:place.lastVerifiedAt}}))}
    const rows=await this.facilityModel.find().sort({ label: 1 }).lean();
    return rows.map(row=>this.enrich(row));
  }

  async operationalPlaces(regionId='gajo') {
    if(regionId!=='gajo'){const dataset=this.regionalData?await this.regionalData.effectiveDataset(regionId):undefined;const records:any[]=(dataset?.records||(regionId==='hapcheon'?[...HAPCHEON_MAP_PLACES]:[])).filter((place:any)=>place.actions?.navigate);return records.map(place=>({uri:place.entityUri,label:place.canonicalLabelKo,description:place.description,latitude:place.latitude,longitude:place.longitude,category:place.category,address:place.address,telephone:place.telephone,actions:place.actions,source:place.source,lastVerifiedAt:place.lastVerifiedAt,coordinateVerification:'VERIFIED'}))}
    return this.masterData.mapEligiblePlaces().map((place) => ({
      uri: place.entityUri, label: place.canonicalLabelKo, description: place.description,
      latitude: place.latitude, longitude: place.longitude, category: place.category,
      operatingHours: place.operatingHours, walkingBurden: place.walkingBurden,
      coordinateVerification: place.coordinateProvenance?.verificationStatus,
    }));
  }

  async getFacility(uri: string) {
    const row=await this.facilityModel.findOne({ uri }).lean(); return row?this.enrich(row):null;
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

  async listPrograms() {
    const rows=await this.programModel.find().sort({ label: 1 }).lean();return rows.map(row=>this.enrichProgram(row));
  }

  async getProgram(uri: string) {
    const row=await this.programModel.findOne({ uri }).lean();return row?this.enrichProgram(row):null;
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
  private enrich(row:any){const master=this.masterData.place(row.uri);if(!master)return row;return {...row,label:master.canonicalLabelKo,comment:master.description||row.comment,literalProps:{...row.literalProps,address:master.address,lotAddress:master.lotAddress,telephone:master.telephone,website:master.website,managementOrganization:master.managementOrganization,latitude:master.coordinateProvenance?.verificationStatus==='VERIFIED'?master.latitude:undefined,longitude:master.coordinateProvenance?.verificationStatus==='VERIFIED'?master.longitude:undefined,category:master.category,operatingHours:master.operatingHours,walkingBurden:master.walkingBurden,parking:master.parking,accessibilityNotes:master.accessibilityNotes},masterData:{canonicalId:master.canonicalId,verificationStatus:master.verificationStatus,provenance:master.detailsProvenance,fieldVerification:{coordinates:master.coordinateProvenance?.verificationStatus||'UNVERIFIED',address:master.addressProvenance?.verificationStatus||'UNVERIFIED',lotAddress:master.lotAddressProvenance?.verificationStatus||'UNVERIFIED',telephone:master.telephoneProvenance?.verificationStatus||'UNVERIFIED',operatingHours:master.operatingHours?.length&&master.operatingHours.every(h=>h.provenance.verificationStatus==='VERIFIED')?'VERIFIED':'UNVERIFIED'},coordinateProvenance:master.coordinateProvenance,sourceConflicts:master.sourceConflicts}}}
  private enrichProgram(row:any){const master=this.masterData.programs().find(p=>p.entityUri===row.uri);return master?{...row,programNature:master.nature,masterData:{provenance:master.provenance}}:row}
}
