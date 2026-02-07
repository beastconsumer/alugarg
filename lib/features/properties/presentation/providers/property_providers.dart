import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:aluga_aluga/core/providers/app_providers.dart';
import 'package:aluga_aluga/features/auth/domain/app_user.dart';
import 'package:aluga_aluga/features/properties/domain/property.dart';
import 'package:aluga_aluga/features/properties/domain/property_filters.dart';

class PropertyFiltersNotifier extends Notifier<PropertyFilters> {
  @override
  PropertyFilters build() => const PropertyFilters();

  void setFilters(PropertyFilters filters) {
    state = filters;
  }
}

final propertyFiltersProvider =
    NotifierProvider<PropertyFiltersNotifier, PropertyFilters>(
      PropertyFiltersNotifier.new,
    );

final propertyByIdProvider = StreamProvider.family<PropertyModel?, String>((
  ref,
  propertyId,
) {
  return ref.read(propertyRepositoryProvider).watchProperty(propertyId);
});

final ownerPhoneProvider = FutureProvider.family<String?, String>((
  ref,
  ownerId,
) async {
  final user = await ref.read(userRepositoryProvider).getUserById(ownerId);
  return user?.phone;
});

final ownerUserProvider = FutureProvider.family<AppUser?, String>((
  ref,
  ownerId,
) async {
  return ref.read(userRepositoryProvider).getUserById(ownerId);
});
