class PropertyLocation {
  const PropertyLocation({
    required this.lat,
    required this.lng,
    required this.addressText,
  });

  final double lat;
  final double lng;
  final String addressText;

  PropertyLocation copyWith({double? lat, double? lng, String? addressText}) {
    return PropertyLocation(
      lat: lat ?? this.lat,
      lng: lng ?? this.lng,
      addressText: addressText ?? this.addressText,
    );
  }

  factory PropertyLocation.fromMap(Map<String, dynamic> map) {
    return PropertyLocation(
      lat: (map['lat'] as num?)?.toDouble() ?? 0,
      lng: (map['lng'] as num?)?.toDouble() ?? 0,
      addressText: (map['addressText'] as String? ?? '').trim(),
    );
  }

  Map<String, dynamic> toMap() {
    return {'lat': lat, 'lng': lng, 'addressText': addressText};
  }
}

enum RentType { mensal, temporada, diaria }

enum PropertyStatus { pending, approved, rejected }

class PropertyModel {
  const PropertyModel({
    required this.id,
    required this.ownerId,
    required this.title,
    required this.description,
    required this.price,
    required this.rentType,
    required this.bedrooms,
    required this.bathrooms,
    required this.garageSpots,
    required this.petFriendly,
    required this.verified,
    required this.status,
    required this.photos,
    required this.location,
    required this.createdAt,
    required this.updatedAt,
    this.viewsCount = 0,
  });

  final String id;
  final String ownerId;
  final String title;
  final String description;
  final int price;
  final RentType rentType;
  final int bedrooms;
  final int bathrooms;
  final int garageSpots;
  final bool petFriendly;
  final bool verified;
  final PropertyStatus status;
  final List<String> photos;
  final PropertyLocation location;
  final DateTime createdAt;
  final DateTime updatedAt;
  final int viewsCount;

  PropertyModel copyWith({
    String? id,
    String? ownerId,
    String? title,
    String? description,
    int? price,
    RentType? rentType,
    int? bedrooms,
    int? bathrooms,
    int? garageSpots,
    bool? petFriendly,
    bool? verified,
    PropertyStatus? status,
    List<String>? photos,
    PropertyLocation? location,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? viewsCount,
  }) {
    return PropertyModel(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      title: title ?? this.title,
      description: description ?? this.description,
      price: price ?? this.price,
      rentType: rentType ?? this.rentType,
      bedrooms: bedrooms ?? this.bedrooms,
      bathrooms: bathrooms ?? this.bathrooms,
      garageSpots: garageSpots ?? this.garageSpots,
      petFriendly: petFriendly ?? this.petFriendly,
      verified: verified ?? this.verified,
      status: status ?? this.status,
      photos: photos ?? this.photos,
      location: location ?? this.location,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      viewsCount: viewsCount ?? this.viewsCount,
    );
  }

  factory PropertyModel.fromMap(Map<String, dynamic> map) {
    DateTime parseDate(dynamic value) {
      if (value is String) return DateTime.tryParse(value) ?? DateTime.now();
      if (value is DateTime) return value;
      return DateTime.now();
    }

    final location = map['location'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(map['location'] as Map)
        : <String, dynamic>{};

    return PropertyModel(
      id: map['id'] as String? ?? '',
      ownerId: map['owner_id'] as String? ?? '',
      title: (map['title'] as String? ?? '').trim(),
      description: (map['description'] as String? ?? '').trim(),
      price: (map['price'] as num?)?.toInt() ?? 0,
      rentType: () {
        final raw = (map['rent_type'] as String? ?? 'mensal').trim();
        switch (raw) {
          case 'temporada':
            return RentType.temporada;
          case 'diaria':
            return RentType.diaria;
          default:
            return RentType.mensal;
        }
      }(),
      bedrooms: (map['bedrooms'] as num?)?.toInt() ?? 0,
      bathrooms: (map['bathrooms'] as num?)?.toInt() ?? 0,
      garageSpots: (map['garage_spots'] as num?)?.toInt() ?? 0,
      petFriendly: map['pet_friendly'] as bool? ?? false,
      verified: map['verified'] as bool? ?? false,
      status: _statusFromString(map['status'] as String?),
      photos: (map['photos'] as List<dynamic>? ?? [])
          .map((e) => e.toString())
          .toList(),
      location: PropertyLocation.fromMap(location),
      createdAt: parseDate(map['created_at']),
      updatedAt: parseDate(map['updated_at']),
      viewsCount: (map['views_count'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'owner_id': ownerId,
      'title': title,
      'description': description,
      'price': price,
      'rent_type': rentType.name,
      'bedrooms': bedrooms,
      'bathrooms': bathrooms,
      'garage_spots': garageSpots,
      'pet_friendly': petFriendly,
      'verified': verified,
      'status': status.name,
      'photos': photos,
      'location': location.toMap(),
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      'views_count': viewsCount,
    };
  }

  static PropertyStatus _statusFromString(String? value) {
    switch (value) {
      case 'approved':
        return PropertyStatus.approved;
      case 'rejected':
        return PropertyStatus.rejected;
      default:
        return PropertyStatus.pending;
    }
  }
}
