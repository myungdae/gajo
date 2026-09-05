import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { CHANNEL_LABELS, channelQuery, type ChannelKind } from '../actionChannels';
import { actionChannelError } from '../adminActionFeedback';
import './action-channels.css';
const empty = () => ({kind:'DIRECT_BOOKING' as ChannelKind,labelKo:CHANNEL_LABELS.ko.DIRECT_BOOKING as string,labelEn:CHANNEL_LABELS.en.DIRECT_BOOKING as string,target:'',sourceUrl:'',reviewDueAt:new Date(Date.now()+90*86400000).toISOString().slice(0,10)});
export default function ActionChannelManager({regionId,placeKey,token}:{regionId:string;placeKey:string;token:string}) {
  const [rows,setRows]=useState<any[]>([]),[form,setForm]=useState(empty),[selected,setSelected]=useState<any>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false),[templates,setTemplates]=useState<any[]>([]),[sameAsTarget,setSameAsTarget]=useState(false);
  const query=channelQuery(regionId,placeKey), headers={'x-admin-token':token};
  const load=async()=>{const {data}=await api.get(`/action-channels/admin?${query}`,{headers});setRows(data)};
  useEffect(()=>{let active=true;setRows([]);setSelected(null);setSameAsTarget(false);setForm(empty());if(token)api.get(`/action-channels/admin?${query}`,{headers}).then(({data})=>{if(active)setRows(data)}).catch(()=>{if(active)setNotice('채널 조회 권한을 확인해 주세요.')});return()=>{active=false}},[query,token]);
  const run=async(action:string,row=selected)=>{if(busy)return;setBusy(true);setNotice('');try{
    if(action==='CREATE')await api.post(`/action-channels/admin?${query}`,form,{headers});
    else await api.post(`/action-channels/admin/${row.channelId}/${action}?${query}`,{revision:row.revision,...(action==='EDIT'?{fields:form}:{}),...(action==='VERIFY'?{confirmed}: {})},{headers});
    setSelected(null);setForm(empty());setConfirmed(false);await load();setNotice('반영했습니다. 수정 후에는 다시 검수하고 공개해야 합니다.');
  }catch(error){setNotice(actionChannelError(error))}finally{setBusy(false)}};
  const edit=(row:any)=>{setSelected(row);setConfirmed(false);setSameAsTarget(row.kind!=='PHONE'&&row.target===row.sourceUrl);setForm({kind:row.kind,labelKo:row.labelKo,labelEn:row.labelEn,target:row.target,sourceUrl:row.sourceUrl,reviewDueAt:row.reviewDueAt.slice(0,10)})};
  return <section className="action-channel-manager" aria-label="검증된 행동 채널 관리">
    <h3>예약·홈페이지·전화·지도 채널</h3><p>선택한 기존 장소에 연결합니다. 근거 확인 → 검수 완료 → 공개 순서입니다. 예약 채널은 추천 순위에 영향을 주지 않습니다.</p>
    {!token?<p>지역 관리자 인증이 필요합니다.</p>:<>
    <details><summary>검토 자료 가져오기 (선택)</summary><label>채널 검토 자료 불러오기 (JSON, 자동 등록·공개 없음)<input type="file" accept="application/json,.json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>50000)throw new Error();const pack=JSON.parse(await file.text());if(pack.regionId!==regionId||pack.canonicalEntityId!==placeKey||!Array.isArray(pack.channels)||pack.channels.length>20||pack.channels.some((c:any)=>!c||!Object.keys(CHANNEL_LABELS.ko).includes(c.kind)||[c.labelKo,c.labelEn,c.target,c.sourceUrl].some(v=>typeof v!=='string'||v.length>1000)))throw new Error();setTemplates(pack.channels);setNotice('자료의 채널을 선택한 뒤 근거를 확인하고 초안으로 등록하세요.')}catch{setNotice('선택한 지역·장소와 일치하는 검토 자료가 아닙니다.')}}}/></label>
    </details>{templates.map((item,i)=><button type="button" key={i} onClick={()=>{setSelected(null);setSameAsTarget(item.kind!=='PHONE'&&item.target===item.sourceUrl);setForm({...empty(),kind:item.kind,labelKo:item.labelKo,labelEn:item.labelEn,target:item.target,sourceUrl:item.sourceUrl})}}>검토 자료: {item.labelKo}</button>)}
    <form onSubmit={e=>{e.preventDefault();void run(selected?'EDIT':'CREATE')}}>
      <label>채널 종류<select value={form.kind} onChange={e=>{const kind=e.target.value as ChannelKind;setSameAsTarget(false);setForm({...form,kind,labelKo:CHANNEL_LABELS.ko[kind],labelEn:CHANNEL_LABELS.en[kind],sourceUrl:''})}}>{Object.entries(CHANNEL_LABELS.ko).map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}</select></label>
      <label>한국어 표시명<input required maxLength={80} value={form.labelKo} onChange={e=>setForm({...form,labelKo:e.target.value})}/></label>
      <label>영어 표시명<input required maxLength={80} value={form.labelEn} onChange={e=>setForm({...form,labelEn:e.target.value})}/></label>
      <label>공식 연결 URL 또는 전화번호<input required maxLength={1000} value={form.target} onChange={e=>setForm({...form,target:e.target.value,...(sameAsTarget?{sourceUrl:e.target.value}:{})})}/></label>
      {form.kind!=='PHONE'&&<label><input type="checkbox" checked={sameAsTarget} onChange={e=>{const checked=e.target.checked;setSameAsTarget(checked);setForm({...form,sourceUrl:checked?form.target:''})}}/> 이 연결 URL 자체가 공식 근거입니다</label>}
      <p>공식 홈페이지나 공식 지도 페이지처럼 연결 자체가 근거인 경우 선택하세요. 별도 예약 페이지라면 해당 업소임을 확인할 수 있는 공식 홈페이지나 공식 지도 주소를 입력하세요.</p>
      <label>공식 근거 URL<input required type="url" maxLength={1000} value={form.sourceUrl} readOnly={sameAsTarget} onChange={e=>setForm({...form,sourceUrl:e.target.value})}/></label>
      <label>재검수 기한<input required type="date" maxLength={1000} value={form.reviewDueAt} onChange={e=>setForm({...form,reviewDueAt:e.target.value})}/></label>
      <button className="btn btn-primary" disabled={busy}>{selected?'수정 저장 · 공개 해제':'초안 등록'}</button><button type="button" className="btn btn-outline" onClick={()=>{setSelected(null);setSameAsTarget(false);setForm(empty())}}>새 채널 작성</button>
    </form>
    <p>관광객 화면 미리보기 — 아직 공개되지 않은 작성 내용입니다.</p><div className="channel-preview"><button type="button" disabled>{form.labelKo}</button><button type="button" disabled>{form.labelEn}</button></div>
    <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>저장된 연결을 시험했고 공식 근거에서 같은 업체·주소·예약 대상을 확인했습니다.</label>
    {rows.map(row=><article key={row.channelId}><h4>{row.labelKo} / {row.labelEn}</h4><p>{new Date(row.reviewDueAt)<=new Date()?'재확인 필요':({DRAFT:'검증 대기',REVIEW_REQUIRED:'확인 필요',VERIFIED:'검수 완료',SUSPENDED:'운영 중지'} as Record<string,string>)[row.verificationStatus]||'확인 필요'} · {row.published&&row.verificationStatus==='VERIFIED'&&new Date(row.reviewDueAt)>new Date()?'공개':'비공개'} · {new Date(row.reviewDueAt)<=new Date()?'재검수 필요':'검수 기한'}: {row.reviewDueAt.slice(0,10)}</p><p className="channel-target">{row.target}</p>
      <a href={row.kind==='PHONE'?`tel:${row.target.replace(/[^+0-9]/g,'')}`:row.target} target="_blank" rel="noopener noreferrer">저장된 연결 시험 (새 창)</a>{' · '}<a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">공식 근거 확인 (새 창)</a>
      <div className="channel-controls"><button type="button" disabled={busy} onClick={()=>edit(row)}>편집</button><button type="button" disabled={busy||!confirmed} onClick={()=>void run('VERIFY',row)}>검수 완료</button><button type="button" disabled={busy||row.verificationStatus!=='VERIFIED'||new Date(row.reviewDueAt)<=new Date()} onClick={()=>void run('PUBLISH',row)}>공개</button><button type="button" disabled={busy} onClick={()=>void run('SUSPEND',row)}>중지</button></div>
      <details><summary>검수·공개 감사 이력</summary>{row.audit.map((a:any,i:number)=><p key={i}>{a.at} · {a.actorId} · {a.action} · 버전 {a.revision}</p>)}</details>
    </article>)}
    </>}
    <p role="status">{notice}</p>
  </section>;
}
