import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:aluga_aluga/core/constants/app_colors.dart';
import 'package:aluga_aluga/core/constants/app_strings.dart';
import 'package:aluga_aluga/core/providers/app_providers.dart';
import 'package:aluga_aluga/core/utils/currency_formatter.dart';
import 'package:aluga_aluga/core/widgets/app_error_view.dart';
import 'package:aluga_aluga/core/widgets/app_loading.dart';
import 'package:aluga_aluga/core/widgets/app_page.dart';
import 'package:aluga_aluga/core/widgets/empty_state.dart';
import 'package:aluga_aluga/features/properties/domain/property.dart';
import 'package:aluga_aluga/features/properties/domain/property_filters.dart';
import 'package:aluga_aluga/features/properties/presentation/providers/property_providers.dart';
import 'package:aluga_aluga/features/properties/presentation/widgets/property_card.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final _scrollCtrl = ScrollController();
  final _searchCtrl = TextEditingController();
  StreamSubscription<List<PropertyModel>>? _approvedSubscription;
  bool _ignoredFirstRealtimeEvent = false;

  final List<PropertyModel> _items = [];
  int _offset = 0;
  int? _nextOffset;

  bool _isInitialLoading = true;
  bool _isLoadingMore = false;
  String? _error;

  static const _pageSize = 10;

  TextStyle _chipLabelStyle(bool selected) {
    return TextStyle(
      color: selected ? const Color(0xFF0B2B6B) : const Color(0xFF334155),
      fontWeight: selected ? FontWeight.w800 : FontWeight.w700,
    );
  }

  Color _chipIconColor(bool selected) {
    return selected ? AppColors.primary : const Color(0xFF334155);
  }

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
    _approvedSubscription = ref
        .read(propertyRepositoryProvider)
        .watchApprovedProperties()
        .listen((_) {
          if (!_ignoredFirstRealtimeEvent) {
            _ignoredFirstRealtimeEvent = true;
            return;
          }
          if (mounted) {
            _loadInitial();
          }
        });
    Future.microtask(_loadInitial);
  }

  @override
  void dispose() {
    _approvedSubscription?.cancel();
    _scrollCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollCtrl.hasClients || _isLoadingMore || _nextOffset == null) {
      return;
    }
    final max = _scrollCtrl.position.maxScrollExtent;
    final current = _scrollCtrl.position.pixels;
    if (current >= max * 0.8) {
      _loadMore();
    }
  }

  Future<void> _loadInitial() async {
    setState(() {
      _isInitialLoading = true;
      _error = null;
      _offset = 0;
      _nextOffset = null;
      _items.clear();
    });

    try {
      final filters = ref.read(propertyFiltersProvider);
      final page = await ref
          .read(propertyRepositoryProvider)
          .fetchApprovedPage(
            limit: _pageSize,
            offset: _offset,
            rentType: filters.rentType,
            petFriendlyOnly: filters.petFriendlyOnly,
          );

      setState(() {
        _items.addAll(page.items);
        _nextOffset = page.nextOffset;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _isInitialLoading = false;
        });
      }
    }
  }

  Future<void> _loadMore() async {
    if (_isLoadingMore || _nextOffset == null) return;

    setState(() => _isLoadingMore = true);
    try {
      final filters = ref.read(propertyFiltersProvider);
      final page = await ref
          .read(propertyRepositoryProvider)
          .fetchApprovedPage(
            limit: _pageSize,
            offset: _nextOffset!,
            rentType: filters.rentType,
            petFriendlyOnly: filters.petFriendlyOnly,
          );

      setState(() {
        _items.addAll(page.items);
        _nextOffset = page.nextOffset;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) {
        setState(() => _isLoadingMore = false);
      }
    }
  }

  void _updateFilters(PropertyFilters filters, {bool reloadRemote = false}) {
    ref.read(propertyFiltersProvider.notifier).setFilters(filters);
    if (reloadRemote) {
      _loadInitial();
    }
  }

  List<PropertyModel> _filteredItems(PropertyFilters filters) {
    return _items.where((item) {
      final matchesPrice = item.price <= filters.maxPrice;
      final matchesBedrooms = item.bedrooms >= filters.minBedrooms;

      final search = filters.searchText.trim().toLowerCase();
      final matchesSearch =
          search.isEmpty ||
          item.title.toLowerCase().contains(search) ||
          item.location.addressText.toLowerCase().contains(search) ||
          item.description.toLowerCase().contains(search);

      return matchesPrice && matchesBedrooms && matchesSearch;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final filters = ref.watch(propertyFiltersProvider);
    _searchCtrl.value = _searchCtrl.value.copyWith(
      text: filters.searchText,
      selection: TextSelection.collapsed(offset: filters.searchText.length),
      composing: TextRange.empty,
    );
    final visibleItems = _filteredItems(filters);

    return Scaffold(
      body: AppPage(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Aluga Aluga',
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Balneario Cassino • Rio Grande',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: AppColors.text.withValues(alpha: 0.6),
                                ),
                          ),
                        ],
                      ),
                      const Spacer(),
                      IconButton.filledTonal(
                        onPressed: _loadInitial,
                        icon: const Icon(Icons.refresh),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Encontre seu lugar a poucos passos do mar',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.08),
                          blurRadius: 24,
                          offset: const Offset(0, 14),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        TextField(
                          controller: _searchCtrl,
                          onChanged: (value) => _updateFilters(
                            filters.copyWith(searchText: value),
                          ),
                          decoration: const InputDecoration(
                            hintText: AppStrings.searchHint,
                            prefixIcon: Icon(Icons.search),
                          ),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          height: 40,
                          child: ListView(
                            scrollDirection: Axis.horizontal,
                            children: [
                              FilterChip(
                                showCheckmark: false,
                                backgroundColor: const Color(0xFFF2F5FA),
                                selectedColor: const Color(0xFFDCE8FF),
                                avatar: Icon(
                                  Icons.calendar_month_outlined,
                                  size: 18,
                                  color: _chipIconColor(
                                    filters.rentType == RentType.mensal,
                                  ),
                                ),
                                selected: filters.rentType == RentType.mensal,
                                label: Text(
                                  AppStrings.rentMonthly,
                                  style: _chipLabelStyle(
                                    filters.rentType == RentType.mensal,
                                  ),
                                ),
                                onSelected: (selected) => _updateFilters(
                                  selected
                                      ? filters.copyWith(
                                          rentType: RentType.mensal,
                                        )
                                      : filters.copyWith(clearRentType: true),
                                  reloadRemote: true,
                                ),
                              ),
                              const SizedBox(width: 8),
                              FilterChip(
                                showCheckmark: false,
                                backgroundColor: const Color(0xFFF2F5FA),
                                selectedColor: const Color(0xFFDCE8FF),
                                avatar: Icon(
                                  Icons.beach_access_outlined,
                                  size: 18,
                                  color: _chipIconColor(
                                    filters.rentType == RentType.temporada,
                                  ),
                                ),
                                selected:
                                    filters.rentType == RentType.temporada,
                                label: Text(
                                  AppStrings.rentSeason,
                                  style: _chipLabelStyle(
                                    filters.rentType == RentType.temporada,
                                  ),
                                ),
                                onSelected: (selected) => _updateFilters(
                                  selected
                                      ? filters.copyWith(
                                          rentType: RentType.temporada,
                                        )
                                      : filters.copyWith(clearRentType: true),
                                  reloadRemote: true,
                                ),
                              ),
                              const SizedBox(width: 8),
                              FilterChip(
                                showCheckmark: false,
                                backgroundColor: const Color(0xFFF2F5FA),
                                selectedColor: const Color(0xFFDCE8FF),
                                avatar: Icon(
                                  Icons.sunny_snowing,
                                  size: 18,
                                  color: _chipIconColor(
                                    filters.rentType == RentType.diaria,
                                  ),
                                ),
                                selected: filters.rentType == RentType.diaria,
                                label: Text(
                                  AppStrings.rentDaily,
                                  style: _chipLabelStyle(
                                    filters.rentType == RentType.diaria,
                                  ),
                                ),
                                onSelected: (selected) => _updateFilters(
                                  selected
                                      ? filters.copyWith(
                                          rentType: RentType.diaria,
                                        )
                                      : filters.copyWith(clearRentType: true),
                                  reloadRemote: true,
                                ),
                              ),
                              const SizedBox(width: 8),
                              FilterChip(
                                showCheckmark: false,
                                backgroundColor: const Color(0xFFF2F5FA),
                                selectedColor: const Color(0xFFDCE8FF),
                                avatar: Icon(
                                  Icons.pets_outlined,
                                  size: 18,
                                  color: _chipIconColor(
                                    filters.petFriendlyOnly,
                                  ),
                                ),
                                selected: filters.petFriendlyOnly,
                                label: Text(
                                  AppStrings.pet,
                                  style: _chipLabelStyle(
                                    filters.petFriendlyOnly,
                                  ),
                                ),
                                onSelected: (selected) => _updateFilters(
                                  filters.copyWith(petFriendlyOnly: selected),
                                  reloadRemote: true,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Ate ${CurrencyFormatter.brl(filters.maxPrice)}',
                                  ),
                                  Slider(
                                    value: filters.maxPrice.toDouble(),
                                    min: 500,
                                    max: 20000,
                                    divisions: 39,
                                    label: CurrencyFormatter.brl(
                                      filters.maxPrice,
                                    ),
                                    onChanged: (value) => _updateFilters(
                                      filters.copyWith(maxPrice: value.toInt()),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 8,
                              ),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: Theme.of(context).dividerColor,
                                ),
                              ),
                              child: Row(
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.remove),
                                    onPressed: filters.minBedrooms > 0
                                        ? () => _updateFilters(
                                            filters.copyWith(
                                              minBedrooms:
                                                  filters.minBedrooms - 1,
                                            ),
                                          )
                                        : null,
                                  ),
                                  Text('${filters.minBedrooms}+ qts'),
                                  IconButton(
                                    icon: const Icon(Icons.add),
                                    onPressed: () => _updateFilters(
                                      filters.copyWith(
                                        minBedrooms: filters.minBedrooms + 1,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Builder(
                builder: (context) {
                  if (_isInitialLoading) return const AppLoading();
                  if (_error != null) {
                    return AppErrorView(
                      message: _error!,
                      onRetry: _loadInitial,
                    );
                  }
                  if (visibleItems.isEmpty) {
                    return const EmptyState(
                      message: 'Nenhum anuncio com esses filtros.',
                    );
                  }

                  return RefreshIndicator(
                    onRefresh: _loadInitial,
                    child: ListView.builder(
                      controller: _scrollCtrl,
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                      itemCount: visibleItems.length + (_isLoadingMore ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index >= visibleItems.length) {
                          return const Padding(
                            padding: EdgeInsets.all(16),
                            child: Center(child: CircularProgressIndicator()),
                          );
                        }

                        final property = visibleItems[index];
                        return TweenAnimationBuilder<double>(
                          duration: const Duration(milliseconds: 450),
                          tween: Tween(begin: 0, end: 1),
                          builder: (context, value, child) {
                            return Opacity(
                              opacity: value,
                              child: Transform.translate(
                                offset: Offset(0, (1 - value) * 12),
                                child: child,
                              ),
                            );
                          },
                          child: PropertyCard(
                            property: property,
                            onTap: () =>
                                context.push('/property/${property.id}'),
                          ),
                        );
                      },
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
