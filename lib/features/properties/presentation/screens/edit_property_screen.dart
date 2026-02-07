import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import 'package:aluga_aluga/core/providers/app_providers.dart';
import 'package:aluga_aluga/core/widgets/app_page.dart';
import 'package:aluga_aluga/features/properties/domain/property.dart';

class EditPropertyScreen extends ConsumerStatefulWidget {
  const EditPropertyScreen({super.key, required this.property});

  final PropertyModel property;

  @override
  ConsumerState<EditPropertyScreen> createState() => _EditPropertyScreenState();
}

class _EditPropertyScreenState extends ConsumerState<EditPropertyScreen> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _titleCtrl;
  late final TextEditingController _descCtrl;
  late final TextEditingController _priceCtrl;
  late final TextEditingController _bedCtrl;
  late final TextEditingController _bathCtrl;
  late final TextEditingController _garageCtrl;
  late final TextEditingController _addressCtrl;

  late RentType _rentType;
  late bool _petFriendly;

  final _picker = ImagePicker();
  List<_EditablePhoto> _photos = [];

  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _titleCtrl = TextEditingController(text: widget.property.title);
    _descCtrl = TextEditingController(text: widget.property.description);
    _priceCtrl = TextEditingController(text: widget.property.price.toString());
    _bedCtrl = TextEditingController(text: widget.property.bedrooms.toString());
    _bathCtrl = TextEditingController(
      text: widget.property.bathrooms.toString(),
    );
    _garageCtrl = TextEditingController(
      text: widget.property.garageSpots.toString(),
    );
    _addressCtrl = TextEditingController(
      text: widget.property.location.addressText,
    );
    _rentType = widget.property.rentType;
    _petFriendly = widget.property.petFriendly;
    _photos = widget.property.photos.map(_EditablePhoto.existing).toList();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _priceCtrl.dispose();
    _bedCtrl.dispose();
    _bathCtrl.dispose();
    _garageCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _addPhotos() async {
    if (_saving) return;
    final files = await _picker.pickMultiImage();
    if (files.isEmpty) return;

    setState(() {
      _photos = [..._photos, ...files.map(_EditablePhoto.local)];
    });
  }

  void _removePhoto(int index) {
    if (_saving) return;
    if (index < 0 || index >= _photos.length) return;

    setState(() {
      _photos.removeAt(index);
    });
  }

  void _makeCover(int index) {
    if (_saving) return;
    if (index <= 0 || index >= _photos.length) return;

    setState(() {
      final selected = _photos.removeAt(index);
      _photos.insert(0, selected);
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    if (_photos.length < 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mantenha no minimo 3 fotos no anuncio.')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      final pendingFiles = _photos
          .where((item) => item.localFile != null)
          .map((item) => item.localFile!)
          .toList();

      final uploadedUrls = pendingFiles.isEmpty
          ? <String>[]
          : await ref
                .read(storageRepositoryProvider)
                .uploadPropertyImages(
                  ownerId: widget.property.ownerId,
                  propertyId: widget.property.id,
                  files: pendingFiles,
                );

      var localCursor = 0;
      final finalPhotos = <String>[];
      for (final photo in _photos) {
        if (photo.remoteUrl != null && photo.remoteUrl!.isNotEmpty) {
          finalPhotos.add(photo.remoteUrl!);
        } else {
          finalPhotos.add(uploadedUrls[localCursor]);
          localCursor += 1;
        }
      }

      final updated = widget.property.copyWith(
        title: _titleCtrl.text.trim(),
        description: _descCtrl.text.trim(),
        price: int.parse(_priceCtrl.text.trim()),
        bedrooms: int.parse(_bedCtrl.text.trim()),
        bathrooms: int.parse(_bathCtrl.text.trim()),
        garageSpots: int.tryParse(_garageCtrl.text.trim()) ?? 0,
        rentType: _rentType,
        petFriendly: _petFriendly,
        photos: finalPhotos,
        location: widget.property.location.copyWith(
          addressText: _addressCtrl.text.trim(),
        ),
        updatedAt: DateTime.now(),
      );

      await ref.read(propertyRepositoryProvider).updateProperty(updated);

      if (!mounted) return;
      context.pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Editar anuncio')),
      body: AppPage(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              TextFormField(
                controller: _titleCtrl,
                decoration: const InputDecoration(labelText: 'Titulo'),
                validator: (value) =>
                    (value ?? '').trim().isEmpty ? 'Obrigatorio' : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<RentType>(
                initialValue: _rentType,
                decoration: const InputDecoration(labelText: 'Tipo de aluguel'),
                onChanged: (value) =>
                    setState(() => _rentType = value ?? RentType.mensal),
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
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _priceCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Preco'),
                validator: (value) {
                  final parsed = int.tryParse((value ?? '').trim());
                  if (parsed == null || parsed <= 0) return 'Invalido';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _bedCtrl,
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
                      controller: _bathCtrl,
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
                  labelText: 'Vagas de garagem',
                ),
                validator: (value) {
                  final parsed = int.tryParse((value ?? '').trim());
                  if (parsed == null || parsed < 0) return 'Invalido';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _addressCtrl,
                decoration: const InputDecoration(labelText: 'Endereco'),
                validator: (value) =>
                    (value ?? '').trim().isEmpty ? 'Obrigatorio' : null,
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _petFriendly,
                title: const Text('Aceita pet'),
                onChanged: (value) => setState(() => _petFriendly = value),
              ),
              TextFormField(
                controller: _descCtrl,
                minLines: 3,
                maxLines: 5,
                decoration: const InputDecoration(labelText: 'Descricao'),
                validator: (value) => (value ?? '').trim().length < 20
                    ? 'Minimo 20 caracteres'
                    : null,
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Text(
                    'Fotos do imovel',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const Spacer(),
                  OutlinedButton.icon(
                    onPressed: _saving ? null : _addPhotos,
                    icon: const Icon(Icons.add_photo_alternate_outlined),
                    label: const Text('Adicionar'),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                'Toque em estrela para definir capa. Minimo 3 fotos.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 8),
              if (_photos.isEmpty)
                const Text('Sem fotos no anuncio.')
              else
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _photos.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                  ),
                  itemBuilder: (_, index) {
                    final item = _photos[index];
                    return _EditablePhotoTile(
                      photo: item,
                      isCover: index == 0,
                      onRemove: () => _removePhoto(index),
                      onMakeCover: index == 0 ? null : () => _makeCover(index),
                    );
                  },
                ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Salvar alteracoes'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EditablePhoto {
  const _EditablePhoto.existing(this.remoteUrl) : localFile = null;
  const _EditablePhoto.local(this.localFile) : remoteUrl = null;

  final String? remoteUrl;
  final XFile? localFile;
}

class _EditablePhotoTile extends StatelessWidget {
  const _EditablePhotoTile({
    required this.photo,
    required this.isCover,
    required this.onRemove,
    required this.onMakeCover,
  });

  final _EditablePhoto photo;
  final bool isCover;
  final VoidCallback onRemove;
  final VoidCallback? onMakeCover;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (photo.remoteUrl != null && photo.remoteUrl!.isNotEmpty)
            Image.network(photo.remoteUrl!, fit: BoxFit.cover)
          else if (photo.localFile != null)
            FutureBuilder<Uint8List>(
              future: photo.localFile!.readAsBytes(),
              builder: (context, snapshot) {
                if (!snapshot.hasData) {
                  return Container(color: const Color(0xFFE5E7EB));
                }
                return Image.memory(snapshot.data!, fit: BoxFit.cover);
              },
            )
          else
            Container(color: const Color(0xFFE5E7EB)),
          Positioned(
            top: 4,
            right: 4,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (onMakeCover != null)
                  _PhotoActionButton(
                    icon: Icons.star_border,
                    onTap: onMakeCover!,
                  ),
                const SizedBox(width: 4),
                _PhotoActionButton(icon: Icons.close, onTap: onRemove),
              ],
            ),
          ),
          if (isCover)
            Positioned(
              left: 4,
              top: 4,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.65),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'CAPA',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PhotoActionButton extends StatelessWidget {
  const _PhotoActionButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: 0.6),
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(
          width: 24,
          height: 24,
          child: Icon(icon, size: 14, color: Colors.white),
        ),
      ),
    );
  }
}
