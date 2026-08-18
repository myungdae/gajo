import { NavLink, Outlet } from 'react-router-dom';
import { useRegion } from '../RegionContext';
import { regionalPath } from '../regionRouting';

const navItems = [
  { to: '/', label: '홈', icon: 'home', end: true },
  { to: '/concierge', label: '여행 안내', icon: 'chat' },
  { to: '/map', label: '지도', icon: 'map' },
  { to: '/admin', label: '관리자', icon: 'admin' },
];

function NavIcon({name}:{name:string}){const paths:Record<string,React.ReactNode>={home:<><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/></>,chat:<><path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 10h8M8 13h5"/></>,map:<><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></>,admin:<><path d="M5 20V10M12 20V4M19 20v-7"/></>};return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>}

export default function Layout() {
  const region=useRegion();
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>{region.serviceName}</h1>
          <div className="subtitle">{region.heroSubtitle}</div>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to==='/'?(region.id==='gajo'?'/':`/${region.id}`):regionalPath(item.to,region.id)}
            end={item.end}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <NavIcon name={item.icon}/>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
