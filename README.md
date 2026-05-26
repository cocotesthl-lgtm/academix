# Curplat

**Plataforma SaaS multi-tenant para academias, coaches y creators.** Cada owner obtiene su propio subdominio (`<slug>.curplat.com`), conecta SU MercadoPago (cobra directo) y SU Google Drive (sin almacenar archivos pesados en la plataforma). El fundador gestiona owners, ajusta comisiones globales o por academia, y opera el soporte.

**Modelo de comisión = deuda.** Por cada venta detectada vía webhook, la plataforma acumula una deuda del owner que se cobra periódicamente vía MP. No hay split payment en tiempo real.

Plan completo: `C:\Users\DANI\.claude\plans\prompt-mi-idea-es-wise-lagoon.md`.

## Estado del MVP

| Semana | Feature | Estado |
|---|---|---|
| 1 | Scaffold + proxy subdominio + clients + schema RLS | ✅ |
| 2 | Signup + login + onboarding + creación de tenant | ✅ |
| 3 | Branding del owner + founder dashboard + tenants admin | ✅ |
| 4 | Cursos / módulos / lessons + storefront catálogo | ✅ |
| 5 | Enrollments + lesson player + affiliate links | ✅ |
| 6 | MercadoPago OAuth + checkout + webhook | ✅ |
| 7 | Comisiones (global + override) + debt ledger | ✅ |
| 8 | Engine afiliados end-to-end + comisiones L1/L2/L3 | ✅ |
| 9 | Pago de deuda + cron de enforcement + tickets | ✅ |
| 10 | Dashboards + Vercel cron + seed + docs | ✅ |

## Stack

- **Next.js 16** (App Router, Server Actions + Route Handlers) en **Vercel**
- **Supabase** (Postgres + Auth + RLS + Storage chico)
- **TypeScript** + **Tailwind v4**
- **Upstash Redis** (cache de subdominio + rate limit — opcional en dev)
- **MercadoPago** (OAuth por owner para cobros + cuenta plataforma para deuda)

## Estructura

```
src/
  proxy.ts                     # rutea subdominios → portales (Next 16)
  app/
    (marketing)/               # curplat.com
    (auth)/login,signup,onboarding
    founder/                   # admin.curplat.com (rewrite desde proxy)
    owner/                     # app.curplat.com   (rewrite desde proxy)
    storefront/[tenantId]/     # <slug>.curplat.com (rewrite)
    api/
      auth/callback            # confirm email + session
      oauth/mercadopago/{start,callback}
      checkout/[courseId]      # crea MP preference con cookie afiliado
      webhooks/
        mercadopago/[tenantId] # ventas + commission + affiliate L1/L2/L3
        platform-mp            # pago de deuda del owner → settle FIFO
      cron/debt-enforcement    # diario, suspende morosos
  lib/
    supabase/{server,browser,service}
    tenant/{resolve,cache}
    auth/{guards,actions}
    courses/actions
    enrollments/actions
    affiliates/{cookie,tracking,commission,actions}
    payments/{mercadopago,signatures}
    debt/{accrue,payment}
    commissions/actions
    tickets/actions
    branding/actions
    integrations/actions
    founder/actions
    drive/embed
    env.ts
  db/
    migrations/0001_init.sql   # schema + RLS + helpers
    migrations/0002_storage_policies.sql
    seed.sql                   # opcional — 2 academias demo
vercel.json                    # cron diario de enforcement
```

## Setup local

### 1. Instalar dependencias
```powershell
npm install
```

### 2. Crear proyecto Supabase
1. Ir a https://supabase.com/dashboard → **New project**.
2. **Project Settings → API**: copiar `URL`, `anon key`, `service_role key` al `.env.local`.
3. **SQL Editor**: pegar el contenido de `src/db/migrations/0001_init.sql` y correr. Luego `0002_storage_policies.sql`. Opcionalmente `seed.sql` (después de tener al menos un user signed up).
4. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: agregar `http://localhost:3000/api/auth/callback`
5. **Authentication → Providers → Email**: para dev rápido, desactivar "Confirm email".

### 3. (Opcional) Upstash Redis
1. https://console.upstash.com → Create database (Redis, global).
2. Copiar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` al `.env.local`.
3. Si lo dejás vacío, en dev usa un Map en memoria.

### 4. Generar secret para cookies de afiliado
```powershell
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```
Pegarlo en `AFFILIATE_COOKIE_SECRET`.

### 5. Copiar env
```powershell
Copy-Item .env.example .env.local
# editar .env.local con valores reales
```

### 6. Levantar dev server
```powershell
npm run dev
```

### 7. Probar subdominios en local
- `http://localhost:3000` → marketing
- `http://admin.localhost:3000` → founder (requiere super_admin)
- `http://app.localhost:3000` → owner (requiere membership owner)
- `http://miacademia.localhost:3000` → storefront del tenant con slug `miacademia`

> Chrome resuelve `*.localhost` nativo. En otros browsers agregá entradas a `C:\Windows\System32\drivers\etc\hosts`.

### 8. Hacerse super_admin

```sql
update profiles set is_super_admin = true where email = 'tu@email.com';
```

## Integrar MercadoPago

### App de la plataforma (necesaria para que owners puedan conectar)
1. Crear app en https://www.mercadopago.com.ar/developers/panel/app.
2. Copiar `CLIENT_ID` y `CLIENT_SECRET` a `.env.local`.
3. En la app de MP agregar redirect URI: `http://localhost:3000/api/oauth/mercadopago/callback` (y la versión prod).

