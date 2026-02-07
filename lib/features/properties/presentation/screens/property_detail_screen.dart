import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:aluga_aluga/core/constants/app_colors.dart';
import 'package:aluga_aluga/core/constants/app_strings.dart';
import 'package:aluga_aluga/core/providers/app_providers.dart';
import 'package:aluga_aluga/core/utils/currency_formatter.dart';
import 'package:aluga_aluga/core/utils/maps_helper.dart';
import 'package:aluga_aluga/core/widgets/app_error_view.dart';
import 'package:aluga_aluga/core/widgets/app_loading.dart';
import 'package:aluga_aluga/core/widgets/app_page.dart';
import 'package:aluga_aluga/features/bookings/domain/booking.dart';
import 'package:aluga_aluga/features/properties/domain/property.dart';
import 'package:aluga_aluga/features/properties/presentation/providers/property_providers.dart';

class PropertyDetailScreen extends ConsumerStatefulWidget {
  const PropertyDetailScreen({super.key, required this.propertyId});

  final String propertyId;

  @override
  ConsumerState<PropertyDetailScreen> createState() =>
      _PropertyDetailScreenState();
}

class _PropertyDetailScreenState extends ConsumerState<PropertyDetailScreen> {
  final _pageCtrl = PageController();
  int _currentPage = 0;

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  String _rentTypeLabel(RentType type) {
    switch (type) {
      case RentType.mensal:
        return AppStrings.rentMonthly;
      case RentType.temporada:
        return AppStrings.rentSeason;
      case RentType.diaria:
        return AppStrings.rentDaily;
    }
  }

  Future<void> _openReserveSheet(PropertyModel property) async {
    final user = ref.read(supabaseUserProvider).value;
    if (user == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Faca login para reservar.')),
      );
      return;
    }

