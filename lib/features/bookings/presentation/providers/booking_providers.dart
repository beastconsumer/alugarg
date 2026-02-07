import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:aluga_aluga/core/providers/app_providers.dart';
import 'package:aluga_aluga/features/bookings/domain/booking.dart';

final renterBookingsProvider = StreamProvider<List<BookingModel>>((ref) {
  final user = ref.watch(supabaseUserProvider).value;
  if (user == null) {
    return Stream.value(const []);
  }
  return ref.read(bookingRepositoryProvider).watchRenterBookings(user.id);
});

final ownerBookingsProvider = StreamProvider<List<BookingModel>>((ref) {
  final user = ref.watch(supabaseUserProvider).value;
  if (user == null) {
    return Stream.value(const []);
  }
  return ref.read(bookingRepositoryProvider).watchOwnerBookings(user.id);
});
