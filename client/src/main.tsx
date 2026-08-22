import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './home.css'
import './regional-data.css'
import App from './App.tsx'
import { getRegionConfig } from './regionConfig.ts'
import { regionFromLocation } from './regionRouting.ts'
import { initializeInstallPromptCapture, isStandalone, manifestHref } from './pwaInstall.ts'
import { ensureTripSession } from './tripSession.ts'
import { setAnalyticsRegion, track } from './analytics.ts'
import { isCopilotProductionOrigin, runCopilotServiceWorkerRecovery } from './copilotSwRecovery.ts'
import { registerVisitorPwa } from './visitorPwa.ts'

// Migration rescue: an old visitor SW can return this visitor shell before the
// new Copilot HTML is reachable. Only the dedicated admin origin may clean it.
if(isCopilotProductionOrigin(location.hostname))void runCopilotServiceWorkerRecovery();
else registerVisitorPwa();
const bootRegion=getRegionConfig(regionFromLocation(location.pathname,location.search,location.hostname));
initializeInstallPromptCapture();
document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.setAttribute('href',manifestHref(bootRegion.id));
document.title=bootRegion.serviceName;
document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content',`${bootRegion.regionName} 여행을 위한 AI 여행안내`);
if(isStandalone()){setAnalyticsRegion(bootRegion.id);track('PWA_STANDALONE_OPEN',ensureTripSession(bootRegion.id).id,{source:'standalone'})}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