    if (user.id == property.ownerId) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Nao e permitido reservar seu proprio imovel.'),
        ),
      );
      return;
    }

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return _ReserveSheet(
          property: property,
          onReserve: (checkIn, checkOut) async {
            await ref
                .read(bookingRepositoryProvider)
                .createBooking(
                  property: property,
                  renterId: user.id,
                  checkIn: checkIn,
                  checkOut: checkOut,
                );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final propertyAsync = ref.watch(propertyByIdProvider(widget.propertyId));

    return Scaffold(
      body: propertyAsync.when(
        loading: () => const AppLoading(),
        error: (e, _) => AppErrorView(message: e.toString()),
        data: (property) {
          if (property == null) {
            return const AppErrorView(message: 'Anuncio nao encontrado.');
          }

          final ownerAsync = ref.watch(ownerUserProvider(property.ownerId));
          return Stack(
            children: [
              AppPage(
                child: CustomScrollView(
                  slivers: [
                    SliverAppBar(
                      pinned: true,
                      expandedHeight: 320,
                      flexibleSpace: FlexibleSpaceBar(
                        background: _Gallery(
                          photos: property.photos,
                          pageController: _pageCtrl,
                          currentPage: _currentPage,
                          heroTag: 'property_${property.id}',
                          onPageChanged: (index) =>
                              setState(() => _currentPage = index),
                        ),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 160),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              property.title,
                              style: Theme.of(context).textTheme.headlineSmall
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary.withValues(
                                      alpha: 0.1,
                                    ),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    CurrencyFormatter.brl(property.price),
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleMedium
                                        ?.copyWith(
                                          color: AppColors.primary,
                                          fontWeight: FontWeight.w800,
                                        ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                _SoftChip(
                                  label: _rentTypeLabel(property.rentType),
                                ),
                                if (property.petFriendly) ...[
                                  const SizedBox(width: 8),
                                  const _SoftChip(label: AppStrings.pet),
                                ],
                                if (property.verified) ...[
                                  const SizedBox(width: 8),
                                  const _SoftChip(
                                    label: AppStrings.verified,
                                    icon: Icons.verified,
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                const Icon(
                                  Icons.place_outlined,
                                  size: 16,
                                  color: AppColors.text,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    property.location.addressText,
                                    style: Theme.of(
                                      context,
                                    ).textTheme.bodyMedium,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 20),
                            ownerAsync.when(
                              data: (owner) => Text(
                                owner == null
                                    ? 'Anfitriao'
                                    : 'Anfitriao: ${owner.name.isEmpty ? owner.phone : owner.name}',
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                              loading: () => const SizedBox.shrink(),
                              error: (_, _) => const SizedBox.shrink(),
                            ),
                            const SizedBox(height: 20),
                            Text(
                              'Sobre o imovel',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              property.description,
                              style: Theme.of(context).textTheme.bodyLarge,
                            ),
                            const SizedBox(height: 20),
                            Text(
                              'Comodidades',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                _InfoPill(
                                  icon: Icons.bed_outlined,
                                  label: '${property.bedrooms} quartos',
                                ),
                                _InfoPill(
                                  icon: Icons.bathtub_outlined,
                                  label: '${property.bathrooms} banheiros',
                                ),
                                _InfoPill(
                                  icon: Icons.garage_outlined,
                                  label: '${property.garageSpots} garagem',
                                ),
                                _InfoPill(
                                  icon: Icons.pets_outlined,
                                  label: property.petFriendly
                                      ? 'Aceita pet'
                                      : 'Sem pet',
                                ),
                              ],
                            ),
                            const SizedBox(height: 20),
                            Text(
                              'Localizacao',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 10),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: AppColors.border),
                                color: Colors.white,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.04),
                                    blurRadius: 16,
                                    offset: const Offset(0, 8),
                                  ),
                                ],
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(property.location.addressText),
                                  const SizedBox(height: 8),
                                  OutlinedButton.icon(
                                    onPressed: () => MapsHelper.openGoogleMaps(
                                      lat: property.location.lat,
                                      lng: property.location.lng,
                                      label: property.location.addressText,
                                    ),
                                    icon: const Icon(Icons.map_outlined),
                                    label: const Text('Ver no mapa'),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 20,
                child: Align(
                  alignment: Alignment.bottomCenter,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 520),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          FilledButton.icon(
                            onPressed: () => _openReserveSheet(property),
                            icon: const Icon(Icons.event_available_outlined),
                            label: const Text('Alugar ou reservar agora'),
                          ),
                          const SizedBox(height: 8),
                          OutlinedButton.icon(
                            onPressed: () => MapsHelper.openGoogleMaps(
                              lat: property.location.lat,
                              lng: property.location.lng,
                              label: property.location.addressText,
                            ),
                            icon: const Icon(Icons.near_me_outlined),
                            label: const Text('Ver rota ate o imovel'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ReserveSheet extends StatefulWidget {
  const _ReserveSheet({required this.property, required this.onReserve});

  final PropertyModel property;
  final Future<void> Function(DateTime checkIn, DateTime checkOut) onReserve;

  @override
  State<_ReserveSheet> createState() => _ReserveSheetState();
}

class _ReserveSheetState extends State<_ReserveSheet> {
  late DateTime _checkIn;
  late DateTime _checkOut;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _checkIn = DateTime(
      now.year,
      now.month,
      now.day,
    ).add(const Duration(days: 1));
    _checkOut = _checkIn.add(const Duration(days: 3));
  }

  BookingQuote get _quote {
    final units = calculateBookingUnits(
      rentType: widget.property.rentType,
      checkIn: _checkIn,
      checkOut: _checkOut,
    );
    final baseAmount = widget.property.price * units;
    final clientFee = ((baseAmount * 10) / 100).round();
    final ownerFee = ((baseAmount * 4) / 100).round();
    return BookingQuote(
      units: units,
      baseAmount: baseAmount,
      clientFeeAmount: clientFee,
      ownerFeeAmount: ownerFee,
      totalPaidByRenter: baseAmount + clientFee,
      ownerPayoutAmount: baseAmount - ownerFee,
    );
  }

  String get _unitLabel {
    switch (widget.property.rentType) {
      case RentType.mensal:
        return 'mes(es)';
      case RentType.temporada:
        return 'semana(s)';
      case RentType.diaria:
        return 'diaria(s)';
    }
  }

  Future<void> _pickDate({required bool isCheckIn}) async {
    final now = DateTime.now();
    final first = DateTime(now.year, now.month, now.day);
    final initial = isCheckIn ? _checkIn : _checkOut;
    final picked = await showDatePicker(
      context: context,
      firstDate: first,
      lastDate: first.add(const Duration(days: 365 * 2)),
      initialDate: initial,
    );
    if (picked == null) return;

    setState(() {
      if (isCheckIn) {
        _checkIn = picked;
        if (!_checkOut.isAfter(_checkIn)) {
          _checkOut = _checkIn.add(const Duration(days: 1));
        }
      } else {
        _checkOut = picked.isAfter(_checkIn)
            ? picked
            : _checkIn.add(const Duration(days: 1));
      }
    });
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      await widget.onReserve(_checkIn, _checkOut);
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Reserva registrada com sucesso.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final quote = _quote;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          4,
          16,
          16 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Reserva segura',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(widget.property.title),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pickDate(isCheckIn: true),
                    icon: const Icon(Icons.login_outlined),
                    label: Text(
                      'Check-in\n${_checkIn.day.toString().padLeft(2, '0')}/${_checkIn.month.toString().padLeft(2, '0')}/${_checkIn.year}',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pickDate(isCheckIn: false),
                    icon: const Icon(Icons.logout_outlined),
                    label: Text(
                      'Check-out\n${_checkOut.day.toString().padLeft(2, '0')}/${_checkOut.month.toString().padLeft(2, '0')}/${_checkOut.year}',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _PriceLine(
              label: 'Periodo calculado (${quote.units} $_unitLabel)',
              value: CurrencyFormatter.brl(quote.baseAmount),
            ),
            _PriceLine(
              label: 'Taxa plataforma (cliente 10%)',
              value: CurrencyFormatter.brl(quote.clientFeeAmount),
            ),
            const Divider(),
            _PriceLine(
              label: 'Total pago pelo inquilino',
              value: CurrencyFormatter.brl(quote.totalPaidByRenter),
              isHighlight: true,
            ),
            _PriceLine(
              label: 'Repasse ao proprietario (base - 4%)',
              value: CurrencyFormatter.brl(quote.ownerPayoutAmount),
            ),
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: const Icon(Icons.credit_card_outlined),
              label: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Confirmar reserva e pagamento'),
            ),
          ],
        ),
      ),
    );
  }
}

class _PriceLine extends StatelessWidget {
  const _PriceLine({
    required this.label,
    required this.value,
    this.isHighlight = false,
  });

  final String label;
  final String value;
  final bool isHighlight;

  @override
  Widget build(BuildContext context) {
    final style = isHighlight
        ? Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)
        : Theme.of(context).textTheme.bodyMedium;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text(label, style: style)),
          Text(value, style: style),
        ],
      ),
    );
  }
}

class _Gallery extends StatelessWidget {
  const _Gallery({
    required this.photos,
    required this.pageController,
    required this.currentPage,
    required this.heroTag,
    required this.onPageChanged,
  });

  final List<String> photos;
  final PageController pageController;
  final int currentPage;
  final String heroTag;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    if (photos.isEmpty) {
      return Container(
        color: AppColors.secondary,
        alignment: Alignment.center,
        child: const Icon(Icons.photo, size: 52),
      );
    }

    return Stack(
      children: [
        PageView.builder(
          controller: pageController,
          itemCount: photos.length,
          onPageChanged: onPageChanged,
          itemBuilder: (_, index) {
            final image = Image.network(
              photos[index],
              fit: BoxFit.cover,
              width: double.infinity,
            );
            if (index == 0) {
              return Hero(tag: heroTag, child: image);
            }
            return image;
          },
        ),
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, Color(0x66000000)],
              ),
            ),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 12,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              photos.length,
              (index) => Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.symmetric(horizontal: 3),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: currentPage == index ? Colors.white : Colors.white54,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF4F6FA),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [Icon(icon, size: 16), const SizedBox(width: 6), Text(label)],
      ),
    );
  }
}

class _SoftChip extends StatelessWidget {
  const _SoftChip({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF4F6FA),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: AppColors.accent),
            const SizedBox(width: 4),
          ],
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
