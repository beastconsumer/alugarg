import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:aluga_aluga/core/providers/app_providers.dart';
import 'package:aluga_aluga/core/utils/phone_utils.dart';
import 'package:aluga_aluga/core/widgets/app_page.dart';

class SignUpScreen extends ConsumerStatefulWidget {
  const SignUpScreen({super.key});

  @override
  ConsumerState<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends ConsumerState<SignUpScreen> {
  final _formKey = GlobalKey<FormState>();

  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController(text: '+55');
  final _cpfCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _birthCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmPasswordCtrl = TextEditingController();

  bool _loading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _cpfCtrl.dispose();
    _emailCtrl.dispose();
    _birthCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmPasswordCtrl.dispose();
    super.dispose();
  }

  String _normalizeCpf(String value) {
    return value.replaceAll(RegExp(r'[^0-9]'), '');
  }

  DateTime? _parseBirthDate(String value) {
    final input = value.trim();
    if (input.isEmpty) return null;
    try {
      final parsed = DateFormat('dd/MM/yyyy').parseStrict(input);
      return parsed;
    } catch (_) {
      return null;
    }
  }

  String _birthDateValidation(String value) {
    final parsed = _parseBirthDate(value);
    if (parsed == null) {
      return 'Use o formato dd/mm/aaaa';
    }
    final now = DateTime.now();
    final adultCutoff = DateTime(now.year - 18, now.month, now.day);
    if (parsed.isAfter(adultCutoff)) {
      return 'Cadastro permitido apenas para maiores de 18 anos';
    }
    if (parsed.year < 1900) {
      return 'Data de nascimento invalida';
    }
    return '';
  }

  String _passwordValidation(String value) {
    final password = value.trim();
    if (password.length < 8) {
      return 'Senha deve ter ao menos 8 caracteres';
    }
    if (!RegExp(r'[A-Z]').hasMatch(password)) {
      return 'Inclua pelo menos uma letra maiuscula';
    }
    if (!RegExp(r'[a-z]').hasMatch(password)) {
      return 'Inclua pelo menos uma letra minuscula';
    }
    if (!RegExp(r'[0-9]').hasMatch(password)) {
      return 'Inclua pelo menos um numero';
    }
    if (!RegExp(r'[^A-Za-z0-9]').hasMatch(password)) {
      return 'Inclua pelo menos um simbolo especial';
    }
    return '';
  }

  Future<void> _submit() async {
    if (_loading) return;
    if (!_formKey.currentState!.validate()) return;
    final birthDate = _parseBirthDate(_birthCtrl.text.trim());
    if (birthDate == null) return;

    final passwordCheck = _passwordValidation(_passwordCtrl.text);
    if (passwordCheck.isNotEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(passwordCheck)));
      return;
    }

    if (_passwordCtrl.text.trim() != _confirmPasswordCtrl.text.trim()) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('As senhas nao conferem.')));
      return;
    }

    setState(() => _loading = true);

    try {
      final authUser = await ref
          .read(authRepositoryProvider)
          .signUpWithEmailPassword(
            email: _emailCtrl.text.trim(),
            password: _passwordCtrl.text.trim(),
          )
          .timeout(const Duration(seconds: 20));

      await ref
          .read(userRepositoryProvider)
          .createOrUpdateAccount(
            uid: authUser.id,
            phone: PhoneUtils.normalizeForStorage(_phoneCtrl.text.trim()),
            name: _nameCtrl.text.trim(),
            cpf: _normalizeCpf(_cpfCtrl.text),
            email: _emailCtrl.text.trim(),
            birthDate: birthDate,
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
      appBar: AppBar(title: const Text('Criar conta')),
      body: AppPage(
        maxWidth: 560,
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              const Text('Preencha seus dados para criar sua conta.'),
              const SizedBox(height: 12),
              TextFormField(
                controller: _nameCtrl,
                decoration: const InputDecoration(labelText: 'Nome completo'),
                validator: (value) {
                  if ((value ?? '').trim().length < 3) {
                    return 'Informe seu nome completo';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Telefone (+55DDDNUMERO)',
                ),
                validator: (value) {
                  final v = value ?? '';
                  if (!PhoneUtils.isValidBrazilianInternational(v)) {
                    return 'Informe no formato +55DDDNUMERO';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _cpfCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'CPF'),
                validator: (value) {
                  final digits = _normalizeCpf(value ?? '');
                  if (digits.length != 11) return 'CPF deve ter 11 digitos';
                  return null;
                },
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email'),
                validator: (value) {
                  final v = (value ?? '').trim();
                  if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v)) {
                    return 'Email invalido';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _birthCtrl,
                keyboardType: TextInputType.datetime,
                inputFormatters: [
                  LengthLimitingTextInputFormatter(10),
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9/]')),
                ],
                decoration: const InputDecoration(
                  labelText: 'Data de nascimento (dd/mm/aaaa)',
                  hintText: 'Ex: 31/12/1999',
                ),
                validator: (value) {
                  final validation = _birthDateValidation(value ?? '');
                  if (validation.isNotEmpty) {
                    return validation;
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
                  helperText:
                      '8+ caracteres, maiuscula, minuscula, numero e simbolo',
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
                  final check = _passwordValidation(value ?? '');
                  if (check.isNotEmpty) return check;
                  return null;
                },
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _confirmPasswordCtrl,
                obscureText: _obscureConfirmPassword,
                decoration: InputDecoration(
                  labelText: 'Confirmar senha',
                  suffixIcon: IconButton(
                    onPressed: () => setState(
                      () => _obscureConfirmPassword = !_obscureConfirmPassword,
                    ),
                    icon: Icon(
                      _obscureConfirmPassword
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                    ),
                  ),
                ),
                validator: (value) {
                  if ((value ?? '').trim().isEmpty) return 'Confirme a senha';
                  if ((value ?? '').trim() != _passwordCtrl.text.trim()) {
                    return 'As senhas nao conferem';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Criar conta'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
