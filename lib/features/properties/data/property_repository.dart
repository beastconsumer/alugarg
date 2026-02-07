import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:aluga_aluga/features/properties/domain/property.dart';

class PropertyPageResult {
  const PropertyPageResult({required this.items, required this.nextOffset});

  final List<PropertyModel> items;
  final int? nextOffset;
}

class PropertyRepository {
  PropertyRepository(this._client);

  final SupabaseClient _client;

  dynamic get _properties => _client.from('properties');

  Future<PropertyPageResult> fetchApprovedPage({
    required int limit,
    required int offset,
    RentType? rentType,
    bool petFriendlyOnly = false,
  }) async {
    var query = _properties.select().eq('status', 'approved');

    if (rentType != null) {
      query = query.eq('rent_type', rentType.name);
    }

    if (petFriendlyOnly) {
      query = query.eq('pet_friendly', true);
    }

    final data = await query
        .order('created_at', ascending: false)
        .range(offset, offset + limit - 1);

    final list = (data as List<dynamic>)
        .map((row) => PropertyModel.fromMap(row))
        .toList();

    final nextOffset = list.length == limit ? offset + limit : null;

    return PropertyPageResult(items: list, nextOffset: nextOffset);
  }

  Future<List<PropertyModel>> fetchApprovedForMap() async {
    final data = await _properties
        .select()
        .eq('status', 'approved')
        .order('created_at', ascending: false)
        .limit(200);

    return (data as List<dynamic>)
        .map((row) => PropertyModel.fromMap(row))
        .toList();
  }

  Stream<PropertyModel?> watchProperty(String propertyId) {
    return _client
        .from('properties')
        .stream(primaryKey: ['id'])
        .eq('id', propertyId)
        .map((rows) => rows.isEmpty ? null : PropertyModel.fromMap(rows.first));
  }

  Stream<List<PropertyModel>> watchOwnerProperties(String ownerId) {
    return _client
        .from('properties')
        .stream(primaryKey: ['id'])
        .eq('owner_id', ownerId)
        .map((rows) {
          final list = rows.map((row) => PropertyModel.fromMap(row)).toList();
          list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          return list;
        });
  }

  Stream<List<PropertyModel>> watchPendingProperties() {
    return _client
        .from('properties')
        .stream(primaryKey: ['id'])
        .eq('status', 'pending')
        .map((rows) {
          final list = rows.map((row) => PropertyModel.fromMap(row)).toList();
          list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          return list;
        });
  }

  Stream<List<PropertyModel>> watchApprovedProperties() {
    return _client
        .from('properties')
        .stream(primaryKey: ['id'])
        .eq('status', 'approved')
        .map((rows) {
          final list = rows.map((row) => PropertyModel.fromMap(row)).toList();
          list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          return list;
        });
  }

  Stream<List<PropertyModel>> watchAdminProperties() {
    return _client.from('properties').stream(primaryKey: ['id']).map((rows) {
      final list = rows.map((row) => PropertyModel.fromMap(row)).toList();
      list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return list;
    });
  }

  Future<String> createProperty(PropertyModel property) async {
    await _properties.insert(property.toMap());
    return property.id;
  }

  Future<void> updateProperty(PropertyModel property) async {
    final data = property.toMap()
      ..remove('created_at')
      ..['updated_at'] = DateTime.now().toIso8601String();

    await _properties.update(data).eq('id', property.id);
  }

  Future<void> deleteProperty(String propertyId) async {
    await _properties.delete().eq('id', propertyId);
  }

  Future<void> moderateProperty({
    required String propertyId,
    required PropertyStatus status,
    bool? verified,
  }) async {
    final payload = <String, dynamic>{
      'status': status.name,
      'updated_at': DateTime.now().toIso8601String(),
    };

    if (verified != null) {
      payload['verified'] = verified;
    }

    await _properties.update(payload).eq('id', propertyId);
  }
}
