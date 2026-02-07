class RuntimeConfig {
  const RuntimeConfig({
    required this.supabaseUrl,
    required this.supabaseAnonKey,
    required this.supabaseBucket,
    required this.mapsApiKey,
  });

  final String supabaseUrl;
  final String supabaseAnonKey;
  final String supabaseBucket;
  final String mapsApiKey;

  static RuntimeConfig fromDartDefines() {
    const rawUrl = String.fromEnvironment('SUPABASE_URL');
    const rawAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
    const rawBucket = String.fromEnvironment('SUPABASE_BUCKET');
    const rawMapsApiKey = String.fromEnvironment('MAPS_API_KEY');

    final supabaseUrl = rawUrl.trim();
    final supabaseAnonKey = rawAnonKey.trim();
    final supabaseBucket = rawBucket.trim().isEmpty
        ? 'property-images'
        : rawBucket.trim();
    final mapsApiKey = rawMapsApiKey.trim();

    if (supabaseUrl.isEmpty || supabaseAnonKey.isEmpty) {
      throw const FormatException(
        'SUPABASE_URL e SUPABASE_ANON_KEY sao obrigatorios. '
        'Use run_android.ps1 ou run_web.ps1 com valores reais.',
      );
    }

    if (supabaseUrl.contains('...') || supabaseAnonKey.contains('...')) {
      throw const FormatException(
        'Valores com "..." nao sao validos. Informe URL/ANON KEY reais do Supabase.',
      );
    }

    final parsed = Uri.tryParse(supabaseUrl);
    if (parsed == null || parsed.host.isEmpty || !parsed.hasScheme) {
      throw const FormatException(
        'SUPABASE_URL invalida. Exemplo: https://seu-projeto.supabase.co',
      );
    }

    return RuntimeConfig(
      supabaseUrl: supabaseUrl,
      supabaseAnonKey: supabaseAnonKey,
      supabaseBucket: supabaseBucket,
      mapsApiKey: mapsApiKey,
    );
  }
}
