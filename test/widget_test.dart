import 'package:flutter_test/flutter_test.dart';

import 'package:aluga_aluga/core/constants/app_strings.dart';

void main() {
  test('app name should match branding', () {
    expect(AppStrings.appName, 'Aluga Aluga');
  });
}
