class AppUser {
  const AppUser({
    required this.uid,
    required this.name,
    required this.phone,
    required this.avatarUrl,
    required this.cpf,
    required this.email,
    required this.birthDate,
    required this.role,
    required this.createdAt,
  });

  final String uid;
  final String name;
  final String phone;
  final String avatarUrl;
  final String cpf;
  final String email;
  final DateTime? birthDate;
  final String role;
  final DateTime createdAt;

  bool get isAdmin => role == 'admin';

  factory AppUser.fromMap(Map<String, dynamic> map) {
    final createdRaw = map['created_at'];
    final birthRaw = map['birth_date'];

    DateTime created;
    DateTime? birthDate;

    if (createdRaw is String) {
      created = DateTime.tryParse(createdRaw) ?? DateTime.now();
    } else if (createdRaw is DateTime) {
      created = createdRaw;
    } else {
      created = DateTime.now();
    }

    if (birthRaw is String && birthRaw.trim().isNotEmpty) {
      birthDate = DateTime.tryParse(birthRaw);
    } else if (birthRaw is DateTime) {
      birthDate = birthRaw;
    }

    return AppUser(
      uid: map['id'] as String? ?? '',
      name: (map['name'] as String? ?? '').trim(),
      phone: (map['phone'] as String? ?? '').trim(),
      avatarUrl: (map['avatar_url'] as String? ?? '').trim(),
      cpf: (map['cpf'] as String? ?? '').trim(),
      email: (map['email'] as String? ?? '').trim(),
      birthDate: birthDate,
      role: (map['role'] as String? ?? 'user').trim(),
      createdAt: created,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': uid,
      'name': name,
      'phone': phone,
      'avatar_url': avatarUrl,
      'cpf': cpf,
      'email': email,
      'birth_date': birthDate?.toIso8601String(),
      'role': role,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
