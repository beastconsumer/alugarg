import 'package:flutter/material.dart';

import 'package:aluga_aluga/core/widgets/app_background.dart';

class AppPage extends StatelessWidget {
  const AppPage({
    super.key,
    required this.child,
    this.padding,
    this.maxWidth = 440,
    this.centerContent = true,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final double maxWidth;
  final bool centerContent;

  @override
  Widget build(BuildContext context) {
    Widget content = Padding(padding: padding ?? EdgeInsets.zero, child: child);

    if (centerContent) {
      content = Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: content,
        ),
      );
    }

    return AppBackground(child: content);
  }
}
