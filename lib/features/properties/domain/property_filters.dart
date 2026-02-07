import 'package:aluga_aluga/features/properties/domain/property.dart';

class PropertyFilters {
  const PropertyFilters({
    this.searchText = '',
    this.rentType,
    this.petFriendlyOnly = false,
    this.maxPrice = 10000,
    this.minBedrooms = 0,
  });

  final String searchText;
  final RentType? rentType;
  final bool petFriendlyOnly;
  final int maxPrice;
  final int minBedrooms;

  PropertyFilters copyWith({
    String? searchText,
    RentType? rentType,
    bool clearRentType = false,
    bool? petFriendlyOnly,
    int? maxPrice,
    int? minBedrooms,
  }) {
    return PropertyFilters(
      searchText: searchText ?? this.searchText,
      rentType: clearRentType ? null : (rentType ?? this.rentType),
      petFriendlyOnly: petFriendlyOnly ?? this.petFriendlyOnly,
      maxPrice: maxPrice ?? this.maxPrice,
      minBedrooms: minBedrooms ?? this.minBedrooms,
    );
  }
}
