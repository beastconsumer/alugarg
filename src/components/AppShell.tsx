import { Box, Container, Paper, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { CalendarDays, Home, MapPin, User } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/app/home', label: 'Home', icon: Home },
  { to: '/app/map', label: 'Mapa', icon: MapPin },
  { to: '/app/bookings', label: 'Reservas', icon: CalendarDays },
  { to: '/app/profile', label: 'Perfil', icon: User },
];

export function AppShell() {
  const location = useLocation();

  return (
    <Box className="app-layout">
      <Container size="lg" className="app-content">
        <Outlet />
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
