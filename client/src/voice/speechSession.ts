import { mergeCommittedSpeech } from '../utils/speechTranscript.ts';
import type { VoiceUxState } from './voiceUx.ts';

// A user gesture owns one recognition instance; late events cannot revive it.
export function createSpeechSession(options: {
  create:()=>any; locale:'ko'|'en'; onState:(state:VoiceUxState)=>void;
  onDraft:(text:string)=>void; onFinal:(text:string)=>void;
  onError:(kind:'permission'|'empty'|'error')=>void;
}) {
  let recognition:any, ended=false, started=false, stopping=false, interim='';
  const committed=new Map<number,string>();
  const text=()=>[...committed.values(),interim].reduce(mergeCommittedSpeech,'');
  const detach=()=>{if(recognition)recognition.onstart=recognition.onresult=recognition.onerror=recognition.onend=null;};
  const cancel=()=>{if(ended)return;ended=true;detach();try{recognition?.abort();}catch{/* Already ended. */}};
  const fail=(kind:'permission'|'empty'|'error')=>{
    cancel();options.onState(kind==='permission'?'PERMISSION_DENIED':'RECOVERABLE_ERROR');options.onError(kind);
  };
  return {
    start(){
      if(started||ended)return;
      started=true;options.onState('REQUESTING_PERMISSION');
      try{
        recognition=options.create();
        recognition.lang=options.locale==='en'?'en-US':'ko-KR';
        recognition.interimResults=true;recognition.continuous=false;recognition.maxAlternatives=1;
        recognition.onstart=()=>{if(!ended)options.onState('LISTENING');};
        recognition.onresult=(event:any)=>{
          if(ended)return;
          interim='';
          for(let index=0;index<(event.results?.length||0);index++){
            const result=event.results[index],value=String(result?.[0]?.transcript||'').trim();
            if(result.isFinal)committed.set(index,value);
            else interim += (interim?' ':'')+value;
          }
          options.onDraft(text());
        };
        recognition.onerror=(event:any)=>{
          if(!ended)fail(['not-allowed','service-not-allowed'].includes(event.error)?'permission':event.error==='no-speech'?'empty':'error');
        };
        recognition.onend=()=>{
          if(ended)return;
          const value=text();ended=true;detach();
          if(!value){options.onState('RECOVERABLE_ERROR');options.onError('empty');}
          else{options.onState('CONFIRMING');options.onFinal(value);}
        };
        recognition.start();
      }catch{fail('error');}
    },
    stop(){
      if(ended||stopping)return;
      stopping=true;options.onState('TRANSCRIBING');
      try{recognition?.stop();}catch{fail('error');}
    },
    cancel,
  };
}
