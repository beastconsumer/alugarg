import { useEffect, useRef, useState } from 'react';
import { Box, Container, Paper, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { CalendarCheck2, Home, MapPin, MessageSquareText, User } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { usePushNotifications } from '../hooks/usePushNotifications';

const navItems = [
  { to: '/app/home',     label: 'Home',     icon: Home },
  { to: '/app/map',      label: 'Mapa',     icon: MapPin },
  { to: '/app/bookings', label: 'Reservas', icon: CalendarCheck2 },
  { to: '/app/chat',     label: 'Chat',     icon: MessageSquareText },
  { to: '/app/profile',  label: 'Perfil',   icon: User },
];

export function AppShell() {
  const location = useLocation();
  const [progressKey, setProgressKey] = useState<number | null>(null);
  const prevKey = useRef(location.key);
  usePushNotifications();

  useEffect(() => {
    if (location.key !== prevKey.current) {
      prevKey.current = location.key;
      setProgressKey(Date.now());
      const timer = setTimeout(() => setProgressKey(null), 650);
      return () => clearTimeout(timer);
    }
  }, [location.key]);

  return (
    <Box className="app-layout">
      {/* Top progress bar on navigation */}
      {progressKey !== null ? <div key={progressKey} className="route-progress-bar" /> : null}

      <Container size="lg" className="app-content">
        {/* Fade-in wrapper resets on each route */}
        <div key={location.key} className="page-enter">
          <Outlet />
        </div>
      </Container>

      <Paper className="bottom-nav" radius="xl" shadow="xl" withBorder>
        <Box className="bottom-nav-track">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.to);

            return (
              <UnstyledButton
                key={item.to}
                component={NavLink}
                to={item.to}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              >
                <ThemeIcon
                  variant={isActive ? 'filled' : 'light'}
                  color={isActive ? 'ocean' : 'gray'}
                  radius="xl"
                  size={30}
                  className="bottom-nav-icon"
                >
                  <Icon size={16} />
                </ThemeIcon>

                <Text className="bottom-nav-label">{item.label}</Text>
                <span className="bottom-nav-dot" aria-hidden />
              </UnstyledButton>
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
}
