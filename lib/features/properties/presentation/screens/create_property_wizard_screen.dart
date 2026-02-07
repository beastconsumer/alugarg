import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';

import 'package:aluga_aluga/core/constants/app_strings.dart';
import 'package:aluga_aluga/core/providers/app_providers.dart';
import 'package:aluga_aluga/core/widgets/app_page.dart';
import 'package:aluga_aluga/features/properties/domain/property.dart';

class CreatePropertyWizardScreen extends ConsumerStatefulWidget {
  const CreatePropertyWizardScreen({super.key});

  @override
  ConsumerState<CreatePropertyWizardScreen> createState() =>
      _CreatePropertyWizardScreenState();
}

class _CreatePropertyWizardScreenState
    extends ConsumerState<CreatePropertyWizardScreen> {
  final _infoFormKey = GlobalKey<FormState>();
  final _locationFormKey = GlobalKey<FormState>();

  final _titleCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _bedroomsCtrl = TextEditingController(text: '1');
  final _bathroomsCtrl = TextEditingController(text: '1');
  final _garageCtrl = TextEditingController(text: '0');
  final _descriptionCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();

  RentType _rentType = RentType.mensal;
  bool _petFriendly = false;
  double? _pickedLat;
  double? _pickedLng;
  int _currentStep = 0;
  bool _submitting = false;

  static const double _defaultLat = -32.1738;
  static const double _defaultLng = -52.1630;

  final _picker = ImagePicker();
  final _uuid = const Uuid();
  List<XFile> _images = [];

  @override
  void dispose() {
    _titleCtrl.dispose();
    _priceCtrl.dispose();
    _bedroomsCtrl.dispose();
    _bathroomsCtrl.dispose();
    _garageCtrl.dispose();
    _descriptionCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImages() async {
    final files = await _picker.pickMultiImage();
    if (files.isNotEmpty) {
      setState(() => _images = files);
    }
  }

  bool _validateStep(int step) {
    if (step == 0) {
      return _infoFormKey.currentState?.validate() ?? false;
    }

    if (step == 1) {
      final valid = _locationFormKey.currentState?.validate() ?? false;
      if (!valid) return false;
      return true;
    }

    if (_images.length < 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecione no minimo 3 fotos.')),
      );
      return false;
    }

    return true;
  }

  Future<void> _publish() async {
    if (!_validateStep(2)) return;

    final authUser = ref.read(authRepositoryProvider).currentUser;
    if (authUser == null) {
      if (!mounted) return;
      context.go('/login');
      return;
    }
    setState(() => _submitting = true);
    try {
      final propertyId = _uuid.v4();
      final urls = await ref
          .read(storageRepositoryProvider)
          .uploadPropertyImages(
            ownerId: authUser.id,
            propertyId: propertyId,
            files: _images,
          );

      final now = DateTime.now();
      final lat = _pickedLat ?? _defaultLat;
      final lng = _pickedLng ?? _defaultLng;
      final property = PropertyModel(
        id: propertyId,
        ownerId: authUser.id,
        title: _titleCtrl.text.trim(),
        description: _descriptionCtrl.text.trim(),
        price: int.parse(_priceCtrl.text.trim()),
        rentType: _rentType,
        bedrooms: int.parse(_bedroomsCtrl.text.trim()),
        bathrooms: int.parse(_bathroomsCtrl.text.trim()),
        garageSpots: int.tryParse(_garageCtrl.text.trim()) ?? 0,
        petFriendly: _petFriendly,
        verified: false,
        status: PropertyStatus.pending,
        photos: urls,
        location: PropertyLocation(
          lat: lat,
          lng: lng,
          addressText: _addressCtrl.text.trim(),
        ),
        createdAt: now,
        updatedAt: now,
      );

      await ref.read(propertyRepositoryProvider).createProperty(property);

      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text(AppStrings.pendingApproval),
          content: const Text(
            'Seu anuncio foi enviado e ficara visivel apos moderacao.',
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Ok'),
            ),
          ],
        ),
      );

      if (!mounted) return;
      context.go('/home');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  List<Step> _steps() {
    return [
      Step(
        title: const Text('Info'),
        isActive: _currentStep >= 0,
        content: Form(
          key: _infoFormKey,
          child: Column(
            children: [
              TextFormField(
                controller: _titleCtrl,
                decoration: const InputDecoration(labelText: 'Titulo'),
                validator: (value) {
                  if ((value ?? '').trim().isEmpty) return 'Titulo obrigatorio';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<RentType>(
                initialValue: _rentType,
                decoration: const InputDecoration(labelText: 'Tipo de aluguel'),
                items: const [
                  DropdownMenuItem(
                    value: RentType.mensal,
                    child: Text('Mensal'),
                  ),
                  DropdownMenuItem(
                    value: RentType.temporada,
                    child: Text('Temporada'),
                  ),
                  DropdownMenuItem(
                    value: RentType.diaria,
                    child: Text('Diaria'),
                  ),
                ],
                onChanged: (value) =>
                    setState(() => _rentType = value ?? RentType.mensal),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _priceCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Preco (R\$)'),
                validator: (value) {
                  final price = int.tryParse((value ?? '').trim());
                  if (price == null || price <= 0) {
                    return 'Preco deve ser maior que zero';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _bedroomsCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Quartos'),
                      validator: (value) {
                        if ((int.tryParse((value ?? '').trim()) ?? 0) <= 0) {
                          return 'Invalido';
                        }
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _bathroomsCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Banheiros'),
                      validator: (value) {
                        if ((int.tryParse((value ?? '').trim()) ?? 0) <= 0) {
                          return 'Invalido';
                        }
                        return null;
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _garageCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Vagas de garagem (0 se nao tiver)',
                ),
                validator: (value) {
                  final garages = int.tryParse((value ?? '').trim());
                  if (garages == null || garages < 0) return 'Valor invalido';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _petFriendly,
                title: const Text('Aceita pet'),
                onChanged: (value) => setState(() => _petFriendly = value),
              ),
              TextFormField(
                controller: _descriptionCtrl,
                minLines: 3,
                maxLines: 5,
                decoration: const InputDecoration(
                  labelText: AppStrings.description,
                ),
                validator: (value) {
                  if ((value ?? '').trim().length < 20) {
                    return 'Descricao com pelo menos 20 caracteres';
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
      ),
      Step(
        title: const Text('Local'),
        isActive: _currentStep >= 1,
        content: Form(
          key: _locationFormKey,
          child: Column(
            children: [
              TextFormField(
                controller: _addressCtrl,
                decoration: const InputDecoration(
                  labelText: 'Endereco de referencia',
                ),
                validator: (value) {
                  if ((value ?? '').trim().isEmpty) return 'Informe o endereco';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'Mapa automatico (opcional)',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'Por enquanto, o endereco informado sera usado como referencia. '
                      'Quando a API de mapas estiver configurada, as coordenadas serao '
                      'obtidas automaticamente pelo endereco.',
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      Step(
        title: const Text('Fotos'),
        isActive: _currentStep >= 2,
        content: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            OutlinedButton.icon(
              onPressed: _pickImages,
              icon: const Icon(Icons.photo_library_outlined),
              label: const Text('Selecionar fotos'),
            ),
            const SizedBox(height: 8),
            Text('Selecionadas: ${_images.length} (minimo 3)'),
            const SizedBox(height: 8),
            if (_images.isNotEmpty)
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _images.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                ),
                itemBuilder: (_, index) {
                  return ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: FutureBuilder<Uint8List>(
                      future: _images[index].readAsBytes(),
                      builder: (context, snapshot) {
                        if (!snapshot.hasData) {
                          return const ColoredBox(color: Color(0xFFE5E7EB));
                        }
                        return Image.memory(snapshot.data!, fit: BoxFit.cover);
                      },
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Anunciar imovel')),
      body: AppPage(
        padding: const EdgeInsets.all(16),
        child: Stepper(
          currentStep: _currentStep,
          onStepTapped: (value) => setState(() => _currentStep = value),
          controlsBuilder: (context, details) {
            final isLast = _currentStep == 2;

            return Row(
              children: [
                FilledButton(
                  onPressed: _submitting
                      ? null
                      : () {
                          if (!isLast) {
                            if (_validateStep(_currentStep)) {
                              setState(() => _currentStep += 1);
                            }
                            return;
                          }
                          _publish();
                        },
                  child: _submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(isLast ? AppStrings.publish : AppStrings.next),
                ),
                const SizedBox(width: 8),
                if (_currentStep > 0)
                  OutlinedButton(
                    onPressed: _submitting
                        ? null
                        : () => setState(() => _currentStep -= 1),
                    child: const Text(AppStrings.back),
                  ),
              ],
            );
          },
          steps: _steps(),
        ),
      ),
    );
  }
}
