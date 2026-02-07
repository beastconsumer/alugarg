import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import 'package:aluga_aluga/features/bookings/domain/booking.dart';
import 'package:aluga_aluga/features/properties/domain/property.dart';

class BookingRepository {
  BookingRepository(this._client);

  final SupabaseClient _client;
  final _uuid = const Uuid();

  static const int _clientFeePct = 10;
  static const int _ownerFeePct = 4;

  dynamic get _bookings => _client.from('bookings');
  dynamic get _reviews => _client.from('owner_reviews');

  BookingQuote buildQuote({
    required PropertyModel property,
    required DateTime checkIn,
    required DateTime checkOut,
  }) {
    final units = calculateBookingUnits(
      rentType: property.rentType,
      checkIn: checkIn,
      checkOut: checkOut,
    );
    final baseAmount = property.price * units;
    final clientFee = ((baseAmount * _clientFeePct) / 100).round();
    final ownerFee = ((baseAmount * _ownerFeePct) / 100).round();
    final totalPaid = baseAmount + clientFee;
    final ownerPayout = baseAmount - ownerFee;

    return BookingQuote(
      units: units,
      baseAmount: baseAmount,
      clientFeeAmount: clientFee,
      ownerFeeAmount: ownerFee,
      totalPaidByRenter: totalPaid,
      ownerPayoutAmount: ownerPayout,
    );
  }

  Future<void> createBooking({
    required PropertyModel property,
    required String renterId,
    required DateTime checkIn,
    required DateTime checkOut,
  }) async {
    if (property.status != PropertyStatus.approved) {
      throw Exception('Apenas imoveis aprovados podem receber reservas.');
    }
    if (!checkOut.isAfter(checkIn)) {
      throw Exception('Checkout deve ser posterior ao check-in.');
    }
    if (renterId == property.ownerId) {
      throw Exception('Nao e permitido reservar o proprio imovel.');
    }

    final hasOverlap = await _hasBookingOverlap(
      propertyId: property.id,
      checkIn: checkIn,
      checkOut: checkOut,
    );
    if (hasOverlap) {
      throw Exception(
        'Esse periodo ja possui uma reserva ativa para o imovel.',
      );
    }

    final quote = buildQuote(
      property: property,
      checkIn: checkIn,
      checkOut: checkOut,
    );
    final now = DateTime.now();

    final payload = <String, dynamic>{
      'id': _uuid.v4(),
      'property_id': property.id,
      'property_title': property.title,
      'renter_id': renterId,
      'owner_id': property.ownerId,
      'check_in_date': checkIn.toIso8601String(),
      'check_out_date': checkOut.toIso8601String(),
      'units': quote.units,
      'base_amount': quote.baseAmount,
      'client_fee_amount': quote.clientFeeAmount,
      'owner_fee_amount': quote.ownerFeeAmount,
      'total_paid_by_renter': quote.totalPaidByRenter,
      'owner_payout_amount': quote.ownerPayoutAmount,
      'status': 'paid',
      'created_at': now.toIso8601String(),
      'updated_at': now.toIso8601String(),
    };

    await _bookings.insert(payload);
  }

  Future<bool> _hasBookingOverlap({
    required String propertyId,
    required DateTime checkIn,
    required DateTime checkOut,
  }) async {
    final statuses = <String>[
      'pending_payment',
      'paid',
      'checked_in',
      'completed',
    ];
    final response = await _bookings
        .select('id,check_in_date,check_out_date,status')
        .eq('property_id', propertyId)
        .inFilter('status', statuses);

    final list = (response as List<dynamic>).cast<dynamic>();
    for (final row in list) {
      final start = DateTime.tryParse(row['check_in_date'] as String? ?? '');
      final end = DateTime.tryParse(row['check_out_date'] as String? ?? '');
      if (start == null || end == null) continue;
      final overlaps = checkIn.isBefore(end) && checkOut.isAfter(start);
      if (overlaps) return true;
    }
    return false;
  }

  Stream<List<BookingModel>> watchRenterBookings(String renterId) {
    return _client
        .from('bookings')
        .stream(primaryKey: ['id'])
        .eq('renter_id', renterId)
        .map((rows) {
          final list = rows.map((row) => BookingModel.fromMap(row)).toList();
          list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          return list;
        });
  }

  Stream<List<BookingModel>> watchOwnerBookings(String ownerId) {
    return _client
        .from('bookings')
        .stream(primaryKey: ['id'])
        .eq('owner_id', ownerId)
        .map((rows) {
          final list = rows.map((row) => BookingModel.fromMap(row)).toList();
          list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          return list;
        });
  }

  Future<void> updateBookingStatus({
    required String bookingId,
    required BookingStatus status,
  }) async {
    String statusName;
    switch (status) {
      case BookingStatus.pendingPayment:
        statusName = 'pending_payment';
        break;
      case BookingStatus.paid:
        statusName = 'paid';
        break;
      case BookingStatus.checkedIn:
        statusName = 'checked_in';
        break;
      case BookingStatus.completed:
        statusName = 'completed';
        break;
      case BookingStatus.cancelled:
        statusName = 'cancelled';
        break;
    }

    await _bookings
        .update({
          'status': statusName,
          'updated_at': DateTime.now().toIso8601String(),
        })
        .eq('id', bookingId);
  }

  Future<void> submitOwnerReview({
    required String bookingId,
    required String propertyId,
    required String renterId,
    required String ownerId,
    required int rating,
    required List<String> tags,
    required String comment,
  }) async {
    if (rating < 1 || rating > 5) {
      throw Exception('Avaliacao deve ser de 1 a 5.');
    }

    await _reviews.upsert({
      'id': _uuid.v4(),
      'booking_id': bookingId,
      'property_id': propertyId,
      'renter_id': renterId,
      'owner_id': ownerId,
      'rating': rating,
      'tags': tags,
      'comment': comment.trim(),
      'created_at': DateTime.now().toIso8601String(),
    }, onConflict: 'booking_id');
  }

  Future<bool> hasReviewForBooking(String bookingId) async {
    final row = await _reviews
        .select('id')
        .eq('booking_id', bookingId)
        .maybeSingle();
    return row != null;
  }
}
