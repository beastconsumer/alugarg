import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:aluga_aluga/core/constants/app_colors.dart';
import 'package:aluga_aluga/core/providers/app_providers.dart';
import 'package:aluga_aluga/core/utils/currency_formatter.dart';
import 'package:aluga_aluga/core/widgets/app_loading.dart';
import 'package:aluga_aluga/core/widgets/app_page.dart';
import 'package:aluga_aluga/features/properties/domain/property.dart';
import 'package:aluga_aluga/features/properties/presentation/widgets/status_badge.dart';

enum _AdminStatusFilter { all, pending, approved, rejected }

class AdminPanelScreen extends ConsumerStatefulWidget {
  const AdminPanelScreen({super.key, this.showLogoutAction = false});

  final bool showLogoutAction;

  @override
  ConsumerState<AdminPanelScreen> createState() => _AdminPanelScreenState();
}

class _AdminPanelScreenState extends ConsumerState<AdminPanelScreen> {
  final TextEditingController _searchCtrl = TextEditingController();
  final Set<String> _busyIds = <String>{};

  _AdminStatusFilter _statusFilter = _AdminStatusFilter.pending;
  String _search = '';
  String? _selectedId;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _moderate(
    PropertyModel property, {
    required PropertyStatus status,
    bool? verified,
  }) async {
    if (_busyIds.contains(property.id)) return;

    setState(() => _busyIds.add(property.id));
    try {
      await ref
          .read(propertyRepositoryProvider)
          .moderateProperty(
            propertyId: property.id,
            status: status,
            verified: verified,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Moderacao salva com sucesso.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Falha ao salvar moderacao: $e')));
    } finally {
      if (mounted) {
        setState(() => _busyIds.remove(property.id));
      }
    }
  }

  List<PropertyModel> _applyFilters(List<PropertyModel> items) {
    final query = _search.trim().toLowerCase();

    return items.where((item) {
      final statusMatch = switch (_statusFilter) {
        _AdminStatusFilter.all => true,
        _AdminStatusFilter.pending => item.status == PropertyStatus.pending,
        _AdminStatusFilter.approved => item.status == PropertyStatus.approved,
        _AdminStatusFilter.rejected => item.status == PropertyStatus.rejected,
      };

      if (!statusMatch) return false;
      if (query.isEmpty) return true;

      final haystack = [
        item.title,
        item.description,
        item.location.addressText,
        item.ownerId,
        item.id,
      ].join(' ').toLowerCase();

      return haystack.contains(query);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final appUserAsync = ref.watch(appUserProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Painel Admin'),
        actions: [
          if (widget.showLogoutAction)
            IconButton(
              tooltip: 'Sair',
              onPressed: () async {
                await ref.read(authRepositoryProvider).signOut();
                if (!mounted) return;
                ScaffoldMessenger.of(this.context).showSnackBar(
                  const SnackBar(content: Text('Sessao encerrada.')),
                );
              },
              icon: const Icon(Icons.logout),
            ),
        ],
      ),
      body: AppPage(
        maxWidth: 1320,
        padding: const EdgeInsets.all(16),
        child: appUserAsync.when(
          loading: () => const AppLoading(),
          error: (e, _) => Center(child: Text(e.toString())),
          data: (appUser) {
            if (appUser == null || !appUser.isAdmin) {
              return const Center(child: Text('Acesso restrito.'));
            }

            return StreamBuilder<List<PropertyModel>>(
              stream: ref
                  .read(propertyRepositoryProvider)
                  .watchAdminProperties(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const AppLoading();
                }

                final allItems = snapshot.data ?? <PropertyModel>[];
                final filteredItems = _applyFilters(allItems);

                final pendingCount = allItems
                    .where((e) => e.status == PropertyStatus.pending)
                    .length;
                final approvedCount = allItems
                    .where((e) => e.status == PropertyStatus.approved)
                    .length;
                final rejectedCount = allItems
                    .where((e) => e.status == PropertyStatus.rejected)
                    .length;

                PropertyModel? selected;
                for (final item in filteredItems) {
                  if (item.id == _selectedId) {
                    selected = item;
                    break;
                  }
                }
                selected ??= filteredItems.isNotEmpty
                    ? filteredItems.first
                    : null;

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Moderacao em tempo real',
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Aprovacoes e rejeicoes atualizam automaticamente no app principal.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        _MetricCard(
                          label: 'Pendentes',
                          value: pendingCount,
                          color: AppColors.pending,
                        ),
                        _MetricCard(
                          label: 'Aprovados',
                          value: approvedCount,
                          color: AppColors.approved,
                        ),
                        _MetricCard(
                          label: 'Rejeitados',
                          value: rejectedCount,
                          color: AppColors.rejected,
                        ),
                        _MetricCard(
                          label: 'Total',
                          value: allItems.length,
                          color: AppColors.primary,
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        children: [
                          TextField(
                            controller: _searchCtrl,
                            onChanged: (value) =>
                                setState(() => _search = value),
                            decoration: InputDecoration(
                              hintText:
                                  'Buscar por titulo, endereco, ownerId ou id',
                              prefixIcon: const Icon(Icons.search),
                              suffixIcon: _search.isEmpty
                                  ? null
                                  : IconButton(
                                      onPressed: () {
                                        _searchCtrl.clear();
                                        setState(() => _search = '');
                                      },
                                      icon: const Icon(Icons.close),
                                    ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: SegmentedButton<_AdminStatusFilter>(
                              segments: const [
                                ButtonSegment(
                                  value: _AdminStatusFilter.pending,
                                  label: Text('Pendentes'),
                                ),
                                ButtonSegment(
                                  value: _AdminStatusFilter.approved,
                                  label: Text('Aprovados'),
                                ),
                                ButtonSegment(
                                  value: _AdminStatusFilter.rejected,
                                  label: Text('Rejeitados'),
                                ),
                                ButtonSegment(
                                  value: _AdminStatusFilter.all,
                                  label: Text('Todos'),
                                ),
                              ],
                              selected: <_AdminStatusFilter>{_statusFilter},
                              onSelectionChanged: (selection) {
                                final next = selection.first;
                                setState(() {
                                  _statusFilter = next;
                                });
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    if (filteredItems.isEmpty)
                      const Expanded(
                        child: Center(
                          child: Text(
                            'Sem anuncios para o filtro selecionado.',
                          ),
                        ),
                      )
                    else
                      Expanded(
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            final isWide = constraints.maxWidth >= 1000;
                            if (!isWide) {
                              return ListView.separated(
                                itemCount: filteredItems.length,
                                separatorBuilder: (_, _) =>
                                    const SizedBox(height: 10),
                                itemBuilder: (context, index) {
                                  final item = filteredItems[index];
                                  final busy = _busyIds.contains(item.id);
                                  return _AdminPropertyCard(
                                    property: item,
                                    busy: busy,
                                    onApprove: () => _moderate(
                                      item,
                                      status: PropertyStatus.approved,
                                      verified: false,
                                    ),
                                    onApproveVerified: () => _moderate(
                                      item,
                                      status: PropertyStatus.approved,
                                      verified: true,
                                    ),
                                    onReject: () => _moderate(
                                      item,
                                      status: PropertyStatus.rejected,
                                      verified: false,
                                    ),
                                    onToggleVerified: () => _moderate(
                                      item,
                                      status: item.status,
                                      verified: !item.verified,
                                    ),
                                  );
                                },
                              );
                            }

                            return Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  flex: 6,
                                  child: _AdminPropertyTable(
                                    items: filteredItems,
                                    selectedId: selected?.id,
                                    busyIds: _busyIds,
                                    onSelect: (id) =>
                                        setState(() => _selectedId = id),
                                    onApprove: (item) => _moderate(
                                      item,
                                      status: PropertyStatus.approved,
                                      verified: false,
                                    ),
                                    onApproveVerified: (item) => _moderate(
                                      item,
                                      status: PropertyStatus.approved,
                                      verified: true,
                                    ),
                                    onReject: (item) => _moderate(
                                      item,
                                      status: PropertyStatus.rejected,
                                      verified: false,
                                    ),
                                    onToggleVerified: (item) => _moderate(
                                      item,
                                      status: item.status,
                                      verified: !item.verified,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  flex: 4,
                                  child: selected == null
                                      ? const SizedBox.shrink()
                                      : Builder(
                                          builder: (context) {
                                            final selectedItem = selected!;
                                            return _AdminDetailPanel(
                                              property: selectedItem,
                                              busy: _busyIds.contains(
                                                selectedItem.id,
                                              ),
                                              onApprove: () => _moderate(
                                                selectedItem,
                                                status: PropertyStatus.approved,
                                                verified: false,
                                              ),
                                              onApproveVerified: () =>
                                                  _moderate(
                                                    selectedItem,
                                                    status:
                                                        PropertyStatus.approved,
                                                    verified: true,
                                                  ),
                                              onReject: () => _moderate(
                                                selectedItem,
                                                status: PropertyStatus.rejected,
                                                verified: false,
                                              ),
                                              onToggleVerified: () => _moderate(
                                                selectedItem,
                                                status: selectedItem.status,
                                                verified:
                                                    !selectedItem.verified,
                                              ),
                                            );
                                          },
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
            );
          },
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 170,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 8),
          Text(
            '$value',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _AdminPropertyTable extends StatelessWidget {
  const _AdminPropertyTable({
    required this.items,
    required this.selectedId,
    required this.busyIds,
    required this.onSelect,
    required this.onApprove,
    required this.onApproveVerified,
    required this.onReject,
    required this.onToggleVerified,
  });

  final List<PropertyModel> items;
  final String? selectedId;
  final Set<String> busyIds;
  final ValueChanged<String> onSelect;
  final ValueChanged<PropertyModel> onApprove;
  final ValueChanged<PropertyModel> onApproveVerified;
  final ValueChanged<PropertyModel> onReject;
  final ValueChanged<PropertyModel> onToggleVerified;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columnSpacing: 18,
          columns: const [
            DataColumn(label: Text('Imovel')),
            DataColumn(label: Text('Preco')),
            DataColumn(label: Text('Status')),
            DataColumn(label: Text('Verificado')),
            DataColumn(label: Text('Criado')),
            DataColumn(label: Text('Acoes')),
          ],
          rows: items.map((item) {
            final busy = busyIds.contains(item.id);
            return DataRow(
              selected: selectedId == item.id,
              onSelectChanged: (_) => onSelect(item.id),
              cells: [
                DataCell(
                  SizedBox(
                    width: 260,
                    child: Text(item.title, overflow: TextOverflow.ellipsis),
                  ),
                ),
                DataCell(Text(CurrencyFormatter.brl(item.price))),
                DataCell(StatusBadge(status: item.status)),
                DataCell(
                  Icon(
                    item.verified ? Icons.verified : Icons.verified_outlined,
                    color: AppColors.accent,
                  ),
                ),
                DataCell(Text(dateFormat.format(item.createdAt.toLocal()))),
                DataCell(
                  Row(
                    children: [
                      IconButton(
                        tooltip: 'Aprovar',
                        onPressed: busy ? null : () => onApprove(item),
                        icon: const Icon(Icons.check_circle_outline),
                      ),
                      IconButton(
                        tooltip: 'Aprovar + Verificado',
                        onPressed: busy ? null : () => onApproveVerified(item),
                        icon: const Icon(Icons.verified_outlined),
                      ),
                      IconButton(
                        tooltip: item.verified
                            ? 'Remover verificado'
                            : 'Marcar verificado',
                        onPressed: busy ? null : () => onToggleVerified(item),
                        icon: Icon(
                          item.verified ? Icons.star : Icons.star_border,
                        ),
                      ),
                      IconButton(
                        tooltip: 'Rejeitar',
                        onPressed: busy ? null : () => onReject(item),
                        icon: const Icon(Icons.cancel_outlined),
                      ),
                      if (busy)
                        const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                    ],
                  ),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }
}

class _AdminPropertyCard extends StatelessWidget {
  const _AdminPropertyCard({
    required this.property,
    required this.busy,
    required this.onApprove,
    required this.onApproveVerified,
    required this.onReject,
    required this.onToggleVerified,
  });

  final PropertyModel property;
  final bool busy;
  final VoidCallback onApprove;
  final VoidCallback onApproveVerified;
  final VoidCallback onReject;
  final VoidCallback onToggleVerified;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            property.title,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(CurrencyFormatter.brl(property.price)),
          const SizedBox(height: 6),
          Text(property.location.addressText),
          const SizedBox(height: 8),
          Row(
            children: [
              StatusBadge(status: property.status),
              const SizedBox(width: 8),
              Icon(
                property.verified ? Icons.verified : Icons.verified_outlined,
                color: AppColors.accent,
              ),
              const Spacer(),
              Text(
                dateFormat.format(property.createdAt.toLocal()),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
          const SizedBox(height: 10),
          _ModerationActions(
            busy: busy,
            verified: property.verified,
            onApprove: onApprove,
            onApproveVerified: onApproveVerified,
            onReject: onReject,
            onToggleVerified: onToggleVerified,
          ),
        ],
      ),
    );
  }
}

class _AdminDetailPanel extends StatelessWidget {
  const _AdminDetailPanel({
    required this.property,
    required this.busy,
    required this.onApprove,
    required this.onApproveVerified,
    required this.onReject,
    required this.onToggleVerified,
  });

  final PropertyModel property;
  final bool busy;
  final VoidCallback onApprove;
  final VoidCallback onApproveVerified;
  final VoidCallback onReject;
  final VoidCallback onToggleVerified;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Detalhes',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            if (property.photos.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: AspectRatio(
                  aspectRatio: 4 / 3,
                  child: Image.network(
                    property.photos.first,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            const SizedBox(height: 12),
            Text(
              property.title,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(CurrencyFormatter.brl(property.price)),
            const SizedBox(height: 6),
            Text(property.location.addressText),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                StatusBadge(status: property.status),
                _SoftInfo(label: property.rentType.name),
                _SoftInfo(label: '${property.bedrooms} qts'),
                _SoftInfo(label: '${property.bathrooms} banh'),
                _SoftInfo(
                  label: property.petFriendly ? 'Pet: sim' : 'Pet: nao',
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text('Criado: ${dateFormat.format(property.createdAt.toLocal())}'),
            Text('OwnerId: ${property.ownerId}'),
            const SizedBox(height: 10),
            Text(
              property.description,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 12),
            _ModerationActions(
              busy: busy,
              verified: property.verified,
              onApprove: onApprove,
              onApproveVerified: onApproveVerified,
              onReject: onReject,
              onToggleVerified: onToggleVerified,
            ),
          ],
        ),
      ),
    );
  }
}

class _ModerationActions extends StatelessWidget {
  const _ModerationActions({
    required this.busy,
    required this.verified,
    required this.onApprove,
    required this.onApproveVerified,
    required this.onReject,
    required this.onToggleVerified,
  });

  final bool busy;
  final bool verified;
  final VoidCallback onApprove;
  final VoidCallback onApproveVerified;
  final VoidCallback onReject;
  final VoidCallback onToggleVerified;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        FilledButton.tonalIcon(
          onPressed: busy ? null : onApprove,
          icon: const Icon(Icons.check_circle_outline),
          label: const Text('Aprovar'),
        ),
        FilledButton.tonalIcon(
          onPressed: busy ? null : onApproveVerified,
          icon: const Icon(Icons.verified_outlined),
          label: const Text('Aprovar + Verificado'),
        ),
        OutlinedButton.icon(
          onPressed: busy ? null : onToggleVerified,
          icon: Icon(verified ? Icons.star : Icons.star_border),
          label: Text(verified ? 'Remover verificado' : 'Marcar verificado'),
        ),
        FilledButton.tonalIcon(
          onPressed: busy ? null : onReject,
          icon: const Icon(Icons.cancel_outlined),
          label: const Text('Rejeitar'),
        ),
        if (busy)
          const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
      ],
    );
  }
}

class _SoftInfo extends StatelessWidget {
  const _SoftInfo({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF4F6FA),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
      ),
    );
  }
}