### Cuenta de la plataforma (para recibir pagos de deuda de owners)
- `PLATFORM_MERCADOPAGO_ACCESS_TOKEN`: access token de la cuenta MP que recibe los pagos.
- `PLATFORM_MP_WEBHOOK_SECRET`: secret configurado en Webhooks de esa cuenta.

### Para owners (flujo OAuth)
1. Owner entra a `app.localhost:3000/integrations` → click "Conectar".
2. Completa OAuth en MP.
3. Copia la URL de webhook mostrada y la pega en MP → Webhooks.

### Dev: testear webhooks
- `MP_SKIP_SIG_CHECK=1` para bypassear verificación de firma localmente.
- `ngrok http 3000` para exponer el puerto y recibir webhooks reales.

## Cron de enforcement de deuda

Configurado en `vercel.json` para correr a las 6 AM UTC todos los días. Requiere `CRON_SECRET` en env (Vercel inyecta `Authorization: Bearer ${CRON_SECRET}` automáticamente cuando el secret está seteado).

## Smoke test end-to-end (cierre semana 10)

Probar este flujo entero confirma que el MVP está vivo:

1. **Signup owner** → `localhost:3000/signup` con email + password.
2. **Onboarding** → elegir slug `demo`, nombre, color → click "Crear academia".
3. **Llegada al owner dashboard** → `app.localhost:3000/dashboard` con banner de "Conectá MercadoPago".
4. **Branding** → `app.localhost:3000/branding` subir logo, cambiar colores, ver preview.
5. **Conectar MercadoPago** → `app.localhost:3000/integrations` → OAuth completo → token guardado.
6. **Crear curso** → `app.localhost:3000/courses/new` → editar → agregar módulo → agregar lección con link de Drive → marcar lección como preview → publicar curso.
7. **Storefront público** → `demo.localhost:3000` muestra el curso → `demo.localhost:3000/c/<slug>` reproduce preview en iframe Drive.
8. **Comprar** → click "Comprar curso" → MP Checkout → completar con tarjeta de test → vuelve a `/learn`.
9. **Verificar webhook**: en Supabase, `sales` tiene row nueva; `owner_debt_ledger` tiene `commission_accrued` con `balance_after_cents`; `enrollments` tiene row para el buyer.
10. **Mi cuenta** → student ve curso en `/learn`, abre lección, marca completada, progreso al 33%.
11. **Generar link de afiliado** desde otra cuenta → `demo.localhost:3000/affiliate` → copiar link.
12. **Comprar vía afiliado** en incógnito con `?ref=` → completar → verificar 3 filas en `affiliate_commissions` (L1/L2/L3 si árbol completo).
13. **Founder cambia comisión** → `admin.localhost:3000/commissions` global del 5% al 7% con reason → nueva venta acumula 7%, ledger pasado intacto.
14. **Founder bandeja de tickets** → owner abre ticket en `/tickets/new`, founder responde en `admin.localhost:3000/tickets/[id]`.
15. **Pagar deuda** → owner en `/finance` clickea "Pagar saldo" → MP → vuelve con paid=1 → ledger negativo, balance 0.
16. **Cron enforcement** → forzar suspensión: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/debt-enforcement` (con un tenant con balance alto y accrual viejo). Storefront muestra "Temporalmente cerrado".
17. **RLS audit**: con anon key, intentar SELECT cross-tenant en `sales`, `owner_debt_ledger`, `integrations` → todo bloqueado.

## Deploy a Vercel

### 1. Push a GitHub
```powershell
gh repo create curplat --private --source=. --push
```

### 2. DNS wildcard
En el provider de DNS para `curplat.com`:
- `A` / `CNAME` `@` → Vercel
- `CNAME` `*` → `cname.vercel-dns.com`
- `CNAME` `www` → `cname.vercel-dns.com`

### 3. Dominios en Vercel
Project Settings → Domains:
- `curplat.com`
- `www.curplat.com`
- `*.curplat.com`
- `admin.curplat.com`
- `app.curplat.com`

Vercel emite certs Let's Encrypt automáticos para wildcard.

### 4. Variables de entorno
Project Settings → Environment Variables → cargar todo lo del `.env.example`. Para prod:
- `NEXT_PUBLIC_APP_URL=https://curplat.com`
- `MERCADOPAGO_REDIRECT_URI=https://app.curplat.com/api/oauth/mercadopago/callback`

### 5. Supabase Auth prod
- Site URL: `https://curplat.com`
- Redirect URLs: `https://curplat.com/api/auth/callback`
- Reactivar "Confirm email" en producción.

### 6. Cron
`vercel.json` ya tiene configurado el cron. Si `CRON_SECRET` está en env, Vercel lo inyecta como Bearer automáticamente.

## Roadmap post-MVP

- **Mes 4-5**: Marketplace público de academias (`curplat.com/discover`), reviews, rankings, ranking de afiliados.
- **Mes 6**: Wallet interna (saldo de afiliados + cashback), payouts batch a MP/CBU.
- **Mes 7-8**: Comunidad (feed, grupos, DMs, masterminds), gamificación (badges, streaks, leaderboards).
- **Mes 9**: Clases en vivo agendadas (Zoom/Meet/Teams — solo coordinación, no hosting).
- **Mes 10-12**: IA (landing pages, emails, asistente de venta), CRM, automatizaciones (email + WhatsApp).
- **Año 2**: Fintech (adelantos, líneas de crédito, tarjetas virtuales), eventos presenciales con QR, B2B2C, app mobile, marketplace de plugins, white label extremo con dominio del owner.
