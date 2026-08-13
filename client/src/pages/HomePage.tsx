import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { fetchOntologyStats } from '../api/client';

const quickPrompts = [
  {
    emoji: '👵',
    title: '어르신 동반 여행',
    prompt:
      '이번 토요일에 어머니를 모시고 가조온천에 하루 다녀오려고 합니다. 어머니는 78세이고 무릎이 좋지 않습니다. 비가 올 것 같고 사람이 많을까 걱정됩니다.',
  },
  { emoji: '👨‍👩‍👧', title: '가족 힐링 여행', prompt: '가족과 함께 편안하게 힐링할 수 있는 온천 코스를 추천해주세요.' },
  { emoji: '🌧️', title: '비 오는 날 실내 코스', prompt: '오늘 비가 오는데 실내에서 즐길 수 있는 프로그램이 있을까요?' },
  { emoji: '🧭', title: '주변 즐길거리 찾기', prompt: '지금 주변에서 갈 만한 곳을 찾아주세요.', nearby: true },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [statsState, setStatsState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    fetchOntologyStats().then((value) => {
      const valid = ['totalTriples', 'classCount', 'propertyCount', 'individualCount'].every((key) => Number.isFinite(value?.[key]) && value[key] > 0);
      if (valid) { setStats(value); setStatsState('ready'); }
      else setStatsState('unavailable');
    }).catch(() => setStatsState('unavailable'));
  }, []);

  const goToChat = (prompt: string) => {
    navigate('/concierge', { state: { prefill: prompt } });
  };

  const goToPrompt = (q: (typeof quickPrompts)[number]) => {
    if ((q as any).nearby) {
      navigate('/nearby-discovery');
    } else {
      goToChat(q.prompt);
    }
  };

  return (
    <div>
      <div className="hero">
        <h2>가조 온천단지에 오신 것을 환영합니다</h2>
        <p>
          함께 오신 분, 머무는 시간, 이동 방법, 걷기 편한 정도와 날씨 같은 상황을 함께 고려해
          지금 가장 알맞은 일정을 추천해드립니다.
        </p>
      </div>

      <div className="quick-grid">
        {quickPrompts.map((q) => (
          <button key={q.title} onClick={() => goToPrompt(q)}>
            <span className="emoji">{q.emoji}</span>
            {q.title}
          </button>
        ))}
      </div>

      <div className="card">
        <h2>AI 컨시어지에게 바로 물어보세요</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
          자연어로 편하게 말씀해주세요. 함께 오신 분, 머무는 시간, 이동 방법, 걷기 편한 정도,
          날씨 같은 상황을 함께 고려해 지금 가장 알맞은 일정을 추천해드립니다.
        </p>
        <button className="btn btn-primary btn-block" onClick={() => navigate('/concierge')}>
          💬 AI 컨시어지 채팅 시작하기
        </button>
      </div>

      <div className="card engine-status" aria-live="polite">
        <h2>서비스 엔진 상태</h2>
        {statsState === 'loading' && <p>엔진 상태 확인 중</p>}
        {statsState === 'unavailable' && <p>엔진 상태를 확인할 수 없습니다.</p>}
        {statsState === 'ready' && stats && <p>맞춤 일정 추천 엔진이 준비되었습니다.</p>}
      </div>
    </div>
  );
}
