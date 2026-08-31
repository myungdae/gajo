import { createHash } from 'node:crypto';
import mongoose from 'mongoose';

const { EJSON, ObjectId } = mongoose.mongo.BSON;
export const TARGET=Object.freeze({_id:'6a851cbab346fbf150ee371f',id:'seed-hapcheon-garden-theme-park',regionId:'hapcheon',canonicalEntityId:'https://hapcheon.example/ontology#hapcheonGardenThemePark'});
export const NEIGHBORS=Object.freeze([{key:'video',canonicalEntityId:'https://hapcheon.example/ontology#hapcheonVideoThemePark'},{key:'festival',canonicalEntityId:'https://hapcheon.example/ontology#hwangmaesanSilverGrassFestival'},{key:'cPark',canonicalEntityId:'https://hapcheon.example/ontology#cPark'}]);
export const RESTORED_FIELDS=Object.freeze(['lifecycleStatus','detectedChanges','proposedFacts']);
const equal=(a,b)=>EJSON.stringify(a,{relaxed:false})===EJSON.stringify(b,{relaxed:false});
export const documentHash=document=>createHash('sha256').update(EJSON.stringify(document,{relaxed:false})).digest('hex');
export const exactDocumentFilter=document=>EJSON.parse(EJSON.stringify(document,{relaxed:false}),{relaxed:false});
const targetMatches=document=>document&&String(document._id)===TARGET._id&&['id','regionId','canonicalEntityId'].every(key=>document[key]===TARGET[key]);
const fail=message=>{throw new Error(`Receipt 32 restore refused: ${message}`)};
export function assertApplyAuthorization({apply=false,confirm,approved}){if(apply&&(confirm!=='RESTORE_RECEIPT_32_6a851cba'||approved!=='true'))fail('apply confirmation is incomplete');return apply}

export async function runIgnoreChangeDryRun({collection,preImage,manifest}){
  if(!targetMatches(preImage)||documentHash(preImage)!==manifest.preImageSha256)fail('IGNORE_CHANGE pre-image identity or SHA-256 mismatch');const rows=await collection.find({...TARGET,_id:new ObjectId(TARGET._id)}).toArray();if(rows.length!==1)fail(`target count was ${rows.length}`);const current=rows[0];if(documentHash(current)!==manifest.preImageSha256||Number(current.__v)!==Number(manifest.preImageVersion))fail('current document no longer matches the IGNORE_CHANGE pre-image');if(current.lifecycleStatus!=='CHANGE_DETECTED'||!current.proposedFacts||(current.detectedChanges||[]).length===0)fail('current document is not ready for IGNORE_CHANGE');
  for(const neighbor of NEIGHBORS){const found=await collection.find({regionId:TARGET.regionId,canonicalEntityId:neighbor.canonicalEntityId}).toArray();if(found.length!==1||documentHash(found[0])!==manifest[`${neighbor.key}Sha256`])fail(`${neighbor.key} SHA-256 mismatch`)}
  return{mode:'IGNORE_CHANGE_DRY_RUN',valid:true,target:TARGET,currentSha256:documentHash(current),expectedChanges:{lifecycleStatus:'ACTIVE',detectedChanges:[],proposedFacts:'REMOVE',auditAction:'IGNORE_CHANGE'}};
}

