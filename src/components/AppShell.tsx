import { Home, MapPin, PlusSquare, User, CalendarDays } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/app/home', label: 'Home', icon: Home },
  { to: '/app/map', label: 'Mapa', icon: MapPin },
  { to: '/app/announce', label: 'Anunciar', icon: PlusSquare },
  { to: '/app/bookings', label: 'Reservas', icon: CalendarDays },
  { to: '/app/profile', label: 'Perfil', icon: User },
];

export function AppShell() {
  return (
    <div className="app-layout">
      <div className="app-content">
        <Outlet />
      </div>

      <nav className="bottom-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

