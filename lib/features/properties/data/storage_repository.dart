import 'package:flutter/foundation.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class StorageRepository {
  StorageRepository(this._client);

  final SupabaseClient _client;

  static const String _bucketEnv = String.fromEnvironment('SUPABASE_BUCKET');

  String get _bucketName => _bucketEnv.isEmpty ? 'property-images' : _bucketEnv;

  Future<List<String>> uploadPropertyImages({
    required String ownerId,
    required String propertyId,
    required List<XFile> files,
  }) async {
    final urls = <String>[];
    final bucket = _client.storage.from(_bucketName);

    try {
      for (var i = 0; i < files.length; i++) {
        final file = files[i];
        Uint8List bytes;

        if (kIsWeb) {
          // Compression plugin is not guaranteed on web; upload original bytes.
          bytes = await file.readAsBytes();
        } else {
          final compressed = await FlutterImageCompress.compressWithFile(
            file.path,
            minWidth: 1280,
            minHeight: 960,
            quality: 78,
          );
          bytes = compressed ?? await file.readAsBytes();
        }

        final path =
            '$ownerId/$propertyId/${DateTime.now().millisecondsSinceEpoch}_$i.jpg';
        await bucket.uploadBinary(
          path,
          bytes,
          fileOptions: const FileOptions(
            contentType: 'image/jpeg',
            upsert: false,
          ),
        );
        urls.add(bucket.getPublicUrl(path));
      }
    } on StorageException catch (e) {
      final message = e.message.toLowerCase();
      if (e.statusCode == '404' || message.contains('bucket not found')) {
        throw Exception(
          'Bucket "$_bucketName" nao encontrado no Supabase Storage. '
          'Crie esse bucket como public e rode novamente.',
        );
      }
      if (e.statusCode == '401' || e.statusCode == '403') {
        throw Exception(
          'Sem permissao para upload no Storage. '
          'Confira as policies do bucket "$_bucketName".',
        );
      }
      rethrow;
    }

    return urls;
  }

  Future<String> uploadUserAvatar({
    required String userId,
    required XFile file,
  }) async {
    final bucket = _client.storage.from(_bucketName);
    Uint8List bytes;
    if (kIsWeb) {
      bytes = await file.readAsBytes();
    } else {
      final compressed = await FlutterImageCompress.compressWithFile(
        file.path,
        minWidth: 720,
        minHeight: 720,
        quality: 82,
      );
      bytes = compressed ?? await file.readAsBytes();
    }

    final path =
        '$userId/profiles/avatar_${DateTime.now().millisecondsSinceEpoch}.jpg';

    await bucket.uploadBinary(
      path,
      bytes,
      fileOptions: const FileOptions(contentType: 'image/jpeg', upsert: true),
    );

    return bucket.getPublicUrl(path);
  }
}
