import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import 'package:aluga_aluga/core/constants/app_colors.dart';
import 'package:aluga_aluga/core/constants/app_strings.dart';
import 'package:aluga_aluga/core/providers/app_providers.dart';
import 'package:aluga_aluga/core/utils/currency_formatter.dart';
import 'package:aluga_aluga/core/widgets/app_loading.dart';
import 'package:aluga_aluga/core/widgets/app_page.dart';
import 'package:aluga_aluga/features/bookings/domain/booking.dart';
import 'package:aluga_aluga/features/bookings/presentation/providers/booking_providers.dart';
import 'package:aluga_aluga/features/properties/domain/property.dart';
import 'package:aluga_aluga/features/properties/presentation/widgets/status_badge.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _picker = ImagePicker();
  bool _uploadingAvatar = false;

  Future<void> _pickAvatar(String uid) async {
    if (_uploadingAvatar) return;

    final file = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
    );
    if (file == null) return;

    setState(() => _uploadingAvatar = true);
    try {
      final url = await ref
          .read(storageRepositoryProvider)
          .uploadUserAvatar(userId: uid, file: file);
      await ref
          .read(userRepositoryProvider)
          .updateAvatarUrl(uid: uid, avatarUrl: url);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Foto de perfil atualizada.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _uploadingAvatar = false);
    }
  }

  Future<void> _confirmSetStatus(String bookingId, BookingStatus status) async {
    await ref
        .read(bookingRepositoryProvider)
        .updateBookingStatus(bookingId: bookingId, status: status);
  }

  Future<void> _openReviewDialog(BookingModel booking) async {
    var rating = 5;
    final selectedTags = <String>{};
    final commentCtrl = TextEditingController();

    const tags = [
      'Pontual',
      'Imovel limpo',
      'Comunicacao excelente',
      'Anuncio fiel',
      'Ambiente seguro',
      'Voltaria a alugar',
    ];

    final ok = await showDialog<bool>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Avaliar anfitriao'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Nota geral'),
                    Slider(
                      value: rating.toDouble(),
                      min: 1,
                      max: 5,
                      divisions: 4,
                      label: '$rating',
                      onChanged: (value) =>
                          setDialogState(() => rating = value.round()),
                    ),
                    const SizedBox(height: 8),
                    const Text('Tags da experiencia'),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: tags
                          .map(
                            (tag) => FilterChip(
                              label: Text(tag),
                              selected: selectedTags.contains(tag),
                              onSelected: (selected) {
                                setDialogState(() {
                                  if (selected) {
                                    selectedTags.add(tag);
                                  } else {
                                    selectedTags.remove(tag);
                                  }
                                });
                              },
                            ),
                          )
                          .toList(),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: commentCtrl,
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        labelText: 'Comentario (opcional)',
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: const Text('Cancelar'),
                ),
                FilledButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  child: const Text('Enviar avaliacao'),
                ),
              ],
            );
          },
        );
      },
    );

    if (ok != true) return;

    await ref
        .read(bookingRepositoryProvider)
        .submitOwnerReview(
          bookingId: booking.id,
          propertyId: booking.propertyId,
          renterId: booking.renterId,
          ownerId: booking.ownerId,
          rating: rating,
          tags: selectedTags.toList(),
          comment: commentCtrl.text,
        );

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Avaliacao enviada com sucesso.')),
    );
  }

  String _bookingStatusLabel(BookingStatus status) {
    switch (status) {
      case BookingStatus.pendingPayment:
        return 'Aguardando pagamento';
      case BookingStatus.paid:
        return 'Pago';
      case BookingStatus.checkedIn:
        return 'Check-in confirmado';
      case BookingStatus.completed:
        return 'Concluida';
      case BookingStatus.cancelled:
        return 'Cancelada';
    }
  }

  @override
  Widget build(BuildContext context) {
    final appUserAsync = ref.watch(appUserProvider);
    final renterBookingsAsync = ref.watch(renterBookingsProvider);
    final ownerBookingsAsync = ref.watch(ownerBookingsProvider);

    return Scaffold(
      body: AppPage(
        padding: const EdgeInsets.all(16),
        child: appUserAsync.when(
          loading: () => const AppLoading(),
          error: (e, _) => Center(child: Text(e.toString())),
          data: (appUser) {
            if (appUser == null) {
              return const Center(child: Text('Usuario nao encontrado'));
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.06),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Stack(
                        children: [
                          CircleAvatar(
                            radius: 30,
                            backgroundColor: AppColors.primary.withValues(
                              alpha: 0.1,
                            ),
                            backgroundImage: appUser.avatarUrl.isEmpty
                                ? null
                                : NetworkImage(appUser.avatarUrl),
                            child: appUser.avatarUrl.isNotEmpty
                                ? null
                                : Text(
                                    appUser.name.isEmpty
                                        ? 'A'
                                        : appUser.name
                                              .substring(0, 1)
                                              .toUpperCase(),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                          ),
                          Positioned(
                            right: -2,
                            bottom: -2,
                            child: Material(
                              color: AppColors.primary,
                              shape: const CircleBorder(),
                              child: InkWell(
                                customBorder: const CircleBorder(),
                                onTap: _uploadingAvatar
                                    ? null
                                    : () => _pickAvatar(appUser.uid),
                                child: Padding(
                                  padding: const EdgeInsets.all(6),
                                  child: _uploadingAvatar
                                      ? const SizedBox(
                                          width: 14,
                                          height: 14,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Icon(
                                          Icons.camera_alt_outlined,
                                          size: 14,
                                          color: Colors.white,
                                        ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              appUser.name.isEmpty ? 'Sem nome' : appUser.name,
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 4),
                            Text(appUser.phone),
                            if (appUser.email.isNotEmpty) Text(appUser.email),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () async {
                          await ref.read(authRepositoryProvider).signOut();
                          if (context.mounted) {
                            context.go('/login');
                          }
                        },
                        icon: const Icon(Icons.logout),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.06),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Status',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              appUser.isAdmin ? 'Administrador' : 'Usuario',
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                      if (appUser.isAdmin)
                        FilledButton.tonalIcon(
                          onPressed: () => context.push('/admin'),
                          icon: const Icon(Icons.admin_panel_settings_outlined),
                          label: const Text(AppStrings.adminPanel),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Meus anuncios',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: StreamBuilder<List<PropertyModel>>(
                    stream: ref
                        .read(propertyRepositoryProvider)
                        .watchOwnerProperties(appUser.uid),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const AppLoading();
                      }

                      final items = snapshot.data ?? [];
                      return ListView(
                        children: [
                          if (items.isEmpty)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 8),
                              child: Text('Voce ainda nao publicou anuncios.'),
                            ),
                          ...items.map(
                            (property) => Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(18),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.04),
                                    blurRadius: 16,
                                    offset: const Offset(0, 8),
                                  ),
                                ],
                              ),
                              child: ListTile(
                                onTap: () =>
                                    context.push('/property/${property.id}'),
                                title: Text(property.title),
                                subtitle: Text(
                                  CurrencyFormatter.brl(property.price),
                                ),
                                leading: StatusBadge(status: property.status),
                                trailing: PopupMenuButton<String>(
                                  onSelected: (value) async {
                                    if (value == 'edit') {
                                      context.push(
                                        '/edit-property',
                                        extra: property,
                                      );
                                    }
                                    if (value == 'delete') {
                                      await ref
                                          .read(propertyRepositoryProvider)
                                          .deleteProperty(property.id);
                                    }
                                  },
                                  itemBuilder: (_) => const [
                                    PopupMenuItem(
                                      value: 'edit',
                                      child: Text('Editar'),
                                    ),
                                    PopupMenuItem(
                                      value: 'delete',
                                      child: Text('Excluir'),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Casas que aluguei',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 8),
                          renterBookingsAsync.when(
                            data: (bookings) {
                              if (bookings.isEmpty) {
                                return const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 8),
                                  child: Text(
                                    'Voce ainda nao realizou reservas.',
                                  ),
                                );
                              }
                              return Column(
                                children: bookings.map((booking) {
                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 8),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(18),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withValues(
                                            alpha: 0.04,
                                          ),
                                          blurRadius: 16,
                                          offset: const Offset(0, 8),
                                        ),
                                      ],
                                    ),
                                    child: ListTile(
                                      title: Text(
                                        booking.propertyTitle.isEmpty
                                            ? booking.propertyId
                                            : booking.propertyTitle,
                                      ),
                                      subtitle: Text(
                                        '${_bookingStatusLabel(booking.status)}\nTotal: ${CurrencyFormatter.brl(booking.totalPaidByRenter)}',
                                      ),
                                      isThreeLine: true,
                                      trailing:
                                          booking.status ==
                                              BookingStatus.completed
                                          ? FutureBuilder<bool>(
                                              future: ref
                                                  .read(
                                                    bookingRepositoryProvider,
                                                  )
                                                  .hasReviewForBooking(
                                                    booking.id,
                                                  ),
                                              builder: (context, snapshot) {
                                                final hasReview =
                                                    snapshot.data ?? false;
                                                if (hasReview) {
                                                  return const Icon(
                                                    Icons.verified_outlined,
                                                    color: AppColors.accent,
                                                  );
                                                }
                                                return OutlinedButton(
                                                  onPressed: () =>
                                                      _openReviewDialog(
                                                        booking,
                                                      ),
                                                  child: const Text('Avaliar'),
                                                );
                                              },
                                            )
                                          : booking.status == BookingStatus.paid
                                          ? OutlinedButton(
                                              onPressed: () =>
                                                  _confirmSetStatus(
                                                    booking.id,
                                                    BookingStatus.cancelled,
                                                  ),
                                              child: const Text('Cancelar'),
                                            )
                                          : null,
                                    ),
                                  );
                                }).toList(),
                              );
                            },
                            loading: () => const Padding(
                              padding: EdgeInsets.symmetric(vertical: 8),
                              child: AppLoading(),
                            ),
                            error: (e, _) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: Text(e.toString()),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Reservas nos meus imoveis',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 8),
                          ownerBookingsAsync.when(
                            data: (bookings) {
                              if (bookings.isEmpty) {
                                return const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 8),
                                  child: Text(
                                    'Nenhuma reserva recebida ate agora.',
                                  ),
                                );
                              }

                              return Column(
                                children: bookings.map((booking) {
                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 8),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(18),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withValues(
                                            alpha: 0.04,
                                          ),
                                          blurRadius: 16,
                                          offset: const Offset(0, 8),
                                        ),
                                      ],
                                    ),
                                    child: ListTile(
                                      title: Text(
                                        booking.propertyTitle.isEmpty
                                            ? booking.propertyId
                                            : booking.propertyTitle,
                                      ),
                                      subtitle: Text(
                                        '${_bookingStatusLabel(booking.status)}\nRepasse: ${CurrencyFormatter.brl(booking.ownerPayoutAmount)}',
                                      ),
                                      isThreeLine: true,
                                      trailing:
                                          booking.status == BookingStatus.paid
                                          ? FilledButton.tonal(
                                              onPressed: () =>
                                                  _confirmSetStatus(
                                                    booking.id,
                                                    BookingStatus.checkedIn,
                                                  ),
                                              child: const Text(
                                                'Confirmar check-in',
                                              ),
                                            )
                                          : booking.status ==
                                                BookingStatus.checkedIn
                                          ? FilledButton.tonal(
                                              onPressed: () =>
                                                  _confirmSetStatus(
                                                    booking.id,
                                                    BookingStatus.completed,
                                                  ),
                                              child: const Text('Concluir'),
                                            )
                                          : null,
                                    ),
                                  );
                                }).toList(),
                              );
                            },
                            loading: () => const Padding(
                              padding: EdgeInsets.symmetric(vertical: 8),
                              child: AppLoading(),
                            ),
                            error: (e, _) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: Text(e.toString()),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
