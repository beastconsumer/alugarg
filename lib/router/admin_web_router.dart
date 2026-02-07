import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:aluga_aluga/core/providers/app_providers.dart';
import 'package:aluga_aluga/features/admin/presentation/screens/admin_panel_screen.dart';
import 'package:aluga_aluga/features/admin/presentation/screens/admin_web_login_screen.dart';

final adminWebRouterProvider = Provider<GoRouter>((ref) {
  final authRepository = ref.read(authRepositoryProvider);

  return GoRouter(
    initialLocation: '/admin-login',
    debugLogDiagnostics: kDebugMode,
    refreshListenable: _GoRouterRefreshStream(
      authRepository.authStateChanges(),
    ),
    redirect: (context, state) {
      final user = authRepository.currentUser;
      final location = state.matchedLocation;

      if (user == null && location != '/admin-login') {
        return '/admin-login';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/admin-login',
        builder: (context, state) => const AdminWebLoginScreen(),
      ),
      GoRoute(
        path: '/admin-dashboard',
        builder: (context, state) =>
            const AdminPanelScreen(showLogoutAction: true),
      ),
    ],
  );
});

class _GoRouterRefreshStream extends ChangeNotifier {
  _GoRouterRefreshStream(Stream<dynamic> stream) {
    _subscription = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  late final StreamSubscription<dynamic> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
