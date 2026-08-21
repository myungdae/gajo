import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { askGuide, type GuideAudience, type GuideResponse } from './guideClient';
import './guide.css';

const popular = ['ChatGPT하고 뭐가 다른가요?', '구글·네이버 지도가 있는데 왜 필요한가요?', '업체에는 어떤 도움이 되나요?', '틀린 정보는 누가 고치나요?', '내 여행정보는 어떻게 관리되나요?'];
type Message = { id: number; role: 'user' | 'guide'; text: string; response?: GuideResponse };

function GuideApp() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [audience, setAudience] = useState<GuideAudience>('GENERAL');
  const [answerToReveal, setAnswerToReveal] = useState<number | null>(null);
  const landingRef = useRef<HTMLElement>(null);
  const answerRef = useRef<HTMLElement>(null);
  const nextMessageId = useRef(0);
  const last = [...messages].reverse().find((message) => message.response)?.response;
  useEffect(() => {
    if (answerToReveal === null || !answerRef.current) return;
    answerRef.current.focus({ preventScroll: true });
    answerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setAnswerToReveal(null);
  }, [answerToReveal, messages]);
  const send = async (value = input) => {
    const question = value.trim();
    if (!question || busy) return;
    const questionId = ++nextMessageId.current;
    setMessages((current) => [...current, { id: questionId, role: 'user', text: question }]); setInput(''); setBusy(true);
    try { const response = await askGuide(question, last?.intent, audience); const answerId = ++nextMessageId.current; setMessages((current) => [...current, { id: answerId, role: 'guide', text: response.answer, response }]); setAnswerToReveal(answerId); }
    catch (error: any) { setMessages((current) => [...current, { id: ++nextMessageId.current, role: 'guide', text: error.message || '잠시 후 다시 시도해 주세요.' }]); }
    finally { setBusy(false); }
  };
  const home = () => { landingRef.current?.focus({ preventScroll: true }); landingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const restart = () => { if (window.confirm('이전 질문과 답변을 지우고 새 대화를 시작할까요?')) { setMessages([]); setAnswerToReveal(null); setInput(''); home(); } };
  return <main className="guide-shell">
    <section className="guide-landing" ref={landingRef} tabIndex={-1} aria-label="Guide 홈">
      <header><span className="guide-kicker">CONCIERGE GUIDE COPILOT</span><h1>지역 AI 컨시어지</h1><p>무엇이 궁금하세요?</p></header>
      <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="guide-composer"><label htmlFor="guide-question">질문을 입력하세요</label><div><textarea id="guide-question" value={input} onChange={(event) => setInput(event.target.value)} rows={2} maxLength={500} placeholder="예: 구글 지도가 있는데 왜 필요한가요?"/><button disabled={busy || !input.trim()}>{busy ? '답변 중…' : '질문하기'}</button></div></form>
      <section className="guide-popular"><h2>많이 묻는 질문</h2>{popular.map((question) => <button key={question} onClick={() => void send(question)}>{question}<span aria-hidden="true">→</span></button>)}</section>
      <section className="guide-perspective"><span>다른 관점으로 보기</span><div>{([['VISITOR', '관광객'], ['BUSINESS', '업체'], ['PUBLIC_SECTOR', '지자체']] as const).map(([value, label]) => <button key={value} className={audience === value ? 'selected' : ''} onClick={() => setAudience(value)}>{label} 입장</button>)}</div></section>
    </section>
    {messages.length > 0 && <section className="guide-conversation" aria-live="polite" aria-busy={busy} aria-label="이전 질문과 답변">{messages.map((message) => <article key={message.id} ref={message.id === answerToReveal ? answerRef : undefined} tabIndex={message.id === answerToReveal ? -1 : undefined} className={`guide-message ${message.role}`}><small>{message.role === 'user' ? '질문' : '가이드'}</small><p>{message.text}</p>{message.response?.relatedQuestions?.length ? <div className="guide-related">{message.response.relatedQuestions.slice(0, 2).map((question) => <button key={question} onClick={() => send(question)}>{question}</button>)}</div> : null}</article>)}</section>}
    <footer><p>이 가이드는 서비스를 설명하는 읽기 전용 안내입니다.</p><small>관광 일정 실행이나 지역 운영 데이터 관리는 각 전용 서비스에서 이루어집니다.</small></footer>
    <nav className="guide-navigation" aria-label="Guide 탐색"><button type="button" onClick={home} aria-label="Guide 홈으로 이동">홈</button><button type="button" className="guide-new-conversation" onClick={restart} aria-label="새 대화 시작" disabled={messages.length === 0}>새 대화</button></nav>
  </main>;
}
createRoot(document.getElementById('guide-root')!).render(<StrictMode><GuideApp /></StrictMode>);
