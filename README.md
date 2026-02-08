# Aluga Aluga (React + Supabase)

Aplicacao web React para marketplace de aluguel local no Cassino.

## Stack
- React 18 + TypeScript + Vite
- Supabase: Auth, Postgres, Storage, Realtime
- Upload de imagens com compressao (`browser-image-compression`)

## Rodar local
1. Instale Node.js 20+
2. No terminal da pasta do projeto:
```bash
npm install
```
3. Crie `.env` com base em `.env.example`:
```env
VITE_SUPABASE_URL=https://SEU_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=SEU_ANON_KEY
VITE_SUPABASE_BUCKET=property-images
```
4. Rode o app:
```bash
npm run dev
```
5. Acesse:
- App: `http://localhost:5173/`
- Admin web: `http://localhost:5173/admin.html`

## Scripts PowerShell (abre CMD)
- App: `./run_web.ps1`
- Admin: `./run_admin_web.ps1`
- Android Emulator (React web no emulador): `./run_android.ps1`

Obs: os scripts leem automaticamente `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_BUCKET`).
Se quiser, voce ainda pode sobrescrever por parametro.

## Supabase obrigatorio
1. Rode o SQL de `supabase_schema.sql` no SQL Editor.
2. Crie bucket `property-images` em Storage.
3. Garanta que o usuario admin tenha `role = 'admin'` na tabela `public.users`.

Exemplo para promover admin:
```sql
update public.users
set role = 'admin'
where phone = '+5553999005952';
```

## Email com cara do app (confirmacao)
### 1) Email de confirmacao de conta (Auth)
1. No Supabase Dashboard: `Authentication > Email Templates > Confirm signup`.
2. Copie o HTML de `supabase/templates/auth_confirmation_email.html`.
3. Cole no template e salve.

### 2) Email de confirmacao de reserva (checkout)
1. Configure um provedor de envio (ex.: Resend) e crie API key.
2. Defina secrets da Edge Function:
```bash
supabase secrets set RESEND_API_KEY=SEU_TOKEN
supabase secrets set RESEND_FROM_EMAIL="Aluga Aluga <noreply@seu-dominio.com>"
```
3. Deploy da funcao:
```bash
supabase functions deploy send-booking-confirmation
```
4. Pronto: apos pagamento confirmado no checkout, o app dispara email de confirmacao com layout Aluga Aluga.

## Fluxos implementados
- Entrada com background + botoes `Criar conta` e `Ja tenho conta`
- Cadastro: nome, telefone, CPF, email, data de nascimento digitada, senha forte
- Login por email/senha ou telefone/senha (resolve email via RPC)
- Feed com filtros (mensal/temporada/diaria, pet, preco, quartos)
- Detalhe com WhatsApp, reserva e calculo de taxas (10% cliente, 4% dono)
- Anunciar em 3 passos com minimo 3 fotos e upload para Supabase Storage
- Edicao de anuncio com gerenciamento de fotos (adicionar/remover/capa)
- Perfil com upload de avatar, meus anuncios, reservas e avaliacoes por tags
- Painel admin separado para aprovar/rejeitar/verificar anuncios com atualizacao em tempo real
- Checkout com email de confirmacao + abertura automatica de chat com anfitriao apos pagamento

## Observacoes
- O projeto foi migrado para React web e nao depende mais de Flutter para execucao principal.
- Se o bucket nao existir, o app mostra erro explicito de configuracao.
- O script `run_android.ps1` sobe o Vite, faz `adb reverse` e abre `http://localhost:5173` no emulador Android.
