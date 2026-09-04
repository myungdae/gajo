import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useRegionalLanguage } from '../RegionalLanguageContext';
import { channelLabel, channelQuery, type PublicChannel } from '../actionChannels';
import { bookingActionContext } from '../visitorAnalytics';
import { ensureTripSession } from '../tripSession';
import './action-channels.css';
export default function VerifiedChannelActions({regionId,placeKey,onKinds}:{regionId:string;placeKey:string;onKinds?:(kinds:string[])=>void}) {
  const {language}=useRegionalLanguage(),[rows,setRows]=useState<PublicChannel[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const pending=useRef(false), attempts=useRef(new Map<string,{at:number;event:unknown}>());
  useEffect(()=>{let active=true;setRows([]);setError('');attempts.current.clear();if(placeKey)api.get(`/action-channels/public?${channelQuery(regionId,placeKey)}`).then(({data})=>{if(active){setRows(data);onKinds?.(data.map((c:PublicChannel)=>c.kind))}}).catch(()=>{});return()=>{active=false}},[regionId,placeKey]);
  const open=async(channel:PublicChannel)=>{
    if(pending.current)return;pending.current=true;setBusy(true);setError('');
    // Open synchronously from the user's gesture; the destination comes only from the server.
    const popup=channel.kind==='PHONE'?null:window.open('about:blank','_blank');
    if(popup)popup.opener=null;
    try{
      const body:any={revision:channel.revision};let marker:string|null=null;
      try{
        const previous=attempts.current.get(channel.channelId);
        const event=previous&&Date.now()-previous.at<5000?previous.event:bookingActionContext(regionId,ensureTripSession(regionId).id,channel.placeKey,channel.channelId);
        attempts.current.set(channel.channelId,{at:Date.now(),event});body.event=event;
        marker=sessionStorage.getItem(`analytics-marker:${regionId}`);
      }catch{/* Analytics storage failure must not block the action. */}
      if (body.event) void api.post(`/action-channels/${channel.channelId}/click?${channelQuery(regionId,channel.placeKey)}`,body,{headers:marker?{'x-analytics-marker':marker}:{}}).catch(()=>{});
      const {data}=await api.post(`/action-channels/${channel.channelId}/outbound?${channelQuery(regionId,channel.placeKey)}`,body,{headers:marker?{'x-analytics-marker':marker}:{}});
      if(channel.kind==='PHONE'){window.location.assign(data.href)}else if(popup){popup.location.replace(data.href)}else{window.location.assign(data.href)}
    }catch{popup?.close();setError(language==='en'?'This link is unavailable. Please try again.':'현재 연결할 수 없습니다. 다시 시도해 주세요.')}finally{pending.current=false;setBusy(false)}
  };
  return <div className="verified-channel-actions" aria-label={language==='en'?'Verified place links':'검수된 장소 연결'} aria-busy={busy}>{rows.map(row=><button className={row.kind==='DIRECT_BOOKING'?'btn btn-primary':'btn btn-outline'} type="button" key={row.channelId} disabled={busy} onClick={()=>void open(row)}>{channelLabel(row,language)}</button>)}{error&&<p role="status">{error}</p>}</div>;
}
