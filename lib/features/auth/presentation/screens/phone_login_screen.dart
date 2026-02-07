import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:aluga_aluga/core/providers/app_providers.dart';
import 'package:aluga_aluga/core/utils/phone_utils.dart';
import 'package:aluga_aluga/core/widgets/app_page.dart';

class PhoneLoginScreen extends ConsumerStatefulWidget {
  const PhoneLoginScreen({super.key});

  @override
  ConsumerState<PhoneLoginScreen> createState() => _PhoneLoginScreenState();
}

class _PhoneLoginScreenState extends ConsumerState<PhoneLoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();

  bool _loading = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _identifierCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  bool _isEmail(String value) => value.contains('@');

  Future<void> _submit() async {
    if (_loading) return;
    if (!_formKey.currentState!.validate()) return;

    setState(() => _loading = true);

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
          throw Exception('Telefone nao encontrado. Crie a conta primeiro.');
        }

        loginEmail = resolvedEmail;
      }

      await ref
          .read(authRepositoryProvider)
          .signInWithEmailPassword(
            email: loginEmail,
            password: _passwordCtrl.text.trim(),
          )
          .timeout(const Duration(seconds: 20));

      if (!mounted) return;
      context.go('/home');
    } on TimeoutException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tempo de resposta excedido. Tente novamente.'),
        ),
      );
    } on AuthException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ja tenho conta')),
      body: AppPage(
        maxWidth: 520,
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              const Text(
                'Entre com telefone ou email cadastrados e sua senha.',
              ),
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
                    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v)) {
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
                    onPressed: () =>
                        setState(() => _obscurePassword = !_obscurePassword),
                    icon: Icon(
                      _obscurePassword
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                    ),
                  ),
                ),
                validator: (value) {
                  if ((value ?? '').trim().isEmpty) return 'Informe sua senha';
                  return null;
                },
              ),
              const SizedBox(height: 14),
              FilledButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Entrar'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
