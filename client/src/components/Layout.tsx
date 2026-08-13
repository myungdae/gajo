import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: '홈', icon: '🏠', end: true },
  { to: '/concierge', label: 'AI 컨시어지', icon: '💬' },
  { to: '/map', label: '지도', icon: '🗺️' },
  { to: '/admin', label: '관리자', icon: '📊' },
];

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>가조 AI 컨시어지</h1>
          <div className="subtitle">거창 가조 온천단지 · 맞춤 여행 안내</div>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <span className="icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
