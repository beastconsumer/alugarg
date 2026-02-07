import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:aluga_aluga/core/providers/app_providers.dart';
import 'package:aluga_aluga/features/admin/presentation/screens/admin_panel_screen.dart';
import 'package:aluga_aluga/features/auth/presentation/screens/auth_entry_screen.dart';
import 'package:aluga_aluga/features/auth/presentation/screens/complete_profile_screen.dart';
import 'package:aluga_aluga/features/auth/presentation/screens/phone_login_screen.dart';
import 'package:aluga_aluga/features/auth/presentation/screens/sign_up_screen.dart';
import 'package:aluga_aluga/features/auth/presentation/screens/splash_screen.dart';
import 'package:aluga_aluga/features/profile/presentation/screens/profile_screen.dart';
import 'package:aluga_aluga/features/properties/domain/property.dart';
import 'package:aluga_aluga/features/properties/presentation/screens/create_property_wizard_screen.dart';
import 'package:aluga_aluga/features/properties/presentation/screens/edit_property_screen.dart';
import 'package:aluga_aluga/features/properties/presentation/screens/home_screen.dart';
import 'package:aluga_aluga/features/properties/presentation/screens/map_screen.dart';
import 'package:aluga_aluga/features/properties/presentation/screens/property_detail_screen.dart';

final goRouterProvider = Provider<GoRouter>((ref) {
  final authRepository = ref.read(authRepositoryProvider);

  return GoRouter(
    initialLocation: '/',
    debugLogDiagnostics: kDebugMode,
    refreshListenable: GoRouterRefreshStream(authRepository.authStateChanges()),
    redirect: (context, state) {
      final user = authRepository.currentUser;
      final isAuthenticated = user != null;
      final location = state.matchedLocation;

      final isAuthRoute = location == '/login';
      final isPublicRoute =
          location == '/' ||
          isAuthRoute ||
          location == '/phone-login' ||
          location == '/signup' ||
          location == '/complete-profile';

      if (!isAuthenticated && !isPublicRoute) {
        return '/login';
      }

      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (context, state) => const SplashScreen()),
      GoRoute(
        path: '/login',
        builder: (context, state) => const AuthEntryScreen(),
      ),
      GoRoute(
        path: '/phone-login',
        builder: (context, state) => const PhoneLoginScreen(),
      ),
      GoRoute(
        path: '/signup',
        builder: (context, state) => const SignUpScreen(),
      ),
      GoRoute(
        path: '/complete-profile',
        builder: (context, state) => const CompleteProfileScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) {
          return AppShell(currentLocation: state.uri.toString(), child: child);
        },
        routes: [
          GoRoute(
            path: '/home',
            builder: (context, state) => const HomeScreen(),
          ),
          GoRoute(path: '/map', builder: (context, state) => const MapScreen()),
          GoRoute(
            path: '/announce',
            builder: (context, state) => const CreatePropertyWizardScreen(),
          ),
          GoRoute(
            path: '/profile',
            builder: (context, state) => const ProfileScreen(),
          ),
        ],
      ),
      GoRoute(
        path: '/property/:id',
        builder: (context, state) =>
            PropertyDetailScreen(propertyId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/edit-property',
        builder: (context, state) {
          final property = state.extra;
          if (property is! PropertyModel) {
            return const HomeScreen();
          }
          return EditPropertyScreen(property: property);
        },
      ),
      GoRoute(
        path: '/admin',
        builder: (context, state) => const AdminPanelScreen(),
      ),
    ],
  );
});

class AppShell extends StatelessWidget {
  const AppShell({
    super.key,
    required this.child,
    required this.currentLocation,
  });

  final Widget child;
  final String currentLocation;

  int _locationToIndex(String location) {
    if (location.startsWith('/map')) return 1;
    if (location.startsWith('/announce')) return 2;
    if (location.startsWith('/profile')) return 3;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final index = _locationToIndex(currentLocation);

    return Scaffold(
      body: child,
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 24,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: NavigationBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              selectedIndex: index,
              onDestinationSelected: (value) {
                if (value == 0) {
                  context.go('/home');
                } else if (value == 1) {
                  context.go('/map');
                } else if (value == 2) {
                  context.go('/announce');
                } else {
                  context.go('/profile');
                }
              },
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.home_outlined),
                  selectedIcon: Icon(Icons.home),
                  label: 'Home',
                ),
                NavigationDestination(
                  icon: Icon(Icons.map_outlined),
                  selectedIcon: Icon(Icons.map),
                  label: 'Mapa',
                ),
                NavigationDestination(
                  icon: Icon(Icons.add_box_outlined),
                  selectedIcon: Icon(Icons.add_box),
                  label: 'Anunciar',
                ),
                NavigationDestination(
                  icon: Icon(Icons.person_outline),
                  selectedIcon: Icon(Icons.person),
                  label: 'Perfil',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    _subscription = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  late final StreamSubscription<dynamic> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
