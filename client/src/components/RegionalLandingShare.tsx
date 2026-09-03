import { useEffect, useState } from 'react';
import { useRegion } from '../RegionContext';
import { companionSharePayload, initializeKakaoShare } from '../shareConfig';
import { useRegionalLanguage } from '../RegionalLanguageContext';

declare global {
  interface Window {
    Kakao?: { isInitialized():boolean; init(key:string):void; Share?:{sendDefault(input:unknown):void} };
  }
}

type KakaoState='LOADING'|'READY'|'FAILED';

export default function RegionalLandingShare({posterOverlay=false}:{posterOverlay?:boolean}){
  const {language}=useRegionalLanguage();
  const region=useRegion(),payload=companionSharePayload(region,'REGIONAL_ENTRY',language),kakaoKey=import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY?.trim();
  const [kakaoState,setKakaoState]=useState<KakaoState>(kakaoKey?'LOADING':'FAILED');

  useEffect(()=>{
    if(!kakaoKey)return;
    const ready=()=>setKakaoState(initializeKakaoShare(window.Kakao,kakaoKey)?'READY':'FAILED');
    const existing=document.querySelector<HTMLScriptElement>('script[data-kakao-sdk]');
    if(existing){
      if(window.Kakao)ready();
      else existing.addEventListener('load',ready,{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src='https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
    script.crossOrigin='anonymous';
    script.dataset.kakaoSdk='true';
    script.onload=ready;
    script.onerror=()=>setKakaoState('FAILED');
    document.head.appendChild(script);
  },[kakaoKey]);

  const shareToKakao=()=>{
    if(kakaoState!=='READY'||!window.Kakao?.Share)return;
    try{
      window.Kakao.Share.sendDefault({
        objectType:'feed',
        content:{title:payload.title,description:payload.description,imageUrl:payload.image,link:{mobileWebUrl:payload.url,webUrl:payload.url}},
        buttons:[{title:payload.buttonLabel,link:{mobileWebUrl:payload.url,webUrl:payload.url}}],
      });
    }catch{
      setKakaoState('FAILED');
    }
  };

  return <section className={`regional-landing-share${posterOverlay?' regional-landing-share--poster':''}`} aria-label="동행자와 공유">
    <img className="regional-landing-qr" src={`/api/regions/${encodeURIComponent(region.id)}/entry-qr${language === 'en' ? '?locale=en' : ''}`} alt={`${region.regionName} 여행도우미 공식 접속 QR`}/>
    {(kakaoKey||posterOverlay)&&<button type="button" className="regional-landing-kakao" onClick={shareToKakao} disabled={!kakaoKey||kakaoState!=='READY'} aria-label={kakaoKey?'카카오톡으로 보내기':'카카오톡 공유는 현재 사용할 수 없습니다'}><span className={posterOverlay?'sr-only':undefined}>카카오톡으로 보내기</span></button>}
  </section>;
}
