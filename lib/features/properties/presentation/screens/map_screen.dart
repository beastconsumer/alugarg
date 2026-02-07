import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import 'package:aluga_aluga/core/providers/app_providers.dart';
import 'package:aluga_aluga/core/utils/maps_helper.dart';
import 'package:aluga_aluga/core/widgets/app_error_view.dart';
import 'package:aluga_aluga/core/widgets/app_loading.dart';
import 'package:aluga_aluga/core/widgets/app_page.dart';
import 'package:aluga_aluga/core/widgets/empty_state.dart';
import 'package:aluga_aluga/features/properties/domain/property.dart';

class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  static const String _mapsApiKey = String.fromEnvironment(
    'MAPS_API_KEY',
    defaultValue: '',
  );

  bool _loading = true;
  bool _locating = false;
  String? _error;
  List<PropertyModel> _properties = [];
  PropertyModel? _selected;
  double? _userLat;
  double? _userLng;
  GoogleMapController? _mapCtrl;

  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(() => setState(() {}));
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _mapCtrl?.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      _properties = await ref
          .read(propertyRepositoryProvider)
          .fetchApprovedForMap();
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  bool get _hasMaps {
    if (_mapsApiKey.isEmpty) return false;
    if (_mapsApiKey.contains('YOUR_')) return false;
    if (_mapsApiKey.contains('...')) return false;
    return true;
  }

  Future<void> _useCurrentLocation() async {
    if (_locating) return;
    setState(() => _locating = true);

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw Exception(
          'Ative a localizacao do dispositivo para usar essa funcao.',
        );
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw Exception('Permissao de localizacao negada.');
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );

      if (!mounted) return;
      setState(() {
        _userLat = pos.latitude;
        _userLng = pos.longitude;
      });

      if (_hasMaps && _mapCtrl != null) {
        await _mapCtrl!.animateCamera(
          CameraUpdate.newLatLngZoom(LatLng(pos.latitude, pos.longitude), 13),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) {
        setState(() => _locating = false);
      }
    }
  }

  List<PropertyModel> get _filtered {
    final search = _searchCtrl.text.trim().toLowerCase();
    final filtered = _properties.where((item) {
      if (search.isEmpty) return true;
      return item.title.toLowerCase().contains(search) ||
          item.location.addressText.toLowerCase().contains(search);
    }).toList();

    if (_userLat != null && _userLng != null) {
      filtered.sort((a, b) {
        final aDistance = _distanceKm(
          _userLat!,
          _userLng!,
          a.location.lat,
          a.location.lng,
        );
        final bDistance = _distanceKm(
          _userLat!,
          _userLng!,
          b.location.lat,
          b.location.lng,
        );
        return aDistance.compareTo(bDistance);
      });
    }

    return filtered;
  }

  double _distanceKm(double lat1, double lng1, double lat2, double lng2) {
    const earthRadius = 6371.0;
    final dLat = _degToRad(lat2 - lat1);
    final dLng = _degToRad(lng2 - lng1);
    final a =
        math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_degToRad(lat1)) *
            math.cos(_degToRad(lat2)) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return earthRadius * c;
  }

  double _degToRad(double value) => value * (math.pi / 180);

  Set<Marker> _buildMarkers(List<PropertyModel> items) {
    return items
        .map(
          (item) => Marker(
            markerId: MarkerId(item.id),
            position: LatLng(item.location.lat, item.location.lng),
            infoWindow: InfoWindow(title: item.title),
            onTap: () {
              setState(() => _selected = item);
            },
          ),
        )
        .toSet();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: AppLoading());
    }

    if (_error != null) {
      return Scaffold(
        body: AppErrorView(message: _error!, onRetry: _load),
      );
    }

    if (_properties.isEmpty) {
      return const Scaffold(
        body: EmptyState(message: 'Sem imoveis aprovados no momento.'),
      );
    }

    final items = _filtered;
    final first = items.first;

    return Scaffold(
      body: AppPage(
        child: Column(
          children: [
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        'Mapa e localizacao',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const Spacer(),
                      FilledButton.tonal(
                        onPressed: _load,
                        child: const Text('Atualizar'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _searchCtrl,
                    decoration: const InputDecoration(
                      hintText: 'Digite bairro, rua ou ponto para filtrar',
                      prefixIcon: Icon(Icons.search),
                    ),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _locating ? null : _useCurrentLocation,
                    icon: _locating
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.my_location),
                    label: Text(
                      _locating
                          ? 'Buscando localizacao...'
                          : 'Usar minha localizacao atual',
                    ),
                  ),
                  if (!_hasMaps)
                    const Padding(
                      padding: EdgeInsets.only(top: 6),
                      child: Text(
                        'Mapa visual indisponivel sem MAPS_API_KEY. A lista e rotas continuam funcionando.',
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: !_hasMaps
                  ? _MapFallbackList(
                      items: items,
                      userLat: _userLat,
                      userLng: _userLng,
                    )
                  : Column(
                      children: [
                        Expanded(
                          flex: 5,
                          child: ClipRRect(
                            borderRadius: const BorderRadius.only(
                              topLeft: Radius.circular(24),
                              topRight: Radius.circular(24),
                            ),
                            child: GoogleMap(
                              initialCameraPosition: CameraPosition(
                                target: LatLng(
                                  first.location.lat,
                                  first.location.lng,
                                ),
                                zoom: 13,
                              ),
                              myLocationEnabled:
                                  _userLat != null && _userLng != null,
                              myLocationButtonEnabled: false,
                              onMapCreated: (controller) =>
                                  _mapCtrl = controller,
                              markers: _buildMarkers(items),
                            ),
                          ),
                        ),
                        if (_selected != null)
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: const BoxDecoration(
                              color: Colors.white,
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        _selected!.title,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: Theme.of(
                                          context,
                                        ).textTheme.titleMedium,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        _selected!.location.addressText,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                FilledButton(
                                  onPressed: () => context.push(
                                    '/property/${_selected!.id}',
                                  ),
                                  child: const Text('Ver'),
                                ),
                              ],
                            ),
                          ),
                        Expanded(
                          flex: 4,
                          child: _MapFallbackList(
                            items: items,
                            userLat: _userLat,
                            userLng: _userLng,
                          ),
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MapFallbackList extends StatelessWidget {
  const _MapFallbackList({required this.items, this.userLat, this.userLng});

  final List<PropertyModel> items;
  final double? userLat;
  final double? userLng;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return ListTile(
          title: Text(item.title),
          subtitle: Text(item.location.addressText),
          trailing: IconButton(
            icon: const Icon(Icons.open_in_new),
            onPressed: () => MapsHelper.openGoogleMaps(
              lat: item.location.lat,
              lng: item.location.lng,
              label: item.location.addressText,
            ),
          ),
        );
      },
    );
  }
}
