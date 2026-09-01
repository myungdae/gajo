import mongoose from 'mongoose';
import { documentHash, exactDocumentFilter } from './receipt32-restore-core.mjs';

const {EJSON,ObjectId}=mongoose.mongo.BSON;
export const CORE_TARGET=Object.freeze({_id:'6a881a4d4c8682c6391c3ca3',id:'core-hapcheon-합천영상테마파크',regionId:'hapcheon'});
export const CORE_BEFORE=Object.freeze({displayName:'합천영상테마파크',canonicalEntityId:'https://hapcheon.example/ontology#hapcheonGardenThemePark',aliases:['합천 영상테마파크','합천 정원테마파크'],expectedCategory:'TOURISM_NATURE',active:true});
export const CORE_AFTER=Object.freeze({displayName:'합천 영상테마파크',canonicalEntityId:'https://hapcheon.example/ontology#hapcheonVideoThemePark',aliases:['합천영상테마파크','영상테마파크'],expectedCategory:'TOURISM_NATURE',active:true});
export const CORE_RESTORE_FIELDS=Object.freeze(['displayName','canonicalEntityId','aliases','expectedCategory','active']);
const fail=message=>{throw new Error(`Receipt 32 core alignment refused: ${message}`)};
const equal=(a,b)=>EJSON.stringify(a,{relaxed:false})===EJSON.stringify(b,{relaxed:false});
const hasIdentity=(row,identity)=>Object.entries({...CORE_TARGET,...identity}).every(([key,value])=>key==='_id'?String(row?.[key])===value:equal(row?.[key],value));
const validateActor=(actorId,reason)=>{if(!/^[A-Za-z0-9:_-]{3,64}$/.test(actorId||''))fail('opaque actorId is required');if(typeof reason!=='string'||reason.trim().length<8||reason.length>240)fail('a concise reason is required')};
export function authorizeCoreOperation({operation='align',apply=false,confirm,approved}){const expected=operation==='restore'?['RESTORE_RECEIPT_32_CORE_6a881a4d','true']:['ALIGN_RECEIPT_32_CORE_6a881a4d','true'];if(apply&&(confirm!==expected[0]||approved!==expected[1]))fail(`${operation} confirmation is incomplete`);return apply}
const audit=(action,actorId,reason,preImageSha256,previous,newValue)=>({action,at:new Date().toISOString(),actorId,regionId:CORE_TARGET.regionId,reason:reason.trim(),preImageSha256,...(action.startsWith('RESTORE')?{restoredFields:[...CORE_RESTORE_FIELDS]}:{}),previous,newValue});
const hashMap=rows=>Object.fromEntries(rows.map(row=>[String(row._id),documentHash(row)]).sort(([a],[b])=>a.localeCompare(b)));
const verifyOtherCores=(rows,expected)=>{if(!equal(hashMap(rows),expected))fail('another core destination hash changed')};

export async function runCoreAlignment({collection,preImage,manifest,actorId,reason,apply=false,operation='align'}){
  validateActor(actorId,reason);if(documentHash(preImage)!==manifest.preImageSha256)fail('pre-image SHA-256 mismatch');if(!hasIdentity(preImage,CORE_BEFORE))fail('pre-image is not the fixed core before state');
  const rows=await collection.find({_id:new ObjectId(CORE_TARGET._id),id:CORE_TARGET.id,regionId:CORE_TARGET.regionId}).toArray();if(rows.length!==1)fail(`target count was ${rows.length}`);const current=rows[0];
  const duplicates=await collection.find({regionId:CORE_TARGET.regionId,displayName:operation==='restore'?CORE_BEFORE.displayName:CORE_AFTER.displayName}).toArray();if(duplicates.some(row=>String(row._id)!==CORE_TARGET._id))fail('a conflicting display-name row already exists');
  const otherRows=await collection.find({_id:{$ne:new ObjectId(CORE_TARGET._id)}}).toArray();verifyOtherCores(otherRows,manifest.otherCoreHashes);
  if(operation==='align'&&hasIdentity(current,CORE_AFTER)&&current.auditTrail?.at(-1)?.action==='CORE_DESTINATION_IDENTITY_ALIGNED'&&current.auditTrail.at(-1).preImageSha256===manifest.preImageSha256)return{mode:'ALREADY_ALIGNED',valid:true,target:CORE_TARGET,currentSha256:documentHash(current)};
  const expected=operation==='restore'?CORE_AFTER:CORE_BEFORE,next=operation==='restore'?Object.fromEntries(CORE_RESTORE_FIELDS.map(field=>[field,preImage[field]])):CORE_AFTER;
  if(!hasIdentity(current,expected))fail(`current document is not the expected ${operation} state`);const expectedVersion=operation==='restore'?manifest.expectedCurrentVersion:(manifest.preImageVersion??manifest.expectedCurrentVersion);if(Number(current.__v)!==Number(expectedVersion))fail('current __v mismatch');const expectedHash=operation==='restore'?manifest.expectedAlignedImageSha256:manifest.preImageSha256;if(documentHash(current)!==expectedHash)fail('current document SHA-256 mismatch');
  const event=operation==='restore'?audit('RESTORE_CORE_DESTINATION_IDENTITY',actorId,reason,manifest.preImageSha256,CORE_AFTER,CORE_BEFORE):audit('CORE_DESTINATION_IDENTITY_ALIGNED',actorId,reason,manifest.preImageSha256,CORE_BEFORE,CORE_AFTER);
  if(!apply)return{mode:'DRY_RUN',operation,valid:true,target:CORE_TARGET,currentSha256:documentHash(current),otherCoreHashes:manifest.otherCoreHashes,changes:next};
  const result=await collection.findOneAndUpdate(exactDocumentFilter(current),{$set:next,$push:{auditTrail:event},$inc:{__v:1}},{returnDocument:'after'}),after=result?.value??result;if(!after)fail('atomic compare-and-set matched 0 documents');if(!hasIdentity(after,operation==='restore'?CORE_BEFORE:CORE_AFTER)||after.auditTrail?.at(-1)?.action!==event.action)fail('post-update verification failed');
  const unchanged=await collection.find({_id:{$ne:new ObjectId(CORE_TARGET._id)}}).toArray();verifyOtherCores(unchanged,manifest.otherCoreHashes);return{mode:operation==='restore'?'RESTORED':'ALIGNED',valid:true,target:CORE_TARGET,postImageSha256:documentHash(after),otherCoreHashes:manifest.otherCoreHashes};
}
