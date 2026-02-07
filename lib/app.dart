import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:aluga_aluga/core/constants/app_strings.dart';
import 'package:aluga_aluga/core/theme/app_theme.dart';
import 'package:aluga_aluga/router/app_router.dart';

class AlugaAlugaApp extends ConsumerWidget {
  const AlugaAlugaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(goRouterProvider);

    return MaterialApp.router(
      title: AppStrings.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: router,
    );
  }
}
