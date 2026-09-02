import { useEffect, useState } from 'react';
import { useRegion } from '../RegionContext';
import { companionSharePayload, fallbackRegionalShare, initializeKakaoShare } from '../shareConfig';
import './CompanionShare.css';

declare global {
  interface Window {
    Kakao?: { isInitialized():boolean; init(key:string):void; Share?:{sendDefault(input:unknown):void} };
  }
}
type KakaoState='UNCONFIGURED'|'LOADING'|'READY'|'FAILED';

export default function CompanionShare() {
  const region=useRegion(),payload=companionSharePayload(region),kakaoKey=import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY?.trim();
  const [open,setOpen]=useState(false),[notice,setNotice]=useState('');
  const [kakaoState,setKakaoState]=useState<KakaoState>(kakaoKey?'LOADING':'UNCONFIGURED');

  useEffect(()=>{
    if(!open||!kakaoKey){setKakaoState(kakaoKey?'LOADING':'UNCONFIGURED');return}
    const ready=()=>setKakaoState(initializeKakaoShare(window.Kakao,kakaoKey)?'READY':'FAILED');
    const existing=document.querySelector<HTMLScriptElement>('script[data-kakao-sdk]');
    if(existing){ready();return}
    const script=document.createElement('script');
    script.src='https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';script.crossOrigin='anonymous';script.dataset.kakaoSdk='true';
    script.onload=ready;script.onerror=()=>setKakaoState('FAILED');document.head.appendChild(script);
  },[open,kakaoKey]);

  const fallback=async()=>{try{const result=await fallbackRegionalShare(payload,navigator);setNotice(result==='SHARED'?'기본 공유 화면을 열었습니다.':'링크를 복사했습니다.')}catch{setNotice(`링크를 복사하지 못했습니다. ${payload.url}`)}};
  const kakao=()=>{if(kakaoState!=='READY'||!window.Kakao?.Share)return;try{window.Kakao.Share.sendDefault({objectType:'feed',content:{title:payload.title,description:payload.description,imageUrl:payload.image,link:{mobileWebUrl:payload.url,webUrl:payload.url}},buttons:[{title:payload.buttonLabel,link:{mobileWebUrl:payload.url,webUrl:payload.url}}]})}catch{setKakaoState('FAILED');setNotice('카카오톡 공유를 준비하지 못했습니다. 아래 링크 공유를 이용해 주세요.')}};
  const kakaoGuide=kakaoState==='UNCONFIGURED'?'카카오톡 공유 설정 전입니다. QR 또는 링크 공유를 이용해 주세요.':kakaoState==='FAILED'?'카카오톡 공유를 준비하지 못했습니다. QR 또는 링크 공유를 이용해 주세요.':kakaoState==='LOADING'?'카카오톡 공유를 준비하고 있습니다.':'';

  return <><button type="button" className="companion-share-entry" onClick={()=>setOpen(true)}>동행자 초대</button>{open&&<div className="companion-share-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}><section className="companion-share-dialog" role="dialog" aria-modal="true" aria-labelledby="companion-share-title"><button className="companion-share-close" type="button" aria-label="닫기" onClick={()=>setOpen(false)}>×</button><h2 id="companion-share-title">함께 여행하는 분도 이용해 보세요.</h2><p>동행자가 QR을 찍으면 바로 시작할 수 있습니다.</p><img className="companion-share-qr" src={`/api/regions/${encodeURIComponent(region.id)}/entry-qr`} alt={`${region.regionName} 여행도우미 접속 QR`}/><p className="companion-share-privacy">각자 독립된 익명 여행으로 시작하며 내 위치·일정·저장 장소는 공유되지 않습니다.</p><div className="companion-share-actions"><button type="button" className="btn btn-primary" onClick={kakao} disabled={kakaoState!=='READY'}>카카오톡으로 공유</button><button type="button" className="btn btn-outline" onClick={fallback}>링크 공유·복사</button></div>{kakaoGuide&&<p className="companion-share-guide" role="status">{kakaoGuide}</p>}{notice&&<p role="status">{notice}</p>}</section></div>}</>;
}
