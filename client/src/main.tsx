import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './home.css'
import './regional-data.css'
import App from './App.tsx'
import { getRegionConfig } from './regionConfig.ts'
import { appSurface, regionFromLocation, shouldRegisterVisitorPwa } from './regionRouting.ts'
import { initializeInstallPromptCapture, isStandalone, manifestHref } from './pwaInstall.ts'
import { ensureTripSession } from './tripSession.ts'
import { setAnalyticsRegion, track } from './analytics.ts'
import { isCopilotProductionOrigin, runCopilotServiceWorkerRecovery } from './copilotSwRecovery.ts'
import { registerVisitorPwa } from './visitorPwa.ts'

// Migration rescue: an old visitor SW can return this visitor shell before the
// new Copilot HTML is reachable. Only the dedicated admin origin may clean it.
const surface=appSurface(location.pathname,location.search,location.hostname),platformSurface=surface==='PLATFORM',platformBrandedSurface=platformSurface||surface==='PUBLIC_PARTNER';
if(isCopilotProductionOrigin(location.hostname))void runCopilotServiceWorkerRecovery();
else if(shouldRegisterVisitorPwa(location.pathname,location.search,location.hostname))registerVisitorPwa();
const bootRegion=getRegionConfig(regionFromLocation(location.pathname,location.search,location.hostname));
initializeInstallPromptCapture();
const manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
if(surface!=='REGION')manifest?.remove();else if(manifest)manifest.setAttribute('href',manifestHref(bootRegion.id));else{const regionalManifest=document.createElement('link');regionalManifest.rel='manifest';regionalManifest.href=manifestHref(bootRegion.id);document.head.appendChild(regionalManifest)}
document.title=platformBrandedSurface?'찾아오는 여행도우미 | 필요한 순간 먼저 찾아가는 AI 여행서비스':bootRegion.serviceName;
document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content',platformBrandedSurface?'여행자의 상황을 이해하고 필요한 순간 서비스가 먼저 찾아가는 AI 여행도우미입니다.':`${bootRegion.regionName} 여행을 위한 AI 여행안내`);
if(isStandalone()){setAnalyticsRegion(bootRegion.id);track('PWA_STANDALONE_OPEN',ensureTripSession(bootRegion.id).id,{source:'standalone'})}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
