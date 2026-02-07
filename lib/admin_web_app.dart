import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:aluga_aluga/core/theme/app_theme.dart';
import 'package:aluga_aluga/router/admin_web_router.dart';

class AlugaAlugaAdminWebApp extends ConsumerWidget {
  const AlugaAlugaAdminWebApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(adminWebRouterProvider);

    return MaterialApp.router(
      title: 'Aluga Aluga Admin',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: router,
    );
  }
}
