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
    [query, setQuery] = useState("");
  const load = () =>
    api(`/home?regionId=${encodeURIComponent(regionId)}`).then(setHome);
  useEffect(() => {
    void load();
  }, [regionId]);
  const open = async (task: any) =>
    task.candidate &&
    setSelected(await api(`/candidates/${task.candidate.id}`));
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
          “오늘 확인할 일”, “검색에서 발견된 곳”, “미검증 업체”를 물어볼 수
          있습니다.
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
              <h3>{task.candidate?.displayName || task.entity?.displayName}</h3>
              <p>{task.reason}</p>
              {task.candidate && (
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
    </main>
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
