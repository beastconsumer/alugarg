import 'package:aluga_aluga/features/properties/domain/property.dart';

enum BookingStatus { pendingPayment, paid, checkedIn, completed, cancelled }

class BookingQuote {
  const BookingQuote({
    required this.units,
    required this.baseAmount,
    required this.clientFeeAmount,
    required this.ownerFeeAmount,
    required this.totalPaidByRenter,
    required this.ownerPayoutAmount,
  });

  final int units;
  final int baseAmount;
  final int clientFeeAmount;
  final int ownerFeeAmount;
  final int totalPaidByRenter;
  final int ownerPayoutAmount;
}

class BookingModel {
  const BookingModel({
    required this.id,
    required this.propertyId,
    required this.renterId,
    required this.ownerId,
    required this.checkInDate,
    required this.checkOutDate,
    required this.units,
    required this.baseAmount,
    required this.clientFeeAmount,
    required this.ownerFeeAmount,
    required this.totalPaidByRenter,
    required this.ownerPayoutAmount,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.propertyTitle = '',
  });

  final String id;
  final String propertyId;
  final String renterId;
  final String ownerId;
  final DateTime checkInDate;
  final DateTime checkOutDate;
  final int units;
  final int baseAmount;
  final int clientFeeAmount;
  final int ownerFeeAmount;
  final int totalPaidByRenter;
  final int ownerPayoutAmount;
  final BookingStatus status;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String propertyTitle;

  factory BookingModel.fromMap(Map<String, dynamic> map) {
    DateTime parseDate(dynamic value) {
      if (value is String) {
        return DateTime.tryParse(value)?.toLocal() ?? DateTime.now();
      }
      if (value is DateTime) {
        return value.toLocal();
      }
      return DateTime.now();
    }

    BookingStatus parseStatus(String? value) {
      switch (value) {
        case 'paid':
          return BookingStatus.paid;
        case 'checked_in':
          return BookingStatus.checkedIn;
        case 'completed':
          return BookingStatus.completed;
        case 'cancelled':
          return BookingStatus.cancelled;
        default:
          return BookingStatus.pendingPayment;
      }
    }

    return BookingModel(
      id: (map['id'] as String? ?? '').trim(),
      propertyId: (map['property_id'] as String? ?? '').trim(),
      renterId: (map['renter_id'] as String? ?? '').trim(),
      ownerId: (map['owner_id'] as String? ?? '').trim(),
      checkInDate: parseDate(map['check_in_date']),
      checkOutDate: parseDate(map['check_out_date']),
      units: (map['units'] as num?)?.toInt() ?? 1,
      baseAmount: (map['base_amount'] as num?)?.toInt() ?? 0,
      clientFeeAmount: (map['client_fee_amount'] as num?)?.toInt() ?? 0,
      ownerFeeAmount: (map['owner_fee_amount'] as num?)?.toInt() ?? 0,
      totalPaidByRenter: (map['total_paid_by_renter'] as num?)?.toInt() ?? 0,
      ownerPayoutAmount: (map['owner_payout_amount'] as num?)?.toInt() ?? 0,
      status: parseStatus(map['status'] as String?),
      createdAt: parseDate(map['created_at']),
      updatedAt: parseDate(map['updated_at']),
      propertyTitle: (map['property_title'] as String? ?? '').trim(),
    );
  }

  Map<String, dynamic> toMap() {
    String statusName;
    switch (status) {
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
      case BookingStatus.pendingPayment:
        statusName = 'pending_payment';
        break;
    }

    return {
      'id': id,
      'property_id': propertyId,
      'renter_id': renterId,
      'owner_id': ownerId,
      'check_in_date': checkInDate.toIso8601String(),
      'check_out_date': checkOutDate.toIso8601String(),
      'units': units,
      'base_amount': baseAmount,
      'client_fee_amount': clientFeeAmount,
      'owner_fee_amount': ownerFeeAmount,
      'total_paid_by_renter': totalPaidByRenter,
      'owner_payout_amount': ownerPayoutAmount,
      'status': statusName,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }
}

class OwnerReviewModel {
  const OwnerReviewModel({
    required this.id,
    required this.bookingId,
    required this.propertyId,
    required this.renterId,
    required this.ownerId,
    required this.rating,
    required this.tags,
    required this.comment,
    required this.createdAt,
  });

  final String id;
  final String bookingId;
  final String propertyId;
  final String renterId;
  final String ownerId;
  final int rating;
  final List<String> tags;
  final String comment;
  final DateTime createdAt;

  factory OwnerReviewModel.fromMap(Map<String, dynamic> map) {
    DateTime parseDate(dynamic value) {
      if (value is String) {
        return DateTime.tryParse(value)?.toLocal() ?? DateTime.now();
      }
      if (value is DateTime) {
        return value.toLocal();
      }
      return DateTime.now();
    }

    return OwnerReviewModel(
      id: (map['id'] as String? ?? '').trim(),
      bookingId: (map['booking_id'] as String? ?? '').trim(),
      propertyId: (map['property_id'] as String? ?? '').trim(),
      renterId: (map['renter_id'] as String? ?? '').trim(),
      ownerId: (map['owner_id'] as String? ?? '').trim(),
      rating: (map['rating'] as num?)?.toInt() ?? 0,
      tags: (map['tags'] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList(),
      comment: (map['comment'] as String? ?? '').trim(),
      createdAt: parseDate(map['created_at']),
    );
  }
}

int calculateBookingUnits({
  required RentType rentType,
  required DateTime checkIn,
  required DateTime checkOut,
}) {
  final days = checkOut.difference(checkIn).inDays;
  final safeDays = days <= 0 ? 1 : days;
  switch (rentType) {
    case RentType.diaria:
      return safeDays;
    case RentType.temporada:
      return (safeDays / 7).ceil();
    case RentType.mensal:
      return (safeDays / 30).ceil();
  }
}
