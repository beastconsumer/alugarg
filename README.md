# Aluga Aluga (Flutter + Supabase)

MVP Android/Web do marketplace local de aluguel para Balneario Cassino / Rio Grande - RS.

## Stack
- Flutter (stable)
- Supabase Auth (email/senha)
- Supabase Database (Postgres)
- Supabase Storage (upload de fotos)
- Riverpod
- go_router
- image_picker + flutter_image_compress
- google_maps_flutter
- Material 3

## Funcionalidades MVP
- Tela inicial com `background.png` + acoes `Criar conta` e `Ja tenho conta`
- Cadastro com telefone, nome, CPF, email, data de nascimento e senha forte
- Login com telefone **ou** email + senha
- Home com feed de anuncios aprovados + filtros + paginacao
- Detalhe do imovel com galeria e fluxo de reserva/aluguel
- Reserva com calculo de taxas:
  - inquilino paga +10% sobre o valor base
  - proprietario recebe valor base -4%
- Mapa com busca por endereco/bairro e opcao de usar localizacao atual
- Wizard de anuncio em 3 passos (info, local, fotos), com vagas de garagem
- Perfil com foto do usuario, meus anuncios, minhas reservas e avaliacoes por tags
- Moderacao simples com status `pending/approved/rejected`
- Painel Admin dentro do Perfil para aprovar/rejeitar e marcar verificado

## Estrutura do projeto
```text
lib/
  core/
    constants/
    providers/
    theme/
    utils/
    widgets/
  features/
    auth/
    properties/
    profile/
    admin/
  router/
  app.dart
  main.dart

supabase_schema.sql
.env.example
```

## Requisitos
1. Flutter SDK instalado
2. Conta Supabase
3. VSCode com extensoes Flutter/Dart
4. (Windows) Developer Mode ativo para plugins com symlink

No Windows, se necessario:
```powershell
start ms-settings:developers
```

## Como rodar
### 1) Instalar dependencias
```bash
flutter pub get
```

### 2) Configurar Supabase
1. Crie um projeto no Supabase.
2. Rode o SQL em `supabase_schema.sql` no SQL Editor.
3. Ative **Email provider** em Auth > Sign In / Providers.
4. Recomendado: em Auth > Providers > Email, desative confirmacao obrigatoria de email para testes locais.
5. Crie um bucket publico chamado `property-images` (ou use outro e ajuste `SUPABASE_BUCKET`).
6. Pegue `SUPABASE_URL` e `SUPABASE_ANON_KEY` em Project Settings > API.

### 3) Colocar chaves no Android
No arquivo `android/local.properties`, adicione:
```properties
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_BUCKET=property-images
MAPS_API_KEY=YOUR_MAPS_API_KEY
```

### 4) Executar app mobile (Android/emulador)
```powershell
.\run_android.ps1 -SupabaseUrl https://SEU_PROJETO.supabase.co -SupabaseAnonKey SUA_ANON_KEY
```

### 5) Executar site admin web (separado do app)
```powershell
.\run_admin_web.ps1 -SupabaseUrl https://SEU_PROJETO.supabase.co -SupabaseAnonKey SUA_ANON_KEY
```

### 6) Executar app web principal (opcional)
```powershell
.\run_web.ps1 -SupabaseUrl https://SEU_PROJETO.supabase.co -SupabaseAnonKey SUA_ANON_KEY
```

## Tabelas (Supabase)
### `users`
- `id` (uuid, PK)
- `name` (text)
- `phone` (text)
- `avatar_url` (text)
- `cpf` (text)
- `email` (text)
- `birth_date` (date)
- `role` (text)
- `created_at` (timestamptz)

### `properties`
- `id` (uuid, PK)
- `owner_id` (uuid)
- `title` (text)
- `description` (text)
- `price` (int)
- `rent_type` (text)
- `bedrooms` (int)
- `bathrooms` (int)
- `garage_spots` (int)
- `pet_friendly` (bool)
- `verified` (bool)
- `status` (text)
- `photos` (text[])
- `location` (jsonb)
- `created_at`, `updated_at` (timestamptz)
- `views_count` (int)

### `bookings`
- `id` (uuid, PK)
- `property_id` (uuid)
- `property_title` (text)
- `renter_id` (uuid)
- `owner_id` (uuid)
- `check_in_date`, `check_out_date` (timestamptz)
- `units` (int)
- `base_amount` (int)
- `client_fee_amount` (int)
- `owner_fee_amount` (int)
- `total_paid_by_renter` (int)
- `owner_payout_amount` (int)
- `status` (text)
- `created_at`, `updated_at` (timestamptz)

### `owner_reviews`
- `id` (uuid, PK)
- `booking_id` (uuid, unique)
- `property_id` (uuid)
- `renter_id` (uuid)
- `owner_id` (uuid)
- `rating` (int 1..5)
- `tags` (text[])
- `comment` (text)
- `created_at` (timestamptz)

## Admin
Para promover um usuario a admin, ajuste manualmente no Supabase:
- tabela `users`
- campo `role = 'admin'`

Exemplo por telefone:
```sql
update public.users
set role = 'admin'
where phone = '+5553999005952';
```

## Observacao sobre login por telefone
- O fluxo atual usa `signInWithPassword` do Supabase Auth.
- Quando o usuario informa telefone no login, o app resolve o email pela RPC `get_login_email_by_phone` e autentica com email+senha.
- Sempre que alterar o schema local, rode novamente todo o SQL de `supabase_schema.sql` no SQL Editor.
- Se executar com `SUPABASE_URL=...` (reticencias), o app agora mostra erro de configuracao em tela.
- Os scripts `run_android.ps1`, `run_web.ps1` e `run_admin_web.ps1` leem `android/local.properties` automaticamente.

## TODO (proximas melhorias)
1. Integracao real de pagamento/escrow (Stripe/Mercado Pago/Pagar.me)
2. Regras SQL para bloqueio automatico de overbooking por range
3. Motor de precificacao dinamica por temporada
4. Favoritos, notificacoes e analytics de conversao
