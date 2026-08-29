import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { track } from '../analytics';
import { useRegion } from '../RegionContext';
import { ensureTripSession } from '../tripSession';
import { clearInstallPrompt, currentInstallPrompt, installDismissalKey, installExperienceMode, installPlatform, isStandalone, subscribeToInstallPrompt, type BeforeInstallPromptEvent } from '../pwaInstall';

export default function InstallExperience({usefulResult}:{usefulResult:boolean}){
  const region=useRegion(),location=useLocation(),session=ensureTripSession(region.id),key=installDismissalKey(region.id);
  const[prompt,setPrompt]=useState<BeforeInstallPromptEvent|null>(()=>currentInstallPrompt()),[dismissed,setDismissed]=useState(()=>sessionStorage.getItem(key)==='1'),[installed,setInstalled]=useState(()=>isStandalone()),[showGuide,setShowGuide]=useState(false);
  const offered=useRef(false),platform=installPlatform(navigator.userAgent,navigator.vendor),source=new URLSearchParams(location.search).get('source')||'recommendation';
  useEffect(()=>subscribeToInstallPrompt(setPrompt),[]);
  useEffect(()=>{const completed=()=>{setInstalled(true);clearInstallPrompt();track('PWA_INSTALL_ACCEPTED',session.id,{source:'appinstalled'})};window.addEventListener('appinstalled',completed);return()=>window.removeEventListener('appinstalled',completed)},[session.id]);
  const mode=installExperienceMode({usefulResult,dismissed,standalone:installed,platform,promptAvailable:Boolean(prompt)}),visible=mode!=='hidden';
  useEffect(()=>{if(visible&&!offered.current){offered.current=true;track('PWA_INSTALL_OFFERED',session.id,{source,platform,method:mode})}},[visible,mode,platform,session.id,source]);
  if(!visible)return null;
  const later=()=>{sessionStorage.setItem(key,'1');setDismissed(true);track('PWA_INSTALL_DISMISSED',session.id,{source,reason:'later',platform})};
  const install=async()=>{if(!prompt)return;try{await prompt.prompt();const choice=await prompt.userChoice;track(choice.outcome==='accepted'?'PWA_INSTALL_ACCEPTED':'PWA_INSTALL_DISMISSED',session.id,{source,platform:choice.platform,reason:choice.outcome});clearInstallPrompt();setPrompt(null);if(choice.outcome==='accepted')setInstalled(true);else{sessionStorage.setItem(key,'1');setDismissed(true)}}catch{clearInstallPrompt();setPrompt(null);setShowGuide(true)}};
  const ios=mode==='ios-guide',androidGuide=mode==='android-guide'&&showGuide;
  return <aside className="install-card" aria-labelledby="install-card-title"><div className="install-card-icon" aria-hidden="true">↗</div><div><h2 id="install-card-title">다음에도 쉽게 이용하기</h2><p>홈 화면에 추가하면 QR을 다시 찾지 않고<br/>바로 열 수 있습니다.</p>{ios&&<p className="install-ios-guide"><b>Safari 아래의 공유 버튼</b>을 누른 뒤<br/>‘홈 화면에 추가’를 선택하세요.</p>}{androidGuide&&<p className="install-android-guide"><b>{platform==='samsung-internet'?'브라우저 메뉴':'Chrome 오른쪽 위 ⋮ 메뉴'}</b>를 누른 뒤<br/>‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.<br/><small>기기와 브라우저에 따라 메뉴 이름이 다를 수 있습니다.</small></p>}<div className="install-card-actions">{mode==='native'&&<button type="button" className="btn btn-primary" onClick={install}>홈 화면에 추가</button>}{mode==='android-guide'&&!showGuide&&<button type="button" className="btn btn-primary" onClick={()=>setShowGuide(true)}>홈 화면에 추가하는 방법</button>}<button type="button" className="btn btn-text" onClick={later}>나중에</button></div></div></aside>;
}
