import { useEffect, useRef, useState } from 'react';
import type { VoiceUxState } from '../voice/voiceUx';
import { createSpeechSession } from '../voice/speechSession';
import { VOICE_COPY } from '../voice/voiceCopy';

export function useSpeechInput(_value:string,onValueChange:(value:string)=>void,onFinalTranscript?:(value:string)=>void,locale:'ko'|'en'='ko'){
  const [voiceState,setVoiceState]=useState<VoiceUxState>('IDLE');
  const [error,setError]=useState<''|'permission'|'empty'|'error'|'unsupported'>('');
  const sessionRef=useRef<ReturnType<typeof createSpeechSession>|null>(null),busyRef=useRef(false);
  const callbacks=useRef({onValueChange,onFinalTranscript});callbacks.current={onValueChange,onFinalTranscript};
  const cancelListening=()=>{
    sessionRef.current?.cancel();sessionRef.current=null;busyRef.current=false;setVoiceState('IDLE');setError('');
  };
  const stopListening=()=>sessionRef.current?.stop();
  const toggleListening=()=>{
    if(busyRef.current)return;
    const Recognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!Recognition){setVoiceState('UNSUPPORTED');setError('unsupported');return;}
    sessionRef.current?.cancel();busyRef.current=true;setError('');
    sessionRef.current=createSpeechSession({
      create:()=>new Recognition(),locale,onState:setVoiceState,
      onDraft:text=>callbacks.current.onValueChange(text),
      onFinal:text=>{busyRef.current=false;callbacks.current.onFinalTranscript?.(text);},
      onError:kind=>{busyRef.current=false;setError(kind);},
    });
    sessionRef.current.start();
  };
  useEffect(()=>{
    setVoiceState("IDLE");setError("");
    const leave=()=>cancelListening(),hide=()=>{if(document.hidden)leave();};
    window.addEventListener('pagehide',leave);window.addEventListener('popstate',leave);document.addEventListener('visibilitychange',hide);
    return()=>{
      sessionRef.current?.cancel();busyRef.current=false;
      window.removeEventListener('pagehide',leave);window.removeEventListener('popstate',leave);document.removeEventListener('visibilitychange',hide);
    };
  },[locale]);
  const listening=['REQUESTING_PERMISSION','LISTENING','TRANSCRIBING'].includes(voiceState);
  return{listening,voiceSupported:error!=='unsupported',voiceError:error?VOICE_COPY[locale][error]:'',voiceState,setVoiceState,toggleListening,stopListening,cancelListening};
}
