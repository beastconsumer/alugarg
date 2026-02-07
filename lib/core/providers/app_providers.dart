import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:aluga_aluga/features/auth/data/auth_repository.dart';
import 'package:aluga_aluga/features/auth/data/user_repository.dart';
import 'package:aluga_aluga/features/auth/domain/app_user.dart';
import 'package:aluga_aluga/features/bookings/data/booking_repository.dart';
import 'package:aluga_aluga/features/properties/data/property_repository.dart';
import 'package:aluga_aluga/features/properties/data/storage_repository.dart';

final supabaseClientProvider = Provider<SupabaseClient>(
  (ref) => Supabase.instance.client,
);

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.read(supabaseClientProvider));
});

final userRepositoryProvider = Provider<UserRepository>((ref) {
  return UserRepository(ref.read(supabaseClientProvider));
});

final propertyRepositoryProvider = Provider<PropertyRepository>((ref) {
  return PropertyRepository(ref.read(supabaseClientProvider));
});

final storageRepositoryProvider = Provider<StorageRepository>((ref) {
  return StorageRepository(ref.read(supabaseClientProvider));
});

final bookingRepositoryProvider = Provider<BookingRepository>((ref) {
  return BookingRepository(ref.read(supabaseClientProvider));
});

final supabaseUserProvider = StreamProvider<User?>((ref) {
  return ref.read(authRepositoryProvider).authStateChanges();
});

final appUserProvider = StreamProvider<AppUser?>((ref) {
  final user = ref.watch(supabaseUserProvider).value;
  if (user == null) {
    return Stream.value(null);
  }
  return ref.read(userRepositoryProvider).watchUser(user.id);
});
