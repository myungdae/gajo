import { lstat, readFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import mongoose from 'mongoose';
import { assertApplyAuthorization, runReceipt32Restore } from './receipt32-restore-core.mjs';

const value=name=>{const index=process.argv.indexOf(name);return index<0?undefined:process.argv[index+1]};
const apply=assertApplyAuthorization({apply:process.argv.includes('--apply'),confirm:value('--confirm'),approved:process.env.RECEIPT32_RESTORE_APPROVED});
const privateRoot=await realpath(resolve(process.cwd(),'.maintenance-private','receipt32'));
const loadPrivate=async name=>{const requested=resolve(value(name)||'');const actual=await realpath(requested);if(!actual.startsWith(`${privateRoot}${sep}`))throw new Error(`${name} must be inside the restricted receipt32 directory`);if(!(await lstat(actual)).isFile())throw new Error(`${name} must be a regular file`);return JSON.parse(await readFile(actual,'utf8'))};
const preImage=mongoose.mongo.BSON.EJSON.parse(JSON.stringify(await loadPrivate('--pre-image')),{relaxed:false}),manifest=await loadPrivate('--manifest');
const actorId=value('--actor'),reason=value('--reason'),uri=process.env.MONGODB_URI;if(!uri)throw new Error('MONGODB_URI is required');
try{await mongoose.connect(uri,{autoIndex:false,autoCreate:false});const collection=mongoose.connection.db?.collection(manifest.collection);if(!collection)throw new Error('Configured collection is unavailable');let result;if(apply){const session=await mongoose.connection.startSession();try{await session.withTransaction(async()=>{result=await runReceipt32Restore({collection,preImage,manifest,actorId,reason,apply:true,session})})}finally{await session.endSession()}}else result=await runReceipt32Restore({collection,preImage,manifest,actorId,reason});process.stdout.write(`${JSON.stringify(result,null,2)}\n`)}catch(error){const safe=String(error?.message||'unknown error').replace(/mongodb(?:\+srv)?:\/\/\S+/gi,'[REDACTED_MONGODB_URI]');process.stderr.write(`Receipt 32 restore failed: ${safe}\n`);process.exitCode=1}finally{await mongoose.disconnect()}
