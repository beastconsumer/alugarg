import 'package:flutter/material.dart';

import 'package:aluga_aluga/core/constants/app_strings.dart';

class AppLoading extends StatelessWidget {
  const AppLoading({super.key, this.message = AppStrings.loading});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 12),
          Text(message),
        ],
      ),
    );
  }
}
