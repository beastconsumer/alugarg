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

## API de pagamento 100% local (sem Edge Function)
1. No `.env`, configure:
```env
LOCAL_API_PORT=8787
MERCADOPAGO_ACCESS_TOKEN=APP_USR...
```
2. Em um terminal, suba a API local:
```bash
npm run api:dev
```
3. Em outro terminal, suba o front:
```bash
npm run dev
```
4. O Vite faz proxy de `/api/*` para `http://127.0.0.1:8787`.

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
4. Opcional: use essa funcao se quiser envio de email via Supabase. No fluxo local atual, o checkout usa endpoint local `/api/notifications/booking-confirmation`. 
 
### 3) PIX Mercado Pago (API local) 
1. Coloque no `.env`:
```env
LOCAL_API_PORT=8787
MERCADOPAGO_ACCESS_TOKEN=APP_USR...
MERCADOPAGO_WEBHOOK_URL=http://127.0.0.1:8787/api/payments/webhook
```
2. Suba a API local:
```bash
npm run api:dev
```
3. Suba o frontend:
```bash
npm run dev
```
4. No checkout, escolha PIX, gere o QR Code e use `Verificar pagamento`.

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
- Checkout com PIX Mercado Pago em API local (QR Code + verificacao), email local de confirmacao e abertura automatica de chat apos pagamento 

## Observacoes
- O projeto foi migrado para React web e nao depende mais de Flutter para execucao principal.
- Se o bucket nao existir, o app mostra erro explicito de configuracao.
- O script `run_android.ps1` sobe o Vite, faz `adb reverse` e abre `http://localhost:5173` no emulador Android.

## Release do APK no GitHub
- O workflow `.github/workflows/android-release.yml` cria um Release no GitHub quando voce sobe uma tag `v*` (ex.: `v1.0.0`) e anexa o APK.
- Sem secrets de assinatura, o APK sai assinado com chave de debug (instalavel, mas nao serve para Play Store/atualizacoes).
- Para assinar corretamente (recomendado), crie GitHub Secrets:
  - `ANDROID_KEYSTORE_BASE64` (keystore em base64)
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`

### Nightly (APK automatico a cada push)
- O workflow `.github/workflows/android-nightly.yml` gera/atualiza um release `nightly` a cada push na branch `main`.
- Link fixo do APK nightly:
  - `https://github.com/beastconsumer/alugarg/releases/download/nightly/aluga-aluga-nightly.apk`
- Para conseguir atualizar por cima (sem desinstalar), o APK precisa ser assinado sempre com a mesma keystore (configure os secrets acima).
