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
