import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useRegion } from "../RegionContext";
import { regionalPath } from "../regionRouting";
import ConnectionStatus from "./ConnectionStatus";
import TripContinuity from "./TripContinuity";
import { ensureTripSession } from "../tripSession";
import { itineraryItemCount } from "../tripContinuity";

const navItems = [
  { to: "/", label: "홈", icon: "home", end: true },
  { to: "/nearby-discovery", label: "주변 찾기", icon: "map" },
  { to: "/itinerary", label: "내 여행", icon: "trip", end: false },
  { to: "/concierge", label: "AI에게 묻기", icon: "chat" },
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
  const [tripCount, setTripCount] = useState(() =>
    itineraryItemCount(ensureTripSession(region.id)),
  );
  useEffect(() => {
    const refresh = () =>
      setTripCount(itineraryItemCount(ensureTripSession(region.id)));
    window.addEventListener("regional-trip-saved", refresh);
    refresh();
    return () => window.removeEventListener("regional-trip-saved", refresh);
  }, [region.id]);
  return (
    <div className="app-shell">
      <ConnectionStatus />
      <header className="app-header">
        <div>
          <h1>{region.serviceName}</h1>
          <div className="subtitle">{region.heroSubtitle}</div>
        </div>
      </header>
      <main className="app-main">
        <TripContinuity />
        <Outlet />
      </main>
      <nav className="bottom-nav">
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
      </nav>
    </div>
  );
}
