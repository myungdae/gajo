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

const bootRegion=getRegionConfig(regionFromLocation(location.pathname,location.search));
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
