import 'package:flutter/material.dart';

import 'package:aluga_aluga/core/constants/app_strings.dart';

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, this.message = AppStrings.noItems});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(message, textAlign: TextAlign.center),
      ),
    );
  }
}
