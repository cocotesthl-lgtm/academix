# Curplat

Plataforma SaaS multi-tenant para academias, coaches y creators. Cada owner obtiene su propio subdominio (`<slug>.curplat.com`), conecta SU MercadoPago / Shopify (cobra directo) y SU Google Drive (sin almacenar archivos pesados en la plataforma). El fundador gestiona owners, ajusta comisiones globales o por academia, y opera el soporte.

**Modelo de comisión = deuda.** Por cada venta detectada vía webhook, la plataforma acumula una deuda del owner que se cobra periódicamente vía MP. No hay split payment en tiempo real.

Plan completo: `C:\Users\DANI\.claude\plans\prompt-mi-idea-es-wise-lagoon.md`.

## Stack

- Next.js 16 (App Router) en Vercel
- Supabase (Postgres + Auth + RLS + Storage chico)
- TypeScript + Tailwind v4
- Upstash Redis (cache de subdominio + rate limit)
- MercadoPago + Shopify + Google Drive (OAuth por owner)

## Estructura

```
src/
  middleware.ts                # rutea subdominios → portales
  app/
    (marketing)/               # curplat.com
    (auth)/login,signup,onboarding
    founder/                   # admin.curplat.com (rewrite desde middleware)
    owner/                     # app.curplat.com   (rewrite desde middleware)
    storefront/[tenantId]/     # <slug>.curplat.com (rewrite)
    api/                       # webhooks, oauth, cron, affiliate tracking
  lib/
    supabase/                  # server / browser / service clients
    tenant/                    # resolve + Upstash cache
    auth/guards.ts
    env.ts
  db/migrations/0001_init.sql  # schema + RLS + helpers
```

## Setup local

### 1. Instalar dependencias
```powershell
npm install
```

### 2. Crear proyecto Supabase
1. Ir a https://supabase.com/dashboard → New project.
2. Copiar `URL`, `anon key`, `service_role key` al `.env.local`.
3. En el SQL editor, pegar el contenido de `src/db/migrations/0001_init.sql` y ejecutar.
4. En Storage → crear buckets:
   - `branding` (public)
   - `attachments` (private)

### 3. (Opcional) Upstash Redis
1. https://console.upstash.com → Create database (Redis, global).
2. Copiar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` al `.env.local`.
3. Si lo dejás vacío, en dev usa un Map en memoria.

### 4. Generar secret para cookies de afiliado
```powershell
# Powershell:
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
# o con openssl:
openssl rand -hex 32
```
Pegarlo en `AFFILIATE_COOKIE_SECRET`.

### 5. Copiar env
```powershell
Copy-Item .env.example .env.local
# editar .env.local con valores reales
```

### 6. Configurar Supabase Auth (importante)

En el dashboard de Supabase:

1. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: agregar `http://localhost:3000/api/auth/callback`
   - (En prod después agregás `https://curplat.com` y `https://curplat.com/api/auth/callback`)

2. **Authentication → Providers → Email**:
   - Para dev rápido, **desactivar "Confirm email"** (los signups crean sesión instantánea, sin tener que ir al inbox).
   - En prod lo reactivás.

### 7. Levantar dev server
```powershell
npm run dev
```

### 8. Probar subdominios en local
Acceder a:
- `http://localhost:3000` → marketing
- `http://admin.localhost:3000` → founder (requiere super_admin)
- `http://app.localhost:3000` → owner (requiere membership owner)
- `http://miacademia.localhost:3000` → storefront del tenant con slug `miacademia`

> Si `*.localhost` no resuelve en tu sistema, agregá entradas a `C:\Windows\System32\drivers\etc\hosts` o usá Chrome (lo soporta nativo).

## Deploy a Vercel

### 1. Conectar repo
```powershell
git init
git add .
git commit -m "feat: initial scaffold"
gh repo create curplat --private --source=. --push
# después conectarlo en vercel.com
```

### 2. DNS wildcard
En tu provider de DNS para `curplat.com`:
- `A` (o `CNAME`) `@` → Vercel
- `CNAME` `*` → `cname.vercel-dns.com`
- `CNAME` `www` → `cname.vercel-dns.com`

### 3. Agregar dominios al proyecto Vercel
Project Settings → Domains:
- `curplat.com`
- `www.curplat.com`
- `*.curplat.com`
- `admin.curplat.com`
- `app.curplat.com`

(Vercel emite certs Let's Encrypt automáticos para wildcard.)

### 4. Variables de entorno
Project Settings → Environment Variables → cargar todo lo del `.env.example`.

### 5. Crear el primer super_admin
Después de signup vía `/signup`, en Supabase SQL editor:
```sql
update profiles set is_super_admin = true where email = 'tu@email.com';
```

## Flujo de prueba end-to-end (semana 2)

1. `http://localhost:3000/signup` → crear cuenta con email + password.
2. Si tenés "Confirm email" prendido, abrí el link del inbox → te lleva a `/onboarding`. Si lo desactivaste, vas directo.
3. En `/onboarding` elegís slug (`miacademia`), nombre y color → click "Crear academia".
4. Te redirige a `http://app.localhost:3000/dashboard` — tu panel de owner.
5. `http://miacademia.localhost:3000` → tu storefront público (vacío por ahora).
6. Para entrar al panel del fundador, primero ejecutá el SQL de super_admin (paso 5 de abajo) con tu email, después abrí `http://admin.localhost:3000`.

## Roadmap

Ver plan completo. Semanas:
1. ✅ Scaffold + proxy + clients + schema
2. ✅ Signup → onboarding (slug único, reservados, creación de tenant)
3. Owner dashboard + branding + founder shell
4. Cursos/módulos/lessons + Google Drive OAuth
5. Enrollments + lesson progress + affiliate links
6. MP + Shopify OAuth + webhooks
7. Commission rules + owner debt
8. Affiliate engine end-to-end
9. Debt payment flow + tickets
10. QA + pilot launch
