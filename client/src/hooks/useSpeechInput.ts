import { useEffect, useRef, useState } from "react";
import { mergeCommittedSpeech, renderSpeechText } from "../utils/speechTranscript";

export function useSpeechInput(value: string, onValueChange: (value: string) => void) {
  const [listening, setListening] = useState(false), [supported, setSupported] = useState(true), [error, setError] = useState("");
  const recognitionRef = useRef<any>(null), wantsListeningRef = useRef(false), activeRef = useRef(false), baseTextRef = useRef(""), committedRef = useRef(""), interimRef = useRef("");
  const render = () => onValueChange(renderSpeechText(baseTextRef.current, committedRef.current, interimRef.current));
  const stop = () => {
    wantsListeningRef.current = false;
    if (interimRef.current) committedRef.current = mergeCommittedSpeech(committedRef.current, interimRef.current);
    interimRef.current = "";
    render();
    setListening(false);
    if (activeRef.current) try { recognitionRef.current?.stop?.(); } catch { /* already ending */ }
  };
  const startInstance = (SpeechRecognition: any) => {
    if (!wantsListeningRef.current || document.hidden) return;
    const recognition = new SpeechRecognition(), finalIndexes = new Set<number>();
    recognition.lang = "ko-KR";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { activeRef.current = true; setListening(true); };
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
      if (event?.error === "no-speech") setError("말소리를 듣지 못했어요. 다시 말하거나 직접 입력해 주세요.");
      if (fatal) { setError(["not-allowed", "service-not-allowed"].includes(event?.error) ? "마이크를 사용할 수 없어요. 직접 입력해 주세요." : "음성 입력을 사용할 수 없어요. 직접 입력해 주세요."); stop(); }
    };
    recognition.onend = () => {
      activeRef.current = false;
      recognitionRef.current = null;
      wantsListeningRef.current = false;
      interimRef.current = "";
      render();
      setListening(false);
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { setError("음성 입력을 시작하지 못했어요. 직접 입력해 주세요."); stop(); }
  };
  const toggle = () => {
    if (wantsListeningRef.current) { stop(); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setSupported(false); setError("이 브라우저에서는 음성 입력을 사용할 수 없어요. 직접 입력해 주세요."); return; }
    setError(""); baseTextRef.current = value.trim(); committedRef.current = ""; interimRef.current = ""; wantsListeningRef.current = true; setListening(true); startInstance(SpeechRecognition);
  };
  useEffect(() => () => { wantsListeningRef.current = false; try { recognitionRef.current?.stop?.(); } catch { /* already ending */ } }, []);
  return { listening, voiceSupported: supported, voiceError: error, toggleListening: toggle, stopListening: stop };
}
