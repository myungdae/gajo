import mongoose from'mongoose';
import{CORE_AFTER,CORE_BEFORE,CORE_TARGET}from'./receipt32-core-align-core.mjs';
import{documentHash,NEIGHBORS,TARGET}from'./receipt32-restore-core.mjs';
const{ObjectId}=mongoose.mongo.BSON;
export const COLLECTIONS=Object.freeze({core:'coredestinations',regional:'regionaldatarecords'});
const requiredIndexes=Object.freeze({core:[['id_1',{id:1}],['regionId_1_displayName_1',{regionId:1,displayName:1}]],regional:[['id_1',{id:1}],['regionId_1_canonicalEntityId_1',{regionId:1,canonicalEntityId:1}]]});
const fail=m=>{throw new Error(`Receipt 32 capture refused: ${m}`)},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function indexes(collection,kind){const rows=await collection.indexes();for(const[name,key]of requiredIndexes[kind]){const found=rows.find(x=>x.name===name);if(!found?.unique||!same(found.key,key))fail(`${kind} index ${name} mismatch`)}}
const hashMap=rows=>Object.fromEntries(rows.map(x=>[String(x._id),documentHash(x)]).sort(([a],[b])=>a.localeCompare(b)));
export async function captureBefore({coreCollection,regionalCollection}){
 await indexes(coreCollection,'core');await indexes(regionalCollection,'regional');
 const cores=await coreCollection.find({_id:new ObjectId(CORE_TARGET._id),id:CORE_TARGET.id,regionId:CORE_TARGET.regionId}).toArray();if(cores.length!==1)fail(`core target count was ${cores.length}`);
 const core=cores[0];for(const[k,v]of Object.entries(CORE_BEFORE))if(!same(core[k],v))fail(`core before ${k} mismatch`);
 const duplicate=await coreCollection.find({regionId:CORE_TARGET.regionId,displayName:CORE_AFTER.displayName}).toArray();if(duplicate.some(x=>String(x._id)!==CORE_TARGET._id))fail('new core display name is not unique');
 const gardens=await regionalCollection.find({_id:new ObjectId(TARGET._id),id:TARGET.id,regionId:TARGET.regionId,canonicalEntityId:TARGET.canonicalEntityId}).toArray();if(gardens.length!==1)fail(`garden target count was ${gardens.length}`);const garden=gardens[0];
 const neighborHashes={};for(const n of NEIGHBORS){const rows=await regionalCollection.find({regionId:TARGET.regionId,canonicalEntityId:n.canonicalEntityId}).toArray();if(rows.length!==1)fail(`${n.key} count was ${rows.length}`);neighborHashes[`${n.key}Sha256`]=documentHash(rows[0])}
 const others=await coreCollection.find({_id:{$ne:new ObjectId(CORE_TARGET._id)}}).toArray();
 return{documents:{core,garden},files:{'core-align-manifest.json':{collection:COLLECTIONS.core,preImageSha256:documentHash(core),expectedCurrentVersion:core.__v,otherCoreHashes:hashMap(others)},'garden-ignore-manifest.json':{collection:COLLECTIONS.regional,preImageSha256:documentHash(garden),preImageVersion:garden.__v,...neighborHashes}},summary:{coreTargetCount:1,gardenTargetCount:1,newCoreNameCount:duplicate.length,otherCoreCount:others.length,valid:true}};
}
