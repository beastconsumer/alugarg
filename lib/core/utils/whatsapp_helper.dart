import 'package:url_launcher/url_launcher.dart';

class WhatsappHelper {
  static Future<void> openChat({
    required String phone,
    required String message,
  }) async {
    final normalized = phone.replaceAll(RegExp(r'[^0-9]'), '');
    final text = Uri.encodeComponent(message);
    final uri = Uri.parse('https://wa.me/$normalized?text=$text');

    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      throw Exception('NÃ£o foi possÃ­vel abrir o WhatsApp.');
    }
  }
}
