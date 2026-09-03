import { useEffect, useRef } from 'react';
import { useRegionalLanguage } from '../RegionalLanguageContext';
import { VOICE_COPY, localizedVoiceState } from '../voice/voiceCopy';
import type { VoiceUxState } from '../voice/voiceUx';

export default function VoiceConfirmation({state,text,onChange,onSpeakAgain,onConfirm,onCancel}:{
  state:VoiceUxState;text:string;onChange:(text:string)=>void;
  onSpeakAgain:()=>void;onConfirm:()=>void;onCancel:()=>void;
}){
  const {language}=useRegionalLanguage(),copy=VOICE_COPY[language];
  const editor=useRef<HTMLTextAreaElement>(null),sending=state==='EXECUTING';
  useEffect(()=>{editor.current?.focus();},[]);
  return <section className="voice-confirmation" aria-labelledby="voice-confirmation-title" aria-busy={sending}>
    <p role="status" className="voice-state">{localizedVoiceState(state,language)}</p>
    <h3 id="voice-confirmation-title">{copy.review}</h3>
    <label htmlFor="voice-transcript">{copy.transcript}</label>
    <textarea id="voice-transcript" ref={editor} value={text} rows={4} disabled={sending} onChange={event=>onChange(event.target.value)}/>
    <div className="voice-confirm-actions">
      <button type="button" className="btn btn-primary" disabled={sending||!text.trim()} onClick={onConfirm}>{sending?copy.sending:copy.confirm}</button>
      <button type="button" className="btn btn-outline" disabled={sending} onClick={onSpeakAgain}>{copy.again}</button>
      <button type="button" className="voice-confirm-cancel" disabled={sending} onClick={onCancel}>{copy.cancel}</button>
    </div>
  </section>;
}
