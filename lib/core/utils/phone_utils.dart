class PhoneUtils {
  static String digitsOnly(String input) {
    return input.replaceAll(RegExp(r'[^0-9]'), '');
  }

  static String normalizeForStorage(String input) {
    final digits = digitsOnly(input);
    if (digits.isEmpty) return '';
    if (digits.startsWith('55')) return '+$digits';
    return '+55$digits';
  }

  static bool isValidBrazilianInternational(String input) {
    final normalized = normalizeForStorage(input);
    return RegExp(r'^\+[1-9][0-9]{10,14}$').hasMatch(normalized);
  }
}
