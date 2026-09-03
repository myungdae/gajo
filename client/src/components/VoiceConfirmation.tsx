import { useRegionalLanguage } from '../RegionalLanguageContext';
import { VOICE_COPY } from '../voice/voiceCopy';
import type { VoiceUxState } from '../voice/voiceUx';

export default function VoiceConfirmation({state,text,onChange}:{
  state:VoiceUxState;text:string;onChange:(text:string)=>void;
}){
  const {language}=useRegionalLanguage(),copy=VOICE_COPY[language],sending=state==='EXECUTING';
  return <>
    <label className="sr-only" htmlFor="voice-transcript">{copy.transcript}</label>
    <textarea id="voice-transcript" value={text} rows={3} disabled={sending} onChange={event=>onChange(event.target.value)}/>
  </>;
}
