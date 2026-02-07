import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:aluga_aluga/app.dart';
import 'package:aluga_aluga/core/config/runtime_config.dart';
import 'package:aluga_aluga/core/widgets/bootstrap_error_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    final config = RuntimeConfig.fromDartDefines();
    await Supabase.initialize(
      url: config.supabaseUrl,
      anonKey: config.supabaseAnonKey,
    );
    runApp(const ProviderScope(child: AlugaAlugaApp()));
  } catch (e) {
    runApp(BootstrapErrorApp(message: e.toString()));
  }
}
