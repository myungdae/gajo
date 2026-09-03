import { localizedVoiceState } from '../voice/voiceCopy';
import type { VoiceUxState } from '../voice/voiceUx';

export default function VoiceActivity({state,locale}:{state:VoiceUxState;locale:'ko'|'en'}){
  const phase=state==='LISTENING'?'listening':state==='CONFIRMING'?'complete':'waiting';
  return <div className="voice-activity" data-phase={phase} role="status" aria-live="polite" aria-atomic="true">
    <span className="voice-activity-symbol" aria-hidden="true">
      {phase==='complete'
        ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6"/></svg>
        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>}
    </span>
    <strong>{localizedVoiceState(state,locale)}</strong>
  </div>;
}
