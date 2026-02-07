import 'package:url_launcher/url_launcher.dart';

class MapsHelper {
  static Future<void> openGoogleMaps({
    required double lat,
    required double lng,
    String? label,
  }) async {
    final query = label == null ? '$lat,$lng' : Uri.encodeComponent(label);
    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=$query',
    );

    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      throw Exception('NÃ£o foi possÃ­vel abrir o Google Maps.');
    }
  }
}
