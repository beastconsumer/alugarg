import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:aluga_aluga/core/providers/app_providers.dart';
import 'package:aluga_aluga/core/widgets/app_error_view.dart';
import 'package:aluga_aluga/core/widgets/app_loading.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    Future.microtask(_resolveRoute);
  }

  Future<void> _resolveRoute() async {
    try {
      final authRepo = ref.read(authRepositoryProvider);
      final userRepo = ref.read(userRepositoryProvider);
      final user = authRepo.currentUser;

      if (user == null) {
        if (mounted) context.go('/login');
        return;
      }

      if (authRepo.isAnonymousUser(user)) {
        await authRepo.signOut();
        if (mounted) context.go('/login');
        return;
      }

      final appUser = await userRepo.getUserById(user.id);

      if (!mounted) return;

      if (appUser == null) {
        context.go('/signup');
      } else if (appUser.name.isEmpty ||
          appUser.phone.isEmpty ||
          appUser.cpf.isEmpty ||
          appUser.email.isEmpty) {
        context.go('/signup');
      } else {
        context.go('/home');
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: AppLoading());
    if (_error != null) {
      return Scaffold(
        body: AppErrorView(
          message: _error!,
          onRetry: () {
            setState(() {
              _loading = true;
              _error = null;
            });
            _resolveRoute();
          },
        ),
      );
    }
    return const Scaffold(body: AppLoading());
  }
}
