import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useRegion } from "../RegionContext";
import { regionalPath } from "../regionRouting";
import ConnectionStatus from "./ConnectionStatus";
import { loadTripSession, tripRestorationDiagnostics } from "../tripSession";
import { itineraryItemCount } from "../tripContinuity";

const navItems = [
  { to: "/", label: "홈", icon: "home", end: true },
  { to: "/nearby-discovery", label: "주변 찾기", icon: "map" },
  { to: "/itinerary", label: "내 여행", icon: "trip", end: false },
  { to: "/concierge?mode=now", label: "AI 여행도우미", icon: "chat" },
];

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v10h13V10M9 20v-6h6v6" />
      </>
    ),
    chat: (
      <>
        <path d="M4 5h16v11H9l-5 4V5Z" />
        <path d="M8 10h8M8 13h5" />
      </>
    ),
    map: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
        <path d="M9 3v15M15 6v15" />
      </>
    ),
    trip: (
      <>
        <path d="M6 6h12v14H6z" />
        <path d="M9 6V4h6v2M9 11h6M9 15h4" />
      </>
    ),
    admin: (
      <>
        <path d="M5 20V10M12 20V4M19 20v-7" />
      </>
    ),
  };
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export default function Layout() {
  const region = useRegion();
  const location=useLocation(),diagnosticMode=new URLSearchParams(location.search).get("trip-diagnostics")==="1",partnerEntryRoute=location.pathname.startsWith("/go/");
  const mainRef = useRef<HTMLElement>(null);
  const [tripCount, setTripCount] = useState(() =>
    diagnosticMode?0:itineraryItemCount(loadTripSession(localStorage, region.id)),
  );
  useEffect(() => {
    if(diagnosticMode)return;
    const refresh = () =>
      setTripCount(itineraryItemCount(loadTripSession(localStorage, region.id)));
    window.addEventListener("regional-trip-saved", refresh);
    refresh();
    return () => window.removeEventListener("regional-trip-saved", refresh);
  }, [region.id,diagnosticMode]);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);
  if(diagnosticMode){const diagnostic=tripRestorationDiagnostics(region.id);return <main className="app-main"><section className="card" aria-label="여행 복원 진단"><h1>여행 복원 진단</h1><dl><dt>지역</dt><dd>{diagnostic.regionId}</dd><dt>활성 저장 키</dt><dd>{diagnostic.activeStorageKey}</dd><dt>localStorage</dt><dd>{diagnostic.localStorageKeyFound?'찾음':'없음'}</dd><dt>sessionStorage 보조</dt><dd>{diagnostic.sessionStorageFallbackFound?'찾음':'없음'}</dd><dt>저장값 상태</dt><dd>{diagnostic.storedValueStatus}</dd><dt>복원 출처</dt><dd>{diagnostic.restorationSource}</dd><dt>익명 ID</dt><dd>{diagnostic.anonymousTripIdHint||'없음'}</dd><dt>담아둔 곳</dt><dd>{diagnostic.savedPlaceCount}</dd><dt>일정 단계</dt><dd>{diagnostic.itineraryStepCount}</dd><dt>실행 상태</dt><dd>{diagnostic.executionStatePresent?'있음':'없음'}</dd><dt>보관 여행</dt><dd>{diagnostic.archiveCount??'확인 불가'}</dd><dt>새 세션 생성</dt><dd>{diagnostic.newSessionCreated?'예':'아니요'}</dd><dt>새 세션 생성 예정</dt><dd>{diagnostic.newSessionWouldBeCreated?'예':'아니요'}</dd><dt>복원 전 저장 발생</dt><dd>{diagnostic.persistenceOccurredBeforeRestoration?'예':'아니요'}</dd><dt>복원 전 저장 차단</dt><dd>{diagnostic.persistenceBlocked?'예':'아니요'}</dd></dl><p>이 화면은 저장소를 읽기만 하며 여행 데이터를 변경하지 않습니다.</p></section></main>}
  return (
    <div className="app-shell">
      <ConnectionStatus />
      {!partnerEntryRoute&&<header className="app-header">
        <div>
          <h1>{region.serviceName}</h1>
          <div className="subtitle">{region.heroSubtitle}</div>
        </div>
      </header>}
      <main className="app-main" ref={mainRef}>
        <Outlet />
      </main>
      {!partnerEntryRoute&&<nav className="bottom-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={
              item.to === "/"
                ? region.id === "gajo"
                  ? "/"
                  : `/${region.id}`
                : regionalPath(item.to, region.id)
            }
            end={item.end}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <NavIcon name={item.icon} />
            <span className="nav-label">
              {item.label}
              {item.to === "/itinerary" && tripCount > 0 && (
                <span className="my-trip-count" aria-label={`${tripCount}곳 담김`}>
                  {tripCount}
                </span>
              )}
            </span>
          </NavLink>
        ))}
      </nav>}
    </div>
  );
}
