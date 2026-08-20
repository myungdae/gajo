import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { track } from '../analytics';
import { useRegion } from '../RegionContext';
import { ensureTripSession } from '../tripSession';
import { installDismissalKey, isIosSafari, isStandalone, type BeforeInstallPromptEvent } from '../pwaInstall';

export default function InstallExperience({ usefulResult }: { usefulResult: boolean }) {
  const region=useRegion(),location=useLocation(),session=ensureTripSession(region.id),key=installDismissalKey(region.id);
  const[installEvent,setInstallEvent]=useState<BeforeInstallPromptEvent|null>(null),[dismissed,setDismissed]=useState(()=>sessionStorage.getItem(key)==='1'),[installed,setInstalled]=useState(()=>isStandalone());
  const offered=useRef(false),ios=isIosSafari(navigator.userAgent,navigator.vendor),source=new URLSearchParams(location.search).get('source')||'recommendation';
  useEffect(()=>{const capture=(event:Event)=>{event.preventDefault();setInstallEvent(event as BeforeInstallPromptEvent)};const completed=()=>{setInstalled(true);track('PWA_INSTALL_ACCEPTED',session.id,{source:'appinstalled'})};window.addEventListener('beforeinstallprompt',capture);window.addEventListener('appinstalled',completed);return()=>{window.removeEventListener('beforeinstallprompt',capture);window.removeEventListener('appinstalled',completed)}},[session.id]);
  const visible=usefulResult&&!dismissed&&!installed&&(ios||Boolean(installEvent));
  useEffect(()=>{if(visible&&!offered.current){offered.current=true;track('PWA_INSTALL_OFFERED',session.id,{source,platform:ios?'ios-safari':'browser-prompt'})}},[visible,ios,session.id,source]);
  if(!visible)return null;
  const later=()=>{sessionStorage.setItem(key,'1');setDismissed(true);track('PWA_INSTALL_DISMISSED',session.id,{source,reason:'later'})};
  const install=async()=>{if(!installEvent)return;await installEvent.prompt();const choice=await installEvent.userChoice;track(choice.outcome==='accepted'?'PWA_INSTALL_ACCEPTED':'PWA_INSTALL_DISMISSED',session.id,{source,platform:choice.platform,reason:choice.outcome});setInstallEvent(null);if(choice.outcome==='dismissed'){sessionStorage.setItem(key,'1');setDismissed(true)}};
  return <aside className="install-card" aria-labelledby="install-card-title"><div className="install-card-icon" aria-hidden="true">↗</div><div><h2 id="install-card-title">{region.regionName} 여행 중 계속 이용하시겠어요?</h2><p>홈 화면에 추가하면 QR을 다시 찾지 않고<br/>바로 이용할 수 있습니다.</p>{ios&&<p className="install-ios-guide"><b>Safari 아래의 공유 버튼</b>을 누른 뒤<br/>‘홈 화면에 추가’를 선택하세요.</p>}<div className="install-card-actions">{!ios&&<button type="button" className="btn btn-primary" onClick={install}>홈 화면에 추가</button>}<button type="button" className="btn btn-text" onClick={later}>나중에</button></div></div></aside>;
}
