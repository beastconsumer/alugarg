import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:aluga_aluga/core/constants/app_colors.dart';
import 'package:aluga_aluga/core/providers/app_providers.dart';
import 'package:aluga_aluga/core/utils/phone_utils.dart';
import 'package:aluga_aluga/core/widgets/app_page.dart';

class AdminWebLoginScreen extends ConsumerStatefulWidget {
  const AdminWebLoginScreen({super.key});

  @override
  ConsumerState<AdminWebLoginScreen> createState() =>
      _AdminWebLoginScreenState();
}

class _AdminWebLoginScreenState extends ConsumerState<AdminWebLoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _loading = false;
  bool _obscurePassword = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    Future.microtask(_tryAutoLogin);
  }

  @override
  void dispose() {
    _identifierCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  bool _isEmail(String value) => value.contains('@');

  Future<void> _tryAutoLogin() async {
    final authUser = ref.read(authRepositoryProvider).currentUser;
    if (authUser == null) return;

    final appUser = await ref
        .read(userRepositoryProvider)
        .getUserById(authUser.id);
    if (!mounted) return;

    if (appUser != null && appUser.isAdmin) {
      context.go('/admin-dashboard');
    }
  }

  Future<void> _login() async {
    if (_loading) return;
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final identifier = _identifierCtrl.text.trim();
      String loginEmail;

      if (_isEmail(identifier)) {
        loginEmail = identifier.toLowerCase();
      } else {
        final resolvedEmail = await ref
            .read(userRepositoryProvider)
            .resolveLoginEmailByPhone(identifier)
            .timeout(const Duration(seconds: 20));
        if (resolvedEmail == null || resolvedEmail.isEmpty) {
          throw Exception('Telefone nao encontrado.');
        }
        loginEmail = resolvedEmail;
      }

      final authUser = await ref
          .read(authRepositoryProvider)
          .signInWithEmailPassword(
            email: loginEmail,
            password: _passwordCtrl.text.trim(),
          )
          .timeout(const Duration(seconds: 20));

      final appUser = await ref
          .read(userRepositoryProvider)
          .getUserById(authUser.id)
          .timeout(const Duration(seconds: 20));

      if (!mounted) return;

      if (appUser != null && appUser.isAdmin) {
        context.go('/admin-dashboard');
        return;
      }

      setState(() {
        _error =
            'Este usuario nao tem permissao de admin. Promova seu role no Supabase.';
      });
    } on TimeoutException {
      if (!mounted) return;
      setState(() {
        _error = 'Tempo de resposta excedido. Tente novamente.';
      });
    } on AuthException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _logout() async {
    await ref.read(authRepositoryProvider).signOut();
    if (!mounted) return;
    setState(() {
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AppPage(
        maxWidth: 520,
        padding: const EdgeInsets.all(20),
        child: ListView(
          children: [
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                gradient: const LinearGradient(
                  colors: [AppColors.primary, Color(0xFF2B78FF)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.22),
                    blurRadius: 24,
                    offset: const Offset(0, 14),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Aluga Aluga Admin',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Site independente para moderacao e aprovacao de anuncios.',
                    style: Theme.of(
                      context,
                    ).textTheme.bodyMedium?.copyWith(color: Colors.white70),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Entre com telefone/email e senha de admin.'),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _identifierCtrl,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Telefone (+55DDDNUMERO) ou email',
                      ),
                      validator: (value) {
                        final v = (value ?? '').trim();
                        if (v.isEmpty) return 'Informe telefone ou email';
                        if (_isEmail(v)) {
                          if (!RegExp(
                            r'^[^@\s]+@[^@\s]+\.[^@\s]+$',
                          ).hasMatch(v)) {
                            return 'Email invalido';
                          }
                          return null;
                        }
                        if (!PhoneUtils.isValidBrazilianInternational(v)) {
                          return 'Telefone invalido. Use +55DDDNUMERO';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _passwordCtrl,
                      obscureText: _obscurePassword,
                      decoration: InputDecoration(
                        labelText: 'Senha',
                        suffixIcon: IconButton(
                          onPressed: () => setState(
                            () => _obscurePassword = !_obscurePassword,
                          ),
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                          ),
                        ),
                      ),
                      validator: (value) {
                        if ((value ?? '').trim().isEmpty) {
                          return 'Informe a senha';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),
                    if (_error != null)
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF1F2),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFFDA4AF)),
                        ),
                        child: Text(
                          _error!,
                          style: const TextStyle(color: Color(0xFF9F1239)),
                        ),
                      ),
                    if (_error != null) const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: _loading ? null : _login,
                      icon: const Icon(Icons.admin_panel_settings_outlined),
                      label: _loading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Entrar no painel'),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: _loading ? null : _logout,
                      icon: const Icon(Icons.logout),
                      label: const Text('Limpar sessao atual'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
