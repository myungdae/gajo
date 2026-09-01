import { useEffect, useRef, useState } from "react";
import { mergeCommittedSpeech, renderSpeechText } from "../utils/speechTranscript";
import type { VoiceUxState } from "../voice/voiceUx";

export function useSpeechInput(value: string, onValueChange: (value: string) => void, onFinalTranscript?: (value: string) => void) {
  const [listening, setListening] = useState(false), [supported, setSupported] = useState(true), [error, setError] = useState("");
  const [voiceState,setVoiceStateValue]=useState<VoiceUxState>("IDLE");
  const voiceStateRef=useRef<VoiceUxState>("IDLE");
  const setVoiceState=(state:VoiceUxState)=>{voiceStateRef.current=state;setVoiceStateValue(state)};
  const recognitionRef = useRef<any>(null), wantsListeningRef = useRef(false), activeRef = useRef(false), baseTextRef = useRef(""), committedRef = useRef(""), interimRef = useRef("");
  const render = () => onValueChange(renderSpeechText(baseTextRef.current, committedRef.current, interimRef.current));
  const stop = () => {
    if(!wantsListeningRef.current&&!activeRef.current)return;
    wantsListeningRef.current = false;
    if (interimRef.current) committedRef.current = mergeCommittedSpeech(committedRef.current, interimRef.current);
    interimRef.current = "";
    render();
    setListening(false);
    if (activeRef.current) {setVoiceState("TRANSCRIBING");try { recognitionRef.current?.stop?.(); } catch { /* already ending */ }}
    else {setError("말소리를 듣지 못했어요. 다시 말하거나 직접 입력해 주세요.");setVoiceState("RECOVERABLE_ERROR");try{recognitionRef.current?.abort?.()}catch{/* permission request ending */}}
  };
  const cancel=()=>{wantsListeningRef.current=false;committedRef.current="";interimRef.current="";setListening(false);setVoiceState("IDLE");try{recognitionRef.current?.abort?.()}catch{/* already ending */}};
  const startInstance = (SpeechRecognition: any) => {
    if (!wantsListeningRef.current || document.hidden) return;
    const recognition = new SpeechRecognition(), finalIndexes = new Set<number>();
    recognition.lang = "ko-KR";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { if(!wantsListeningRef.current){try{recognition.abort?.()}catch{}return}activeRef.current = true; setListening(true); setVoiceState("LISTENING"); };
    recognition.onresult = (event: any) => {
      for (let index = Number(event.resultIndex || 0); index < (event.results?.length || 0); index += 1) {
        const result = event.results[index], transcript = String(result?.[0]?.transcript || "").trim();
        if (!transcript) continue;
        if (result?.isFinal !== false) {
          if (!finalIndexes.has(index)) { committedRef.current = mergeCommittedSpeech(committedRef.current, transcript); finalIndexes.add(index); }
          interimRef.current = "";
        } else interimRef.current = transcript;
      }
      render();
    };
    recognition.onerror = (event: any) => {
      const fatal = ["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"].includes(event?.error);
      if (event?.error === "no-speech") {setError("말소리를 듣지 못했어요. 다시 말하거나 직접 입력해 주세요.");setVoiceState("RECOVERABLE_ERROR");}
      if (fatal) { const denied=["not-allowed", "service-not-allowed"].includes(event?.error);setError(denied ? "마이크를 사용할 수 없어요. 직접 입력해 주세요." : "음성 입력을 사용할 수 없어요. 직접 입력해 주세요."); setVoiceState(denied?"PERMISSION_DENIED":"RECOVERABLE_ERROR");wantsListeningRef.current=false;setListening(false); }
    };
    recognition.onend = () => {
      activeRef.current = false;
      recognitionRef.current = null;
      wantsListeningRef.current = false;
      interimRef.current = "";
      render();
      setListening(false);
      const finalText=renderSpeechText(baseTextRef.current,committedRef.current,"");
      if(finalText.trim()&&voiceStateRef.current!=="PERMISSION_DENIED"){setVoiceState("UNDERSTANDING");onFinalTranscript?.(finalText)}
      else if(voiceStateRef.current!=="PERMISSION_DENIED"&&voiceStateRef.current!=="RECOVERABLE_ERROR")setVoiceState("IDLE");
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { setError("음성 입력을 시작하지 못했어요. 직접 입력해 주세요."); stop(); }
  };
  const toggle = () => {
    if (wantsListeningRef.current) { stop(); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setSupported(false); setVoiceState("UNSUPPORTED");setError("이 브라우저에서는 음성 입력을 사용할 수 없어요. 직접 입력해 주세요."); return; }
    setError(""); baseTextRef.current = value.trim(); committedRef.current = ""; interimRef.current = ""; wantsListeningRef.current = true; setListening(true);setVoiceState("REQUESTING_PERMISSION"); startInstance(SpeechRecognition);
  };
  useEffect(() => () => { wantsListeningRef.current = false; try { recognitionRef.current?.stop?.(); } catch { /* already ending */ } }, []);
  return { listening, voiceSupported: supported, voiceError: error, voiceState, setVoiceState, toggleListening: toggle, stopListening: stop, cancelListening:cancel };
}
