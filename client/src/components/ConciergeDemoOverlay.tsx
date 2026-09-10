import { useEffect, useState } from "react";
import "./ConciergeDemoOverlay.css";

type ConciergeDemoOverlayProps = {
  open: boolean;
  onClose: () => void;
  onStartTrip?: () => void;
  regionName?: string;
  startLabel?: string;
};

type DemoStep = 0 | 1 | 2 | 3 | 4;

export default function ConciergeDemoOverlay({
  open,
  onClose,
  onStartTrip,
  regionName,
  startLabel,
}: ConciergeDemoOverlayProps) {
  const [step, setStep] = useState<DemoStep>(0);

  useEffect(() => {
    if (!open) {
      setStep(0);
      return;
    }

    const timers = [
      window.setTimeout(() => setStep(1), 4000),
      window.setTimeout(() => setStep(2), 7000),
      window.setTimeout(() => setStep(3), 12000),
      window.setTimeout(() => setStep(4), 17000),
    ];

    return () => {
      timers.forEach(window.clearTimeout);
    };
  }, [open]);

  if (!open) return null;

  const handleStartTrip = () => {
    if (onStartTrip) {
      onStartTrip();
    } else {
      onClose();
    }
  };

  return (
    <div className="concierge-demo-backdrop">
      <section
        className="concierge-demo"
        role="dialog"
        aria-modal="true"
        aria-label="여행도우미 20초 체험"
      >
        <button
          type="button"
          className="concierge-demo-close"
          onClick={onClose}
          aria-label="체험 닫기"
        >
          ×
        </button>

        <div className="concierge-demo-top">
          <span className="concierge-demo-badge">20초 체험</span>
          <span className="concierge-demo-progress">
            <span
              className="concierge-demo-progress-fill"
              style={{
                width:
                  step === 0
                    ? "20%"
                    : step === 1
                      ? "40%"
                      : step === 2
                        ? "60%"
                        : step === 3
                          ? "80%"
                          : "100%",
              }}
            />
          </span>
        </div>

        {step === 0 && (
          <div className="concierge-demo-scene concierge-demo-enter">
            <div className="concierge-demo-icon">👩‍🦳</div>

            <p className="concierge-demo-kicker">지금 여행자의 상황</p>

            <h2>{regionName ? `부모님과 ${regionName} 여행 중` : "어느 지역을 여행하든"}</h2>

            <p className="concierge-demo-main-message">
              “많이 걷기는 힘드세요.”
            </p>

            <div className="concierge-demo-context-row">
              <span>👨‍👩‍👧 부모님 동행</span>
              <span>🚶 보행 부담</span>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="concierge-demo-scene concierge-demo-enter">
            <div className="concierge-demo-icon">🌧️</div>

            <p className="concierge-demo-kicker">그런데 상황이 바뀝니다</p>

            <h2>잠시 후 비가 예상됩니다.</h2>

            <div className="concierge-demo-alert">
              <span>🌧️ 비 예보</span>
              <strong>+</strong>
              <span>🍚 점심시간 임박</span>
            </div>

            <p className="concierge-demo-sub-message">
              여행 계획을 그대로 따라가도 괜찮을까요?
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="concierge-demo-scene concierge-demo-enter">
            <div className="concierge-demo-thinking">
              <span />
              <span />
              <span />
            </div>

            <p className="concierge-demo-kicker">여행도우미가 다시 판단합니다</p>

            <h2>여행 상황을 다시 살펴보고 있어요…</h2>

            <div className="concierge-demo-analysis-grid">
              <span>🌦️ 날씨</span>
              <span>📍 이동거리</span>
              <span>👩‍🦳 부모님 보행</span>
              <span>🍚 식사시간</span>
            </div>

            <p className="concierge-demo-sub-message">
              한 가지 조건이 아니라, 지금 여행에 필요한 조건을 함께 봅니다.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="concierge-demo-scene concierge-demo-enter">
            <div className="concierge-demo-icon">✨</div>

            <p className="concierge-demo-kicker">지금 상황에 맞는 우선추천</p>

            <h2>지금은 이 세 가지를 먼저 추천드려요.</h2>

            <div className="concierge-demo-route">
              <div className="concierge-demo-route-item">
                <span className="route-number">1</span>
                <div>
                  <strong>🍚 가까운 식당</strong>
                  <small>점심시간과 이동 부담을 함께 고려했어요</small>
                </div>
              </div>

              <div className="concierge-demo-route-arrow">↓</div>

              <div className="concierge-demo-route-item">
                <span className="route-number">2</span>
                <div>
                  <strong>🏛️ 실내 관광지</strong>
                  <small>비가 와도 편하게 둘러볼 수 있어요</small>
                </div>
              </div>

              <div className="concierge-demo-route-arrow">↓</div>

              <div className="concierge-demo-route-item">
                <span className="route-number">3</span>
                <div>
                  <strong>🌿 걷기 부담이 적은 곳</strong>
                  <small>부모님과 함께 가기 좋은 선택이에요</small>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="concierge-demo-scene concierge-demo-enter">
            <div className="concierge-demo-icon">📍</div>

            <p className="concierge-demo-kicker">추천에서 바로 행동으로</p>

            <h2>마음에 드는 곳을 고르거나 더 찾아볼 수 있어요.</h2>

            <div className="concierge-demo-action-preview">
              <button type="button">이곳으로 출발</button>
              <button type="button">주변 업소 더 보기</button>
            </div>

            <div className="concierge-demo-final">
              <strong>전화 · 지도 · 길찾기까지 바로 이어집니다.</strong>
              <span>상황이 바뀌면 다시 말씀해 주세요. 그때 다시 판단합니다.</span>
            </div>

            <button
              type="button"
              className="concierge-demo-start"
              onClick={handleStartTrip}
            >
              {startLabel || "내 여행 시작하기"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}