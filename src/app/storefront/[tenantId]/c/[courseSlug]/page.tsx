import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTenantById } from "@/lib/tenant/resolve";
import { getServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { trackClick } from "@/lib/affiliates/tracking";
import { CouponInput } from "@/components/storefront/CouponInput";
import type { LandingConfig, LandingTemplate } from "@/lib/courses/landing";
import { HotmartLanding } from "@/components/storefront/landings/HotmartLanding";
import { FunnelLanding } from "@/components/storefront/landings/FunnelLanding";
import { VslLanding } from "@/components/storefront/landings/VslLanding";
import { resolveCheckoutConfig } from "@/lib/checkout/types";
import { generateSlots, type AvailabilityRule, type BookingSlot, type CalendarMode, type CalendarDate, type AvailabilityOverride, type EventDate } from "@/lib/calendar/types";
import { TicketPicker } from "@/components/storefront/TicketPicker";
import { VipPackLanding, type VipMediaItem } from "@/components/storefront/VipPackLanding";
import { ReservationWidget } from "@/components/storefront/ReservationWidget";

export const dynamic = "force-dynamic";

type CourseDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  price_cents: number;
  currency: string;
  status: string;
  landing_template: LandingTemplate | null;
  landing_config: LandingConfig | null;
  landing_variants: Record<string, { template: LandingTemplate; config: LandingConfig }> | null;
};

type ModuleWithLessons = {
  id: string;
  title: string;
  position: number;
  lessons: Array<{
    id: string;
    title: string;
    drive_embed_url: string | null;
    is_preview: boolean;
    position: number;
  }>;
};

