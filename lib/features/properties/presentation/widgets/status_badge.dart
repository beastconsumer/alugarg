import 'package:flutter/material.dart';

import 'package:aluga_aluga/core/constants/app_colors.dart';
import 'package:aluga_aluga/core/constants/app_strings.dart';
import 'package:aluga_aluga/features/properties/domain/property.dart';

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});

  final PropertyStatus status;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      PropertyStatus.pending => AppColors.pending,
      PropertyStatus.approved => AppColors.approved,
      PropertyStatus.rejected => AppColors.rejected,
    };

    final label = switch (status) {
      PropertyStatus.pending => AppStrings.pending,
      PropertyStatus.approved => AppStrings.approved,
      PropertyStatus.rejected => AppStrings.rejected,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }
}
