import 'package:flutter/material.dart';

import 'package:aluga_aluga/features/auth/presentation/screens/auth_entry_screen.dart';

@Deprecated('Use AuthEntryScreen via /login route.')
class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const AuthEntryScreen();
  }
}