export function planReceipt32Restore({preImage,current,neighbors,manifest,actorId,reason}){
  if(!targetMatches(preImage)||!targetMatches(current))fail('fixed target identity mismatch');
  if(!/^[A-Za-z0-9:_-]{3,64}$/.test(actorId||''))fail('opaque actorId is required');
  if(typeof reason!=='string'||reason.trim().length<8||reason.length>240)fail('a concise restore reason is required');
  if(documentHash(preImage)!==manifest.preImageSha256)fail('pre-image SHA-256 mismatch');
  if(documentHash(current)!==manifest.expectedPostImageSha256)fail('expected post-image SHA-256 mismatch');
  if(Number(current.__v)!==Number(manifest.expectedCurrentVersion))fail('current __v mismatch');
  if(preImage.lifecycleStatus!=='CHANGE_DETECTED'||current.lifecycleStatus!=='ACTIVE'||current.proposedFacts!==undefined||(current.detectedChanges||[]).length!==0)fail('current state is not the expected IGNORE_CHANGE result');
  if(current.auditTrail?.at(-1)?.action!=='IGNORE_CHANGE')fail('latest audit event is not IGNORE_CHANGE');
  for(const neighbor of NEIGHBORS){const document=neighbors[neighbor.key];if(!document||document.canonicalEntityId!==neighbor.canonicalEntityId||document.regionId!==TARGET.regionId)fail(`${neighbor.key} identity mismatch`);if(documentHash(document)!==manifest[`${neighbor.key}Sha256`])fail(`${neighbor.key} SHA-256 mismatch`)}
  const restored=Object.fromEntries(RESTORED_FIELDS.map(field=>[field,preImage[field]]));
  const audit={action:'RESTORE_IGNORE_CHANGE',at:new Date().toISOString(),actorId,regionId:TARGET.regionId,reason:reason.trim(),preImageSha256:manifest.preImageSha256,restoredFields:[...RESTORED_FIELDS]};
  return{target:TARGET,expectedVersion:Number(current.__v),restored,audit,protectedFactsUnchanged:Object.keys(preImage).filter(key=>![...RESTORED_FIELDS,'auditTrail','updatedAt','__v'].includes(key)).every(key=>equal(preImage[key],current[key]))};
}

export async function runReceipt32Restore({collection,preImage,manifest,actorId,reason,apply=false}){
  const targetRows=await collection.find({...TARGET,_id:new ObjectId(TARGET._id)}).toArray();if(targetRows.length!==1)fail(`target count was ${targetRows.length}`);
  const neighbors={};for(const neighbor of NEIGHBORS){const rows=await collection.find({regionId:TARGET.regionId,canonicalEntityId:neighbor.canonicalEntityId}).toArray();if(rows.length!==1)fail(`${neighbor.key} count was ${rows.length}`);neighbors[neighbor.key]=rows[0]}
  const current=targetRows[0],plan=planReceipt32Restore({preImage,current,neighbors,manifest,actorId,reason});if(!plan.protectedFactsUnchanged)fail('protected canonical facts differ from pre-image');
  if(!apply)return{mode:'DRY_RUN',valid:true,target:TARGET,preImageSha256:manifest.preImageSha256,currentPostImageSha256:documentHash(current),neighborHashes:Object.fromEntries(NEIGHBORS.map(({key})=>[key,documentHash(neighbors[key])])),restoredFields:[...RESTORED_FIELDS]};
  const result=await collection.findOneAndUpdate(exactDocumentFilter(current),{$set:plan.restored,$push:{auditTrail:plan.audit},$inc:{__v:1}},{returnDocument:'after'}),after=result?.value??result;
  if(!after)fail('atomic compare-and-set matched 0 documents');
  for(const field of RESTORED_FIELDS)if(!equal(after[field],preImage[field]))fail(`${field} was not restored`);if(after.auditTrail?.at(-1)?.action!=='RESTORE_IGNORE_CHANGE')fail('restore audit missing');
  for(const neighbor of NEIGHBORS){const rows=await collection.find({regionId:TARGET.regionId,canonicalEntityId:neighbor.canonicalEntityId}).toArray();if(rows.length!==1||documentHash(rows[0])!==manifest[`${neighbor.key}Sha256`])fail(`${neighbor.key} changed during restore`)}
  return{mode:'APPLIED',valid:true,target:TARGET,preImageSha256:manifest.preImageSha256,restoredFields:[...RESTORED_FIELDS],postRestoreSha256:documentHash(after)};
}
