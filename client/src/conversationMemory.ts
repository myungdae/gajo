type Storage = Pick<globalThis.Storage,'getItem'|'setItem'>;
const key=(regionId:string,tripId:string,mode:string)=>'regional-conversation-v1:'+regionId+':'+tripId+':'+mode;
export function readConversation<T>(storage:Storage,regionId:string,tripId:string,mode:string,now=Date.now()):T|undefined{
  try{
    const record=JSON.parse(storage.getItem(key(regionId,tripId,mode))||'null');
    if(record?.regionId===regionId&&record.tripId===tripId&&record.mode===mode&&now-record.savedAt<24*60*60*1000&&now>=record.savedAt)return record.value;
  }catch{/* Storage is optional. */}
}
export function saveConversation<T>(storage:Storage,regionId:string,tripId:string,mode:string,value:T){
  try{storage.setItem(key(regionId,tripId,mode),JSON.stringify({regionId,tripId,mode,savedAt:Date.now(),value}));}catch{/* Conversation remains in React state. */}
}

const normalizedMessage=(value:unknown)=>String(value||'').trim().replace(/\s+/g,' ');

export function shouldAutoSubmitEntry(initialMessage:string|undefined,messages:Array<{role:string;text?:string;result?:unknown}>|undefined){
  const requested=normalizedMessage(initialMessage);
  if(!requested)return false;
  const history=messages||[];
  for(let index=history.length-1;index>=0;index-=1){
    const message=history[index];
    if(message.role!=='user'||normalizedMessage(message.text)!==requested)continue;
    return !history.slice(index+1).some(item=>item.role==='ai'&&Boolean(item.result));
  }
  return true;
}
