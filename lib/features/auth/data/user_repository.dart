import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:aluga_aluga/core/utils/phone_utils.dart';
import 'package:aluga_aluga/features/auth/domain/app_user.dart';

class UserRepository {
  UserRepository(this._client);

  final SupabaseClient _client;

  dynamic get _users => _client.from('users');

  Future<void> ensureUserDocument({
    required String userId,
    required String phone,
  }) async {
    await _users.upsert({
      'id': userId,
      'phone': PhoneUtils.normalizeForStorage(phone),
    }, onConflict: 'id');
  }

  Future<void> createOrUpdateAccount({
    required String uid,
    required String phone,
    required String name,
    required String cpf,
    required String email,
    required DateTime birthDate,
  }) async {
    final birthDateIso = birthDate.toIso8601String().split('T').first;
    await _users.upsert({
      'id': uid,
      'phone': PhoneUtils.normalizeForStorage(phone),
      'name': name.trim(),
      'cpf': cpf.trim(),
      'email': email.trim().toLowerCase(),
      'birth_date': birthDateIso,
    }, onConflict: 'id');
  }

  Future<bool> claimUserByPhone(String phone) async {
    final response = await _client.rpc(
      'claim_user_by_phone',
      params: {'p_phone': PhoneUtils.normalizeForStorage(phone)},
    );

    if (response is Map<String, dynamic>) {
      return response['found'] == true;
    }

    if (response is Map) {
      return response['found'] == true;
    }

    return false;
  }

  Future<String?> resolveLoginEmailByPhone(String phone) async {
    final response = await _client.rpc(
      'get_login_email_by_phone',
      params: {'p_phone': PhoneUtils.normalizeForStorage(phone)},
    );

    if (response == null) return null;
    final value = response.toString().trim().toLowerCase();
    if (value.isEmpty || value == 'null') return null;
    return value;
  }

  Future<void> updateName({required String uid, required String name}) async {
    await _users.update({'name': name.trim()}).eq('id', uid);
  }

  Future<void> updateAvatarUrl({
    required String uid,
    required String avatarUrl,
  }) async {
    await _users.update({'avatar_url': avatarUrl.trim()}).eq('id', uid);
  }

  Stream<AppUser?> watchUser(String uid) {
    return _client
        .from('users')
        .stream(primaryKey: ['id'])
        .eq('id', uid)
        .map((rows) => rows.isEmpty ? null : AppUser.fromMap(rows.first));
  }

  Future<AppUser?> getUserById(String uid) async {
    final row = await _users.select().eq('id', uid).maybeSingle();
    if (row == null) return null;
    return AppUser.fromMap(row);
  }
}