export default async function CourseDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ tenantId: string; courseSlug: string }>;
  searchParams: Promise<{ ref?: string; v?: string; debug?: string }>;
}) {
  const { tenantId, courseSlug } = await params;
  const { ref, v: variantParam, debug } = await searchParams;
  const isDebug = debug === '1';
  const tenant = await getTenantById(tenantId);
  const primary = tenant?.brand?.primary_color ?? '#0a0a0a';

  const svc = getServiceClient();
  // Query base — SIN columnas nuevas (sobrevive a falta de migrations).
  const { data: course } = await svc
    .from("courses")
    .select("id, slug, title, description, cover_url, price_cents, currency, status, landing_template, landing_config, landing_variants")
    .eq("tenant_id", tenantId)
    .eq("slug", courseSlug)
    .maybeSingle<CourseDetail>();

  if (!course) {
    // Fallback: ¿es un bundle? Si sí, redirigir a /b/<slug>.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: bundle } = await (svc.from('bundles') as any)
        .select('slug, status').eq('tenant_id', tenantId).eq('slug', courseSlug).maybeSingle();
      if (bundle && bundle.status === 'published') redirect(`/b/${courseSlug}`);
    } catch { /* tabla bundles puede no existir todavía */ }
    notFound();
  }
  if (course.status !== 'published') {
    // Producto existe pero está en borrador → mensaje claro para el owner
    return (
      <article className="max-w-2xl mx-auto px-6 py-20 text-center space-y-4">
        <div className="text-5xl">📝</div>
        <h1 className="text-2xl font-bold">Este producto todavía no está publicado</h1>
        <p className="text-black/60">
          &quot;{course.title}&quot; existe pero está en estado <strong>borrador</strong>. Sólo
          vos podés verlo. Cuando lo publiques, va a aparecer acá para tus visitantes.
        </p>
        <div className="pt-4">
          <a href="/courses" className="inline-block rounded-md text-white font-semibold px-6 py-3" style={{ background: primary }}>
            Ir al panel a publicarlo →
          </a>
        </div>
        <p className="text-xs text-black/40 pt-2">
          (Andá a /courses → tu producto → cambiá el estado de &quot;Borrador&quot; a &quot;Publicado&quot;)
        </p>
      </article>
    );
  }

  // Query separada para columnas nuevas (checkout + calendar). Si la
  // migration todavía no corrió, falla silencioso y caemos a defaults.
  type CourseExtras = {
    checkout_config: unknown;
    calendar_mode: CalendarMode | null;
    calendar_label: string | null;
    calendar_required: boolean | null;
    calendar_horizon_days: number | null;
    content_title?: string | null;
    module_label?: string | null;
    lesson_label?: string | null;
    show_content_section?: boolean | null;
  };
  let courseExtras: CourseExtras | null = null;
  try {
    const { data, error } = await svc
      .from("courses")
      .select("checkout_config, calendar_mode, calendar_label, calendar_required, calendar_horizon_days, content_title, module_label, lesson_label, show_content_section")
      .eq("id", course.id)
      .maybeSingle<CourseExtras>();
    if (!error && data) courseExtras = data;
  } catch { /* migration no corrida — defaults */ }
  const contentTitle = courseExtras?.content_title?.trim() || 'Contenido del publicación';
  const moduleLabel = courseExtras?.module_label?.trim() || 'módulos';
  const lessonLabel = courseExtras?.lesson_label?.trim() || 'lecciones';
  const showContentSection = courseExtras?.show_content_section !== false;

  // ─── Sedes vinculadas + product_type + payment_mode para deducir si
  // renderizamos el ReservationWidget. Cada query AISLADA en su propio
  // try-catch así si una migration no corrió, no rompe el resto.
  let productType: string | null = null;
  let linkedVenues: Array<{ id: string; name: string; address: string | null }> = [];
  let resPaymentMode: 'none' | 'deposit' | 'full' | 'choice' = 'none';
  let resDepositPercent = 30;
  try {
    const { data } = await svc.from('courses').select('product_type').eq('id', course.id)
      .maybeSingle<{ product_type: string | null }>();
    productType = data?.product_type ?? null;
  } catch { /* migration 0031/0036 pendiente */ }
  try {
    const { data } = await svc.from('courses').select('payment_mode, deposit_percent').eq('id', course.id)
      .maybeSingle<{ payment_mode: string | null; deposit_percent: number | null }>();
    resPaymentMode = (data?.payment_mode as typeof resPaymentMode) ?? 'none';
    resDepositPercent = data?.deposit_percent ?? 30;
  } catch { /* migration 0039 pendiente */ }
  try {
    // 2 queries simples (más robusto que el JOIN inline si el FK
    // no está detectado por Supabase): primero las venue_ids, después las sedes.
    const { data: cvRaw } = await svc.from('course_venues')
      .select('venue_id').eq('course_id', course.id);
    const venueIds = ((cvRaw ?? []) as Array<{ venue_id: string }>).map((r) => r.venue_id);
    if (venueIds.length > 0) {
      const { data: vsRaw } = await svc.from('venues')
        .select('id, name, address, active').in('id', venueIds).eq('active', true);
      linkedVenues = ((vsRaw ?? []) as Array<{ id: string; name: string; address: string | null; active: boolean }>)
        .map((v) => ({ id: v.id, name: v.name, address: v.address }));
    }
  } catch { /* migration 0037 pendiente */ }
  const isReservationProduct = productType === 'multi_venue' || productType === 'restaurant';
  const useReservationWidget = isReservationProduct || linkedVenues.length > 0;

  let tenantCheckoutCfg: unknown = null;
  try {
    const { data, error } = await svc
      .from('tenants').select('checkout_config').eq('id', tenantId)
      .maybeSingle<{ checkout_config: unknown }>();
    if (!error && data) tenantCheckoutCfg = data.checkout_config;
  } catch { /* idem */ }

  const checkoutConfig = resolveCheckoutConfig({
    tenantConfig: tenantCheckoutCfg,
    courseConfig: courseExtras?.checkout_config ?? null
  });

  // ─── Calendario: si el publicación tiene mentorship_slot, calculamos los slots
  // disponibles desde las reglas del tenant menos los ya tomados ───
  const calendarMode = (courseExtras?.calendar_mode ?? 'none') as CalendarMode;
  let calendarSlots: BookingSlot[] = [];

  // ─── Tickets de evento ─── (mode='event_tickets')
  let eventDates: EventDate[] = [];
  const takenSeatsByDate: Record<string, { taken: Set<string>; soldCount: number }> = {};
  if (calendarMode === 'event_tickets') {
    try {
      const { data: edRaw } = await svc.from('calendar_dates')
        .select('id, course_id, date, start_min, end_min, timezone, capacity, seat_mode, seat_rows, seat_cols, seat_zones, notes')
        .eq('tenant_id', tenantId)
        .eq('course_id', course.id)
        .gte('date', new Date().toISOString().slice(0, 10))
        .order('date', { ascending: true })
        .limit(20);
      eventDates = (edRaw ?? []) as EventDate[];

      // Tickets ya vendidos por fecha (para mostrar asientos ocupados + soldCount)
      if (eventDates.length > 0) {
        // Cleanup lazy: liberar asientos de pendings abandonados (>15 min)
        // antes de calcular ocupación. Si un comprador no terminó en MP, su
        // ticket pending pasa a cancelled y el asiento queda libre.
        const { cleanupStalePendingTicketsForDate } = await import('@/lib/calendar/seat-cleanup');
        await Promise.all(eventDates.map((ev) => cleanupStalePendingTicketsForDate(svc, ev.id)));

        const { data: tRaw } = await svc.from('event_tickets')
          .select('calendar_date_id, seat_label')
          .in('calendar_date_id', eventDates.map((e) => e.id))
          .not('status', 'in', '("cancelled","refunded")');
        const tickets = (tRaw ?? []) as Array<{ calendar_date_id: string; seat_label: string | null }>;
        for (const ev of eventDates) {
          const evTickets = tickets.filter((t) => t.calendar_date_id === ev.id);
          takenSeatsByDate[ev.id] = {
            taken: new Set(evTickets.map((t) => t.seat_label).filter(Boolean) as string[]),
            soldCount: evTickets.length
          };
        }
      }
    } catch { /* migration 0018 falta */ }
  }
  if (calendarMode === 'mentorship_slot') {
    const horizon = courseExtras?.calendar_horizon_days ?? 30;
    const horizonDate = new Date();
    horizonDate.setDate(horizonDate.getDate() + horizon);
    try {
      // Source: 'instructor' (default, legacy) o 'owner' (config nueva).
      // Default a 'instructor' si la columna no existe (migration 0017 falta).
      let calendarSource: 'instructor' | 'owner' = 'instructor';
      try {
        const { data, error } = await svc.from('courses')
          .select('calendar_source').eq('id', course.id)
          .maybeSingle<{ calendar_source: string | null }>();
        if (!error && data?.calendar_source === 'owner') calendarSource = 'owner';
      } catch { /* idem */ }

      // Instructores asignados (igual para ambos source — afectan ownerías)
      const { data: assignedRaw } = await svc
        .from('course_instructors')
        .select('user_id')
        .eq('tenant_id', tenantId)
        .eq('course_id', course.id);
      const assignedIds = ((assignedRaw ?? []) as Array<{ user_id: string }>)
        .map((r) => r.user_id);

      // Reglas recurrentes: depende del source.
      // - 'owner': tenant-wide (instructor_user_id IS NULL)
      // - 'instructor' + tiene asignados: rules de ESOS instructores
      // - 'instructor' + sin asignados: fallback a tenant-wide
      let rulesQuery = svc.from('availability_rules')
        .select('id, tenant_id, weekday, start_min, end_min, slot_duration_min, timezone, instructor_user_id')
        .eq('tenant_id', tenantId);
      if (calendarSource === 'owner' || assignedIds.length === 0) {
        rulesQuery = rulesQuery.is('instructor_user_id', null);
      } else {
        rulesQuery = rulesQuery.in('instructor_user_id', assignedIds);
      }

      // Fechas puntuales + overrides (defensivo: pueden no existir si 0017 falta)
      let oneOffDates: CalendarDate[] = [];
      let overrides: AvailabilityOverride[] = [];
      try {
        let datesQuery = svc.from('calendar_dates')
          .select('id, date, start_min, end_min, slot_duration_min, timezone, instructor_user_id, course_id')
          .eq('tenant_id', tenantId)
          .gte('date', new Date().toISOString().slice(0, 10));
        // Source determina filtro de instructor; course_id puede ser específico o null
        if (calendarSource === 'owner' || assignedIds.length === 0) {
          datesQuery = datesQuery.is('instructor_user_id', null);
        } else {
          datesQuery = datesQuery.in('instructor_user_id', assignedIds);
        }
        // Solo dates de este publicación o tenant-wide (course_id null)
        const { data: dRaw } = await datesQuery;
        oneOffDates = ((dRaw ?? []) as Array<CalendarDate & { course_id: string | null }>)
          .filter((d) => d.course_id === null || d.course_id === course.id);

        // Overrides: tenant-wide + de los instructores en juego + del course
        const { data: ovRaw } = await svc
          .from('availability_overrides')
          .select('id, start_at, end_at, instructor_user_id, course_id, reason')
          .eq('tenant_id', tenantId)
          .gte('end_at', new Date().toISOString())
          .lte('start_at', horizonDate.toISOString());
        const allOverrides = (ovRaw ?? []) as AvailabilityOverride[];
        overrides = allOverrides.filter((ov) => {
          // Si tiene course_id ≠ este publicación → no aplica
          if (ov.course_id && ov.course_id !== course.id) return false;
          // Si tiene instructor_user_id, solo aplica si ese instructor está en juego
          if (ov.instructor_user_id) {
            if (calendarSource === 'owner') return false;
            return assignedIds.includes(ov.instructor_user_id);
          }
          // Tenant-wide → aplica siempre
          return true;
        });
      } catch { /* migration 0017 falta */ }

      const [rulesRes, takenRes] = await Promise.all([
        rulesQuery,
        svc.from('bookings')
          .select('slot_start, instructor_user_id')
          .eq('tenant_id', tenantId)
          .neq('status', 'cancelled')
          .gte('slot_start', new Date().toISOString())
          .lte('slot_start', horizonDate.toISOString())
      ]);
      const rules = (rulesRes.data ?? []) as Array<AvailabilityRule & { instructor_user_id: string | null }>;
      const taken = (takenRes.data ?? []) as Array<{ slot_start: string; instructor_user_id: string | null }>;
      const takenSet = new Set(taken.map((b) => `${b.instructor_user_id ?? '_tenant'}|${b.slot_start}`));

      // Generamos slots por cada rule. Sumamos los slots de fechas puntuales.
      // Aplicamos overrides al final (los slots dentro de un pause quedan fuera).
      const allSlots: BookingSlot[] = [];
      for (const rule of rules) {
        const key = rule.instructor_user_id ?? '_tenant';
        const ruleSlots = generateSlots({
          rules: [rule],
          takenSlotStarts: new Set(
            [...takenSet]
              .filter((t) => t.startsWith(`${key}|`))
              .map((t) => t.split('|')[1])
          ),
          horizonDays: horizon,
          overrides
        });
        allSlots.push(...ruleSlots);
      }
      // Sumar one-off dates en una sola pasada
      if (oneOffDates.length > 0) {
        const datesSlots = generateSlots({
          rules: [], // no recurrente
          takenSlotStarts: new Set(
            [...takenSet].map((t) => t.split('|')[1])
          ),
          horizonDays: horizon,
          oneOffDates,
          overrides
        });
        allSlots.push(...datesSlots);
      }
      // Dedupe por start (cuando 2 instructores comparten slot mostramos uno)
      const merged = new Map<string, BookingSlot>();
      for (const s of allSlots) {
        const prev = merged.get(s.start);
        if (!prev) {
          merged.set(s.start, { ...s });
        } else {
          merged.set(s.start, { ...s, taken: prev.taken && s.taken });
        }
      }
      calendarSlots = [...merged.values()].sort((a, b) => a.start.localeCompare(b.start));
    } catch { /* migration 0012/0015/0017 falta */ }
  }

  // Resolvemos el user logueado una sola vez (lo usamos para tracking de
  // afiliados y como default del email en el form de checkout).
  const supabaseAuth = await createSupabaseServerClient();
  const { data: { user: currentUser } } = await supabaseAuth.auth.getUser();

  // Affiliate click tracking + cookie set on first ?ref= visit
  // Defensivo: si trackClick falla (RSC + cookies.set, dedupe duplicado,
  // etc), la page no debe romperse — la atribución es nice-to-have.
  if (ref) {
    try {
      const h = await headers();
      const ip =
        (h.get('x-forwarded-for')?.split(',')[0].trim()) ||
        h.get('x-real-ip') ||
        '0.0.0.0';
      const ua = h.get('user-agent') ?? '';
      const referer = h.get('referer') ?? '';
      await trackClick({
        code: ref,
        tenantId,
        ip,
        userAgent: ua,
        referer,
        currentUserId: currentUser?.id ?? null
      });
    } catch (e) {
      console.warn('[course page] trackClick failed', e);
    }
  }

  const { data: modulesRaw } = await svc
    .from("modules")
    .select("id, title, position")
    .eq("course_id", course.id)
    .order("position", { ascending: true });
  const moduleRows = (modulesRaw ?? []) as Array<{ id: string; title: string; position: number }>;

  let lessonRows: Array<{
    id: string;
    title: string;
    drive_embed_url: string | null;
    is_preview: boolean;
    position: number;
    module_id: string;
  }> = [];
  if (moduleRows.length > 0) {
    const { data: ls } = await svc
      .from("lessons")
      .select("id, title, drive_embed_url, is_preview, position, module_id")
      .in("module_id", moduleRows.map((m) => m.id))
      .order("position", { ascending: true });
    lessonRows = (ls ?? []) as typeof lessonRows;
  }

  const modules: ModuleWithLessons[] = moduleRows.map((m) => ({
    ...m,
    lessons: lessonRows.filter((l) => l.module_id === m.id)
  }));

  const totalLessons = lessonRows.length;
  const previewLesson = lessonRows.find((l) => l.is_preview && l.drive_embed_url);

  // ─── A/B/C variants ───
  // El query param ?v=B|C activa una variante alternativa (la que el
  // afiliado eligió en su link). Si no existe la variante o no hay query,
  // usamos el template/config principal (la versión "visible" del owner).
  const variantKey = (variantParam ?? '').toUpperCase();
  const useVariant =
    variantKey &&
    course.landing_variants &&
    typeof course.landing_variants === 'object' &&
    course.landing_variants[variantKey];

  const tpl: LandingTemplate = (useVariant
    ? useVariant.template
    : (course.landing_template ?? 'classic')) as LandingTemplate;
  const tplConfig: LandingConfig = (useVariant
    ? useVariant.config
    : (course.landing_config ?? {})) as LandingConfig;

  // ─── Branching por product_type ───
  // Si es un VIP pack, ignoramos templates y renderizamos la galería bloqueada.
  // Defensivo: si la migration 0031 falta, product_type será undefined y caemos al render normal.
  try {
    const { data: ptData } = await svc
      .from('courses')
      .select('product_type, media_items, preview_url, pack_description')
      .eq('id', course.id)
      .maybeSingle<{
        product_type: string | null;
        media_items: VipMediaItem[] | null;
        preview_url: string | null;
        pack_description: string | null;
      }>();
    if (ptData?.product_type === 'vip_pack') {
      // ¿Está enrolled? (compró)
      let isUnlocked = false;
      if (currentUser) {
        const { data: enr } = await svc
          .from('enrollments')
          .select('id').eq('course_id', course.id).eq('user_id', currentUser.id)
          .maybeSingle<{ id: string }>();
        isUnlocked = !!enr;
      }
      const items = (ptData.media_items ?? []) as VipMediaItem[];

      // Likes + comments (defensivo si migration 0032 no corrió)
      const likesByItem: Record<string, number> = {};
      const userLikedItems = new Set<string>();
      const commentsByItem: Record<string, Array<{
        id: string; user_id: string; comment: string; created_at: string;
        author_name: string | null; author_email: string | null;
      }>> = {};
      if (isUnlocked && items.length > 0) {
        try {
          // Likes — count + user's set
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: likes } = await (svc.from('vip_likes') as any)
            .select('item_id, user_id').eq('course_id', course.id);
          for (const l of (likes ?? []) as Array<{ item_id: string; user_id: string }>) {
            likesByItem[l.item_id] = (likesByItem[l.item_id] ?? 0) + 1;
            if (currentUser && l.user_id === currentUser.id) userLikedItems.add(l.item_id);
          }
          // Comments con join a profiles
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: comms } = await (svc.from('vip_comments') as any)
            .select('id, item_id, user_id, comment, created_at, profiles ( display_name, email )')
            .eq('course_id', course.id)
            .order('created_at', { ascending: true })
            .limit(500);
          for (const c of (comms ?? []) as Array<{
            id: string; item_id: string; user_id: string; comment: string; created_at: string;
            profiles: { display_name: string | null; email: string | null } | null;
          }>) {
            if (!commentsByItem[c.item_id]) commentsByItem[c.item_id] = [];
            commentsByItem[c.item_id].push({
              id: c.id, user_id: c.user_id, comment: c.comment, created_at: c.created_at,
              author_name: c.profiles?.display_name ?? null,
              author_email: c.profiles?.email ?? null
            });
          }
        } catch { /* migration 0032 pendiente */ }
      }

      // Lista de owners/admins del tenant (para moderación de comentarios)
      let ownerUserIds: string[] = [];
      try {
        const { data: owners } = await svc
          .from('memberships')
          .select('user_id')
          .eq('tenant_id', tenantId)
          .in('role', ['owner', 'admin']);
        ownerUserIds = ((owners ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
      } catch { /* ignore */ }

      // Chat fan: si está enrolled, cargar mensajes del thread con el owner
      const chatMessages: Array<{ id: string; sender_kind: 'fan' | 'owner'; body: string; created_at: string }> = [];
      let chatUnread = 0;
      if (isUnlocked && currentUser) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: thread } = await (svc.from('dm_threads') as any)
            .select('id, unread_for_fan').eq('tenant_id', tenantId).eq('fan_user_id', currentUser.id)
            .maybeSingle();
          if (thread?.id) {
            chatUnread = (thread.unread_for_fan as number) ?? 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: msgs } = await (svc.from('dm_messages') as any)
              .select('id, sender_kind, body, created_at')
              .eq('thread_id', thread.id).order('created_at', { ascending: true }).limit(100);
            for (const m of (msgs ?? []) as Array<{ id: string; sender_kind: string; body: string; created_at: string }>) {
              if (m.sender_kind === 'fan' || m.sender_kind === 'owner') {
                chatMessages.push({ id: m.id, sender_kind: m.sender_kind, body: m.body, created_at: m.created_at });
              }
            }
            // Mark fan messages as read
            if (chatUnread > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (svc.from('dm_threads') as any).update({ unread_for_fan: 0 }).eq('id', thread.id);
            }
          }
        } catch { /* migration 0033 falta */ }
      }

      return (
        <VipPackLanding
          tenantId={tenantId}
          tenantName={tenant?.name ?? 'Creador'}
          course={{ ...course, pack_description: ptData.pack_description, preview_url: ptData.preview_url }}
          mediaItems={items}
          isUnlocked={isUnlocked}
          buyerEmail={currentUser?.email ?? ''}
          primary={primary}
          checkoutConfig={checkoutConfig}
          likesByItem={likesByItem}
          userLikedItems={Array.from(userLikedItems)}
          commentsByItem={commentsByItem}
          currentUserId={currentUser?.id ?? null}
          ownerUserIds={ownerUserIds}
          chatMessages={chatMessages}
          chatUnread={chatUnread}
        />
      );
    }
  } catch { /* migration pendiente — sigo con landing default */ }

  // ─── Branching por landing template ───
  if (tpl === 'hotmart') {
    return (
      <HotmartLanding
        course={course}
        modules={modules}
        previewLessonEmbed={previewLesson?.drive_embed_url ?? null}
        previewLessonTitle={previewLesson?.title ?? null}
        totalLessons={totalLessons}
        primary={primary}
        config={tplConfig}
        buyerEmail={currentUser?.email ?? ''}
        checkoutConfig={checkoutConfig}
        calendarMode={calendarMode}
        calendarLabel={courseExtras?.calendar_label ?? null}
        calendarRequired={courseExtras?.calendar_required ?? true}
        calendarSlots={calendarSlots}
      />
    );
  }
  if (tpl === 'funnel') {
    return (
      <FunnelLanding
        course={course}
        modules={modules}
        primary={primary}
        config={tplConfig}
        buyerEmail={currentUser?.email ?? ''}
        checkoutConfig={checkoutConfig}
        calendarMode={calendarMode}
        calendarLabel={courseExtras?.calendar_label ?? null}
        calendarRequired={courseExtras?.calendar_required ?? true}
        calendarSlots={calendarSlots}
      />
    );
  }
  if (tpl === 'vsl') {
    return (
      <VslLanding
        course={{ ...course, tenant_id: tenantId }}
        primary={primary}
        config={tplConfig}
        buyerEmail={currentUser?.email ?? ''}
        checkoutConfig={checkoutConfig}
        calendarMode={calendarMode}
        calendarLabel={courseExtras?.calendar_label ?? null}
        calendarRequired={courseExtras?.calendar_required ?? true}
        calendarSlots={calendarSlots}
      />
    );
  }

  // Default: classic landing (la histórica de Curplat).
  return (
    <article className="max-w-5xl mx-auto px-6 py-10">
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{course.title}</h1>
          {course.description && (
            <p className="text-lg text-black/70 whitespace-pre-line">{course.description}</p>
          )}

          {previewLesson?.drive_embed_url && (
            <div className="rounded-xl overflow-hidden border border-black/10 bg-black aspect-video">
              <iframe
                src={previewLesson.drive_embed_url}
                allow="autoplay; encrypted-media"
                allowFullScreen
                className="w-full h-full"
                title={previewLesson.title}
              />
            </div>
          )}

          {showContentSection && (
          <section>
            <h2 className="text-xl font-bold mb-3">{contentTitle}</h2>
            <p className="text-sm text-black/50 mb-4">
              {modules.length} {moduleLabel} · {totalLessons} {lessonLabel}
            </p>
            <div className="space-y-3">
              {modules.map((m) => (
                <details key={m.id} className="rounded-lg border border-black/10 overflow-hidden">
                  <summary className="cursor-pointer px-4 py-3 bg-black/[0.02] font-medium flex justify-between">
                    <span>{m.title}</span>
                    <span className="text-xs text-black/50">{m.lessons.length} {lessonLabel}</span>
                  </summary>
                  <ul className="divide-y divide-black/5">
                    {m.lessons.map((l) => (
                      <li key={l.id} className="px-4 py-2.5 text-sm flex items-center gap-2">
                        <span className="flex-1">{l.title}</span>
                        {l.is_preview && (
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ background: `${primary}15`, color: primary }}
                          >
                            preview
                          </span>
                        )}
                      </li>
                    ))}
                    {m.lessons.length === 0 && (
                      <li className="px-4 py-2.5 text-sm text-black/40">Sin lecciones todavía.</li>
                    )}
                  </ul>
                </details>
              ))}
              {modules.length === 0 && (
                <div className="rounded-lg border border-black/10 p-6 text-center text-black/50 text-sm">
                  El instructor todavía no cargó el contenido.
                </div>
              )}
            </div>
          </section>
          )}
        </div>

        <aside className="md:col-span-1">
          <div className="sticky top-24 rounded-xl border border-black/10 p-6 space-y-4">
            <div>
              <div className="text-3xl font-bold">
                {course.price_cents === 0
                  ? 'Gratis'
                  : `${(course.price_cents / 100).toLocaleString('es-AR')} ${course.currency}`}
              </div>
              <p className="text-xs text-black/50 mt-1">Pago único · Acceso permanente</p>
            </div>
            {isDebug && (
              <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-[10px] font-mono space-y-0.5">
                <div className="font-bold">🐛 DEBUG</div>
                <div>product_type: <strong>{productType ?? 'null'}</strong></div>
                <div>payment_mode: <strong>{resPaymentMode}</strong></div>
                <div>deposit_percent: <strong>{resDepositPercent}</strong></div>
                <div>linked_venues: <strong>{linkedVenues.length}</strong> ({linkedVenues.map((v) => v.name).join(', ') || '—'})</div>
                <div>useReservationWidget: <strong>{String(useReservationWidget)}</strong></div>
                <div>calendarMode: <strong>{calendarMode}</strong></div>
              </div>
            )}
            {calendarMode === 'event_tickets' ? (
              <TicketPicker
                courseId={course.id}
                priceCents={course.price_cents}
                currency={course.currency}
                primary={primary}
                events={eventDates}
                takenSeatsByDate={takenSeatsByDate}
                defaultEmail={currentUser?.email ?? ''}
              />
            ) : (
              <CouponInput
                courseId={course.id}
                priceCents={course.price_cents}
                currency={course.currency}
                primary={primary}
                defaultEmail={currentUser?.email ?? ''}
                checkoutConfig={checkoutConfig}
                calendarMode={calendarMode}
                calendarLabel={courseExtras?.calendar_label ?? null}
                calendarRequired={courseExtras?.calendar_required ?? true}
                calendarSlots={calendarSlots}
                paymentMode={resPaymentMode}
                depositPercent={resDepositPercent}
                ctaText={ctaTextForType(productType)}
                venues={linkedVenues}
                isReservation={isReservationProduct}
              />
            )}
            <p className="text-xs text-center text-black/40">
              Pago seguro vía MercadoPago
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}

/** CTA según tipo de producto (usa los textos del spec en product-types.ts). */
function ctaTextForType(t: string | null): string {
  switch (t) {
    case 'event':       return 'Comprar entrada';
    case 'mentorship':  return 'Reservar mentoría';
    case 'vip_pack':    return 'Suscribirme';
    case 'digital':     return 'Comprar ahora';
    case 'physical':    return 'Comprar';
    case 'service':     return 'Contratar';
    case 'multi_venue': return 'Reservar lugar';
    case 'restaurant':  return 'Reservar mesa';
    case 'course':
    default:            return 'Comprar publicación';
  }
}
