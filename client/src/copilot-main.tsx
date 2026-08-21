import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./copilot.css";
const api = async (path: string, options: any = {}) => {
  const token = sessionStorage.getItem("copilot-access-token");
  const response = await fetch(`/api/copilot${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};
function App() {
  const [token, setToken] = useState(() =>
      sessionStorage.getItem("copilot-access-token"),
    ),
    [principal, setPrincipal] = useState<any>(() =>
      JSON.parse(sessionStorage.getItem("copilot-principal") || "null"),
    );
  if (!token || !principal)
    return (
      <Login
        onLogin={(value: any) => {
          sessionStorage.setItem("copilot-access-token", value.accessToken);
          sessionStorage.setItem(
            "copilot-principal",
            JSON.stringify(value.principal),
          );
          setToken(value.accessToken);
          setPrincipal(value.principal);
        }}
      />
    );
  return (
    <Home
      principal={principal}
      onLogout={() => {
        sessionStorage.removeItem("copilot-access-token");
        sessionStorage.removeItem("copilot-principal");
        setToken(null);
        setPrincipal(null);
      }}
    />
  );
}
function Login({ onLogin }: { onLogin: (value: any) => void }) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState("");
  return (
    <main className="copilot-login">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            onLogin(
              await api("/auth/login", {
                method: "POST",
                body: JSON.stringify({ username, password }),
              }),
            );
          } catch {
            setError("로그인 정보를 확인해 주세요.");
          }
        }}
      >
        <small>관리자 전용</small>
        <h1>Regional Copilot</h1>
        <label>
          아이디
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label>
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button>로그인</button>
      </form>
    </main>
  );
}
function Home({
  principal,
  onLogout,
}: {
  principal: any;
  onLogout: () => void;
}) {
  const [regionId, setRegionId] = useState(
      principal.regions?.[0] || "hapcheon",
    ),
    [home, setHome] = useState<any>(),
    [selected, setSelected] = useState<any>(),
    [selectedCore, setSelectedCore] = useState<any>(),
    [query, setQuery] = useState("");
  const load = () =>
    api(`/home?regionId=${encodeURIComponent(regionId)}`).then(setHome);
  useEffect(() => {
    void load();
  }, [regionId]);
  const open = async (task: any) => {
    if (task.candidate)
      setSelected(await api(`/candidates/${task.candidate.id}`));
    if (task.core)
      setSelectedCore(await api(`/core-destinations/${task.core.id}`));
  };
  return (
    <main className="copilot-shell">
      <header>
        <div>
          <small>{regionId} Regional Copilot</small>
          <h1>오늘 확인할 일이 {home?.total || 0}건 있습니다.</h1>
        </div>
        <button className="quiet" onClick={onLogout}>
          로그아웃
        </button>
      </header>
      {principal.role === "PLATFORM_ADMIN" && (
        <label>
          담당 지역
          <input
            value={regionId}
            onChange={(e) => setRegionId(e.target.value)}
          />
        </label>
      )}
      <section className="copilot-counts">
        <article>
          <b>{home?.counts?.dataChanges || 0}</b>
          <span>정보 변경 의심</span>
        </article>
        <article>
          <b>{home?.counts?.newCandidates || 0}</b>
          <span>신규 업체 후보</span>
        </article>
        <article>
          <b>{home?.counts?.searchDiscovered || 0}</b>
          <span>검색에서 발견</span>
        </article>
        <article>
          <b>{home?.counts?.unverified || 0}</b>
          <span>미검증 정보</span>
        </article>
      </section>
      <section className="core-coverage">
        <div className="section-heading">
          <div>
            <small>
              {regionId} 핵심 장소 {home?.coreCoverage?.total || 0}곳
            </small>
            <h2>핵심 장소 점검</h2>
          </div>
          <span>전체 보기</span>
        </div>
        <div className="core-counts" aria-label="핵심 장소 상태 요약">
          <b>정상 {home?.coreCoverage?.healthy || 0}</b>
          <b>확인 필요 {home?.coreCoverage?.warning || 0}</b>
          <b>누락 {home?.coreCoverage?.critical || 0}</b>
        </div>
        <div className="core-list">
          {home?.coreCoverage?.items?.map((item: any) => (
            <article key={item.core.id} data-health={item.health}>
              <small>
                {item.health === "HEALTHY"
                  ? "정상"
                  : item.health === "WARNING"
                    ? "확인 필요"
                    : "누락"}
              </small>
              <h3>{item.core.displayName}</h3>
              <p>{item.summary}</p>
              <button onClick={() => setSelectedCore(item)}>원인 보기</button>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2>오늘 뭐부터 할까요?</h2>
        <form
          className="copilot-query"
          onSubmit={async (e) => {
            e.preventDefault();
            const tasks = await api(
              `/tasks?regionId=${encodeURIComponent(regionId)}&q=${encodeURIComponent(query)}`,
            );
            setHome((x: any) => ({ ...x, tasks, total: tasks.length }));
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="말하거나 입력하세요"
          />
          <button>보기</button>
        </form>
        <small>
          “오늘 확인할 일”, “핵심 관광지 중 검증 안 된 곳”, “황계폭포는 왜 안
          나와?”를 물어볼 수 있습니다.
        </small>
      </section>
      <section>
        <h2>오늘 할 일</h2>
        <div className="copilot-tasks">
          {home?.tasks?.map((task: any) => (
            <article key={task.taskId}>
              <small>
                {task.type} · 우선순위 {task.priority}
              </small>
              <h3>
                {task.candidate?.displayName ||
                  task.entity?.displayName ||
                  task.core?.displayName}
              </h3>
              <p>{task.reason}</p>
              {(task.candidate || task.core) && (
                <button onClick={() => open(task)}>검토하기</button>
              )}
            </article>
          ))}
        </div>
      </section>
      <nav>
        <b>오늘 할 일</b>
        <span>지역정보</span>
        <span>관광객 수요 · 준비 중</span>
        <span>관계 관리 · 준비 중</span>
      </nav>
      {selected && (
        <Review
          detail={selected}
          onClose={() => setSelected(undefined)}
          onChanged={async () => {
            setSelected(undefined);
            await load();
          }}
        />
      )}
      {selectedCore && (
        <CoreReview
          detail={selectedCore}
          onClose={() => setSelectedCore(undefined)}
          onChanged={async () => {
            setSelectedCore(undefined);
            await load();
          }}
        />
      )}
    </main>
  );
}
function CoreReview({
  detail,
  onClose,
  onChanged,
}: {
  detail: any;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [confirmFix, setConfirmFix] = useState<string>();
  const fixType =
    detail.recommendedAction === "카테고리 수정 검토"
      ? "CATEGORY"
      : detail.recommendedAction === "검색 이름 추가"
        ? "ALIAS"
        : undefined;
  return (
    <div className="copilot-modal" role="dialog" aria-modal="true">
      <section>
        <button className="quiet" onClick={onClose}>
          닫기
        </button>
        <small>
          {detail.core.regionId} ·{" "}
          {detail.health === "HEALTHY"
            ? "정상"
            : detail.health === "WARNING"
              ? "확인 필요"
              : "누락"}
        </small>
        <h2>{detail.core.displayName}</h2>
        <p>{detail.summary}</p>
        <h3>왜 확인해야 하나요?</h3>
        <ul>
          {detail.reasons.map((reason: string) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <h3>진단 근거</h3>
        <dl>
          <dt>검증</dt>
          <dd>
            {detail.evidence.verificationStatus || "canonical entity 없음"}
          </dd>
          <dt>운영 상태</dt>
          <dd>{detail.evidence.lifecycleStatus || "확인 불가"}</dd>
          <dt>카테고리</dt>
          <dd>{detail.evidence.category || "확인 불가"}</dd>
          <dt>좌표</dt>
          <dd>{detail.evidence.coordinatesAvailable ? "있음" : "없음"}</dd>
          <dt>관광지 탐색</dt>
          <dd>{detail.evidence.discoveryEligible ? "가능" : "현재 불가"}</dd>
        </dl>
        <p>
          <b>권장 조치:</b> {detail.recommendedAction}
        </p>
        {fixType && (
          <button className="approve" onClick={() => setConfirmFix(fixType)}>
            수정하기
          </button>
        )}
        {!fixType && detail.health !== "HEALTHY" && (
          <button onClick={() => setConfirmFix("REVIEW")}>확인 기록</button>
        )}
        {confirmFix && (
          <div role="alertdialog" className="confirmation">
            <b>
              {confirmFix === "CATEGORY"
                ? `${detail.evidence.category || "현재 분류"}를 ${detail.core.expectedCategory}로 변경할까요?`
                : confirmFix === "ALIAS"
                  ? `${detail.core.displayName}을 검색 이름으로 추가할까요?`
                  : "이 진단을 확인한 것으로 기록할까요?"}
            </b>
            <span>
              명시적으로 승인하기 전에는 지역 운영정보가 변경되지 않습니다.
            </span>
            <button
              onClick={async () => {
                if (confirmFix === "REVIEW")
                  await api(`/core-destinations/${detail.core.id}/review`, {
                    method: "POST",
                    body: JSON.stringify({ confirmed: true }),
                  });
                else
                  await api(
                    `/core-destinations/${detail.core.id}/fixes/${confirmFix}`,
                    {
                      method: "POST",
                      body: JSON.stringify({ confirmed: true }),
                    },
                  );
                await onChanged();
              }}
            >
              승인
            </button>
            <button onClick={() => setConfirmFix(undefined)}>보류</button>
          </div>
        )}
      </section>
    </div>
  );
}
function Review({
  detail,
  onClose,
  onChanged,
}: {
  detail: any;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [candidate, setCandidate] = useState(detail.candidate),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  const review = async () =>
    setCandidate(
      await api(`/candidates/${candidate.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          editedFacts: {
            displayName: candidate.displayName,
            category: candidate.category,
            address: candidate.address,
            phone: candidate.phone,
          },
        }),
      }),
    );
  return (
    <div className="copilot-modal" role="dialog" aria-modal="true">
      <section>
        <button className="quiet" onClick={onClose}>
          닫기
        </button>
        <small>
          {candidate.regionId} · {candidate.status}
        </small>
        <h2>{candidate.displayName}</h2>
        {detail.duplicateWarning && (
          <p className="warning">{detail.duplicateWarning}</p>
        )}
        <h3>왜 확인해야 하나요?</h3>
        <ul>
          {detail.why.map((x: string) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <h3>검색 증거</h3>
        <dl>
          <dt>유형</dt>
          <dd>{candidate.category}</dd>
          <dt>주소</dt>
          <dd>{candidate.address || "증거 없음"}</dd>
          <dt>전화</dt>
          <dd>{candidate.phone || "증거 없음"}</dd>
          <dt>출처</dt>
          <dd>{candidate.evidence.sourceType}</dd>
          <dt>발견일</dt>
          <dd>{candidate.evidence.discoveredAt}</dd>
        </dl>
        <h3>검토 값</h3>
        {["displayName", "category", "address", "phone"].map((key) => (
          <label key={key}>
            {key}
            <input
              value={candidate[key] || ""}
              onChange={(e) =>
                setCandidate({ ...candidate, [key]: e.target.value })
              }
            />
          </label>
        ))}
        <button onClick={review}>검토 내용 저장</button>
        {candidate.status === "REVIEW" && (
          <>
            <button className="approve" onClick={() => setConfirm(true)}>
              검증하여 활성화
            </button>
            <button
              className="danger"
              onClick={async () => {
                await api(`/candidates/${candidate.id}/reject`, {
                  method: "POST",
                });
                onChanged();
              }}
            >
              거부
            </button>
          </>
        )}
        {confirm && (
          <div role="alertdialog" className="confirmation">
            <b>
              이 정보를 검증된 {candidate.regionId} 지역정보로
              활성화하시겠습니까?
            </b>
            <button
              onClick={async () => {
                try {
                  await api(`/candidates/${candidate.id}/activate`, {
                    method: "POST",
                    body: JSON.stringify({ confirmed: true }),
                  });
                  onChanged();
                } catch (e: any) {
                  setError("중복 가능성 또는 필수 증거를 확인해 주세요.");
                }
              }}
            >
              검증하여 활성화
            </button>
            <button onClick={() => setConfirm(false)}>보류</button>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </div>
  );
}
createRoot(document.getElementById("copilot-root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
