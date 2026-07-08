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
  { emoji: '🍽️', title: '지역 맛집 추천', prompt: '온천 후 먹을 수 있는 지역 건강식 식당을 추천해주세요.' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchOntologyStats().then(setStats).catch(() => setStats(null));
  }, []);

  const goToChat = (prompt: string) => {
    navigate('/concierge', { state: { prefill: prompt } });
  };

  return (
    <div>
      <div className="hero">
        <h2>가조 온천단지에 오신 것을 환영합니다</h2>
        <p>
          방문객의 건강 상태, 날씨, 혼잡도를 종합적으로 이해하는 에이전틱 AI 컨시어지가
          온톨로지 그래프 추론을 통해 설명 가능한 맞춤 일정을 안내해드립니다.
        </p>
      </div>

      <div className="quick-grid">
        {quickPrompts.map((q) => (
          <button key={q.title} onClick={() => goToChat(q.prompt)}>
            <span className="emoji">{q.emoji}</span>
            {q.title}
          </button>
        ))}
      </div>

      <div className="card">
        <h2>AI 컨시어지에게 바로 물어보세요</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
          자연어로 상황을 말씀해주시면, 룰 기반이 아닌 온톨로지 그래프 추론으로 안전하고
          설명 가능한 추천을 제공합니다.
        </p>
        <button className="btn btn-primary btn-block" onClick={() => navigate('/concierge')}>
          💬 AI 컨시어지 채팅 시작하기
        </button>
      </div>

      <div className="card">
        <h2>온톨로지 엔진 상태</h2>
        {stats ? (
          <div className="grid-2">
            <div className="stat-box">
              <div className="num">{stats.totalTriples}</div>
              <div className="label">RDF 트리플</div>
            </div>
            <div className="stat-box">
              <div className="num">{stats.classCount}</div>
              <div className="label">클래스</div>
            </div>
            <div className="stat-box">
              <div className="num">{stats.propertyCount}</div>
              <div className="label">속성</div>
            </div>
            <div className="stat-box">
              <div className="num">{stats.individualCount}</div>
              <div className="label">개체</div>
            </div>
          </div>
        ) : (
          <div className="loading">온톨로지 서버에 연결 중...</div>
        )}
      </div>
    </div>
  );
}
