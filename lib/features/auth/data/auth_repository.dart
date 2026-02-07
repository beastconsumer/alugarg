import 'package:supabase_flutter/supabase_flutter.dart';

class AuthRepository {
  AuthRepository(this._client);

  final SupabaseClient _client;

  Stream<User?> authStateChanges() {
    return _client.auth.onAuthStateChange.map((event) => event.session?.user);
  }

  User? get currentUser => _client.auth.currentUser;

  bool isAnonymousUser(User user) {
    final provider = user.appMetadata['provider']?.toString().toLowerCase();
    final providers =
        (user.appMetadata['providers'] as List<dynamic>? ?? const [])
            .map((e) => e.toString().toLowerCase())
            .toList();
    return provider == 'anonymous' || providers.contains('anonymous');
  }

  Future<void> signOutAnonymousIfNeeded() async {
    final user = _client.auth.currentUser;
    if (user == null) return;
    if (!isAnonymousUser(user)) return;
    await _client.auth.signOut();
  }

  Future<User> signUpWithEmailPassword({
    required String email,
    required String password,
  }) async {
    await signOutAnonymousIfNeeded();
    final response = await _client.auth.signUp(
      email: email.trim().toLowerCase(),
      password: password,
    );
    final user = response.user;
    if (user == null) {
      throw Exception('Nao foi possivel criar a conta.');
    }

    if (response.session != null) {
      return user;
    }

    final signInResponse = await _client.auth.signInWithPassword(
      email: email.trim().toLowerCase(),
      password: password,
    );
    final signedUser = signInResponse.user;
    if (signedUser == null) {
      throw Exception(
        'Conta criada, mas sem sessao ativa. Verifique confirmacao de email no Supabase Auth.',
      );
    }
    return signedUser;
  }

  Future<User> signInWithEmailPassword({
    required String email,
    required String password,
  }) async {
    await signOutAnonymousIfNeeded();
    final response = await _client.auth.signInWithPassword(
      email: email.trim().toLowerCase(),
      password: password,
    );
    final user = response.user;
    if (user == null) {
      throw Exception('Falha ao entrar com email e senha.');
    }
    return user;
  }

  @Deprecated('Fluxo anonimo desativado para o app final.')
  Future<User> signInAnonymouslyIfNeeded() async {
    throw Exception(
      'Login anonimo desativado. Use cadastro/login com email, telefone e senha.',
    );
  }

  Future<void> signOut() => _client.auth.signOut();
}
