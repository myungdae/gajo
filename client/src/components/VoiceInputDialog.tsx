import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import VoiceActivity from './VoiceActivity';
import VoiceConfirmation from './VoiceConfirmation';
import { VOICE_COPY } from '../voice/voiceCopy';
import { voiceWindowBounds } from '../voice/voiceViewport';
import type { VoiceUxState } from '../voice/voiceUx';

export default function VoiceInputDialog({state,text,reviewing,error,locale,onChange,onStop,onSpeakAgain,onConfirm,onCancel,onType}:{
  state:VoiceUxState;text:string;reviewing:boolean;error:string;locale:'ko'|'en';
  onChange:(text:string)=>void;onStop:()=>void;onSpeakAgain:()=>void;
  onConfirm:()=>void;onCancel:()=>void;onType:()=>void;
}){
  const dialog=useRef<HTMLDialogElement>(null);
  const cancelRef=useRef(onCancel);cancelRef.current=onCancel;
  const sending=state==='EXECUTING',copy=VOICE_COPY[locale];
  useLayoutEffect(()=>{
    const element=dialog.current!;
    const main=document.querySelector<HTMLElement>('.app-main');
    const oldOverflow=main?.style.overflowY;
    const oldRootOverflow=document.documentElement.style.overflow;
    const opener=document.activeElement as HTMLElement|null;
    const resize=()=>{
      const viewport=window.visualViewport,nav=document.querySelector('.bottom-nav')?.getBoundingClientRect();
      const bounds=voiceWindowBounds({width:viewport?.width??window.innerWidth,height:viewport?.height??window.innerHeight,
        offsetTop:viewport?.offsetTop??0,offsetLeft:viewport?.offsetLeft??0,navTop:nav?.top,navBottom:nav?.bottom});
      Object.assign(element.style,{left:bounds.left+'px',top:(bounds.sheet?bounds.bottom:bounds.center)+'px',
        width:bounds.width+'px',maxHeight:bounds.maxHeight+'px',transform:bounds.sheet?'translate(-50%, -100%)':'translate(-50%, -50%)'});
    };
    resize();
    if(main)main.style.overflowY='hidden';
    document.documentElement.style.overflow='hidden';
    element.showModal();
    window.addEventListener('resize',resize);
    window.visualViewport?.addEventListener('resize',resize);
    window.visualViewport?.addEventListener('scroll',resize);
    return()=>{
      element.close();
      if(main)main.style.overflowY=oldOverflow||'';
      document.documentElement.style.overflow=oldRootOverflow;
      window.removeEventListener('resize',resize);
      window.visualViewport?.removeEventListener('resize',resize);
      window.visualViewport?.removeEventListener('scroll',resize);
      opener?.isConnected&&opener.focus({preventScroll:true});
    };
  },[]);
  useLayoutEffect(()=>{
    if(reviewing&&!sending)dialog.current?.querySelector<HTMLButtonElement>('[data-action="confirm"]')?.focus({preventScroll:true});
  },[reviewing,sending]);
  return createPortal(<dialog ref={dialog} className="voice-input-panel voice-dialog" aria-label={copy.start} aria-modal="true"
    aria-busy={sending} onCancel={event=>{event.preventDefault();if(!sending)cancelRef.current();}}>
    <VoiceActivity state={state} locale={locale}/>
    <div className="voice-dialog-content">
      {reviewing
        ? <VoiceConfirmation state={state} text={text} onChange={onChange}/>
        : <>{text&&<p className="voice-live-transcript">{text}</p>}
            {error&&<p className="voice-error" role="alert">{error}</p>}
            <p className="voice-helper">{copy.privacyCompact}</p></>}
    </div>
    <div className="voice-dialog-actions voice-confirm-actions">
      {reviewing
        ? <><button type="button" data-action="confirm" className="btn btn-primary" disabled={sending||!text.trim()} onClick={onConfirm}>{sending?copy.sending:copy.confirm}</button>
            <button type="button" className="btn btn-outline" disabled={sending} onClick={onSpeakAgain}>{copy.again}</button></>
        : <>{state==='LISTENING'||state==='TRANSCRIBING'||state==='REQUESTING_PERMISSION'
            ? <button type="button" className="btn btn-primary speech-session-button" disabled={state!=='LISTENING'} onClick={onStop} aria-label={copy.stop}>{copy.stop}</button>
            : <button type="button" className="btn btn-primary speech-session-button" onClick={onSpeakAgain}>{copy.again}</button>}
            {error&&<button type="button" className="btn btn-outline" onClick={onType}>{copy.text}</button>}</>}
      <button type="button" className="btn btn-outline voice-cancel voice-confirm-cancel" disabled={sending} onClick={onCancel}>{copy.cancel}</button>
    </div>
  </dialog>,document.body);
}
