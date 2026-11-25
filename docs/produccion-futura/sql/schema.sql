-- ============================================================================
-- SIGET-Tonalá · esquema PostgreSQL / Supabase · Fase 1
-- Ejecutar en Supabase SQL Editor. Todo lo sembrado es FICTICIO.
-- Usuarios de prueba: contraseña Demo1234! (cambiar antes de cualquier uso real).
-- Si crypt/gen_salt no están disponibles: create extension pgcrypto;
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
create type public.rol_usuario as enum ('ciudadano', 'secretaria', 'bomberos', 'proteccion_civil', 'admin');
create type public.estado_dependencia as enum ('pendiente', 'turnado', 'en_inspeccion', 'observaciones', 'aprobado', 'rechazado');
-- Las cinco etapas del semáforo. "Rechazado" es una ETIQUETA de la etapa roja,
-- derivada en la app a partir de tramite_dependencias.estado = 'rechazado'.
create type public.estado_general_t as enum ('recepcion', 'turnado', 'verificacion', 'observaciones', 'aprobado');
create type public.tipo_horas as enum ('naturales', 'habiles');
create type public.estado_notificacion as enum ('pendiente', 'enviado', 'error');
create type public.tipo_documento as enum ('solicitud', 'identificacion', 'evidencia', 'acuse', 'dictamen', 'otro');

-- ---------------------------------------------------------------------------
-- 2. Tablas
-- ---------------------------------------------------------------------------
create table public.dependencias (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique check (clave in ('bomberos', 'proteccion_civil', 'ventanilla')),
  nombre text not null
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  email text not null unique,
  rol public.rol_usuario not null,
  dependencia_id uuid references public.dependencias(id) on delete set null
);

create table public.tramites (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  numero_control text not null unique,
  ciudadano_id uuid not null references public.profiles(id),
  tipo_tramite text not null,
  giro_principal text not null,
  giros_anexos text[] not null default '{}',
  domicilio_negocio text not null,
  domicilio_contribuyente text not null default '',
  fecha_solicitud date not null default current_date,
  colonia text not null,
  cp text not null check (cp ~ '^[0-9]{5}$'),
  superficie_m2 numeric(10,2) not null check (superficie_m2 > 0),
  inversion_estimada numeric(12,2) not null check (inversion_estimada >= 0),
  nombre_contribuyente text not null,
  telefono text not null,
  estado_general public.estado_general_t not null default 'recepcion',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tramite_dependencias (
  id uuid primary key default gen_random_uuid(),
  tramite_id uuid not null references public.tramites(id) on delete cascade,
  dependencia_id uuid not null references public.dependencias(id),
  estado public.estado_dependencia not null default 'pendiente',
  turnado_at timestamptz,
  acuse_at timestamptz,
  dictamen_at timestamptz,
  dictamen text,
  motivo text,
  oficio_id uuid,
  sla_horas integer not null default 72 check (sla_horas > 0),
  pausado_desde timestamptz,
  horas_pausadas numeric(10,2) not null default 0,
  fecha_visita date,
  unique (tramite_id, dependencia_id)
);

create table public.oficios_turnados (
  id uuid primary key default gen_random_uuid(),
  numero_oficio text not null unique,
  fecha_emision timestamptz not null default now(),
  dependencia_destino uuid not null references public.dependencias(id),
  sello_fecha date,
  sello_hora time,
  sello_folio text,
  acuse_documento_id uuid,
  created_by uuid not null references public.profiles(id)
);

alter table public.tramite_dependencias
  add constraint fk_td_oficio foreign key (oficio_id) references public.oficios_turnados(id);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  tramite_id uuid not null references public.tramites(id) on delete cascade,
  tipo public.tipo_documento not null,
  storage_path text not null,
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- INMUTABLE: nunca se actualiza ni se borra. Solo INSERT y SELECT.
create table public.historial_eventos (
  id uuid primary key default gen_random_uuid(),
  tramite_id uuid not null references public.tramites(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  actor_rol public.rol_usuario not null,
  accion text not null,
  datos_antes text,
  datos_despues text,
  created_at timestamptz not null default now()
);

create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  tramite_id uuid not null references public.tramites(id) on delete cascade,
  destinatario text not null,
  plantilla text not null,
  asunto text not null,
  estado public.estado_notificacion not null default 'pendiente',
  error_motivo text,
  clave_idempotencia text not null unique,
  intentos integer not null default 0,
  created_at timestamptz not null default now(),
  enviado_at timestamptz,
  -- Fase 6: auditoría del envío. Opcionales para conservar filas anteriores.
  cuerpo text,
  enviado_a text,
  destinatario_original text
);

create table public.configuracion_sla (
  id uuid primary key default gen_random_uuid(),
  dependencia_id uuid not null unique references public.dependencias(id) on delete cascade,
  horas_limite integer not null default 72 check (horas_limite > 0),
  tipo_horas public.tipo_horas not null default 'naturales',
  horas_alerta_previa integer not null default 48 check (horas_alerta_previa > 0)
);

-- ---------------------------------------------------------------------------
-- 3. Índices y secuencia de folios
-- ---------------------------------------------------------------------------
create sequence public.tramite_folio_seq start 1;

create index idx_tramites_ciudadano_fecha on public.tramites(ciudadano_id, created_at desc);
create index idx_tramites_estado on public.tramites(estado_general);
create index idx_td_tramite on public.tramite_dependencias(tramite_id);
create index idx_td_dependencia_estado on public.tramite_dependencias(dependencia_id, estado);
create index idx_td_oficio on public.tramite_dependencias(oficio_id);
create index idx_oficios_destino on public.oficios_turnados(dependencia_destino);
create index idx_documentos_tramite on public.documentos(tramite_id);
create index idx_historial_tramite_fecha on public.historial_eventos(tramite_id, created_at desc);
create index idx_notificaciones_estado on public.notificaciones(estado, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Funciones y triggers de dominio
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_tramites_updated_at
before update on public.tramites
for each row execute function public.set_updated_at();

create or replace function public.historial_inmutable()
returns trigger language plpgsql as $$
begin
  raise exception 'historial_eventos es inmutable: no se puede modificar ni borrar';
end;
$$;

create trigger trg_historial_inmutable
before update or delete on public.historial_eventos
for each row execute function public.historial_inmutable();

-- Helpers de sesión. SECURITY DEFINER para evitar recursión con RLS.
create or replace function public.mi_rol()
returns public.rol_usuario language sql stable security definer set search_path = public as $$
  select rol from public.profiles where id = auth.uid();
$$;

create or replace function public.mi_dependencia_id()
returns uuid language sql stable security definer set search_path = public as $$
  select dependencia_id from public.profiles where id = auth.uid();
$$;

create or replace function public.puede_ver_tramite(p_tramite_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.tramites t
    where t.id = p_tramite_id
      and (
        public.mi_rol() in ('secretaria', 'admin')
        or (public.mi_rol() = 'ciudadano' and t.ciudadano_id = auth.uid())
        or (
          public.mi_rol() in ('bomberos', 'proteccion_civil')
          and exists (
            select 1
            from public.tramite_dependencias td
            join public.dependencias d on d.id = td.dependencia_id
            where td.tramite_id = t.id and d.clave = public.mi_rol()::text
          )
        )
      )
  );
$$;

-- Estado general DERIVADO. Nunca se edita a mano desde la aplicación.
create or replace function public.recalcular_estado_general(p_tramite_id uuid)
returns public.estado_general_t language plpgsql security definer set search_path = public as $$
declare
  v_estado public.estado_general_t;
  v_total integer;
begin
  select count(*) into v_total from public.tramite_dependencias where tramite_id = p_tramite_id;

  if exists (
    select 1 from public.tramite_dependencias
    where tramite_id = p_tramite_id and estado in ('observaciones', 'rechazado')
  ) then
    v_estado := 'observaciones';
  elsif v_total = 0 then
    v_estado := 'recepcion';
  elsif not exists (
    select 1 from public.tramite_dependencias
    where tramite_id = p_tramite_id and estado <> 'aprobado'
  ) then
    v_estado := 'aprobado';
  elsif exists (
    select 1 from public.tramite_dependencias
    where tramite_id = p_tramite_id and estado = 'en_inspeccion'
  ) then
    v_estado := 'verificacion';
  elsif exists (
    select 1 from public.tramite_dependencias
    where tramite_id = p_tramite_id and estado = 'turnado'
  ) then
    v_estado := 'turnado';
  else
    v_estado := 'recepcion';
  end if;

  update public.tramites
  set estado_general = v_estado, updated_at = now()
  where id = p_tramite_id;

  return v_estado;
end;
$$;

create or replace function public.trg_recalcular_estado_general()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tramite_id uuid;
begin
  if tg_op = 'DELETE' then
    v_tramite_id := old.tramite_id;
  else
    v_tramite_id := new.tramite_id;
  end if;
  perform public.recalcular_estado_general(v_tramite_id);
  return null;
end;
$$;

create trigger trg_td_recalcular_estado
after insert or update or delete on public.tramite_dependencias
for each row execute function public.trg_recalcular_estado_general();

-- El rol no puede ser modificado por el usuario (ni por admin desde la app).
create or replace function public.profiles_rol_inmutable()
returns trigger language plpgsql as $$
begin
  if new.rol is distinct from old.rol
     and coalesce(current_setting('siget.permitir_cambio_rol', true), 'off') <> 'on' then
    raise exception 'El rol de una persona no puede modificarse desde la aplicación';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_rol_inmutable
before update on public.profiles
for each row execute function public.profiles_rol_inmutable();

-- Transiciones permitidas, aplicadas también en base de datos (defensa en profundidad).
create or replace function public.validar_transicion_dependencia()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
  v_dependencia uuid;
begin
  v_rol := public.mi_rol()::text;
  v_dependencia := public.mi_dependencia_id();

  -- service_role / mantenimiento: sin perfil de aplicación, se permite.
  if v_rol is null then
    return new;
  end if;

  if old.estado is distinct from new.estado then
    if v_rol in ('bomberos', 'proteccion_civil') then
      if v_dependencia is distinct from new.dependencia_id then
        raise exception 'Solo puedes operar sobre tu dependencia';
      end if;
      if not (
        (old.estado = 'turnado' and new.estado = 'en_inspeccion')
        or (old.estado = 'en_inspeccion' and new.estado in ('aprobado', 'rechazado', 'observaciones'))
      ) then
        raise exception 'Transición de revisión no permitida';
      end if;
    elsif v_rol = 'secretaria' then
      -- Fase 5: el acuse OCR confirmado por una persona abre esta única
      -- excepción. El flag lo pone la RPC y vive sólo dentro de su transacción.
      if not (
        (old.estado = 'pendiente' and new.estado = 'turnado')
        or (
          old.estado = 'turnado' and new.estado = 'en_inspeccion'
          and coalesce(current_setting('siget.acuse_ocr_confirmado', true), 'off') = 'on'
        )
      ) then
        raise exception 'Ventanilla solo puede turnar o confirmar el acuse leído';
      end if;
    elsif v_rol = 'ciudadano' then
      if not (old.estado = 'observaciones' and new.estado = 'en_inspeccion') then
        raise exception 'La ciudadanía solo entrega evidencia desde observaciones';
      end if;
    else
      raise exception 'Tu rol no puede cambiar el estado de una revisión';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_td_validar_transicion
before update on public.tramite_dependencias
for each row execute function public.validar_transicion_dependencia();

-- Alta de trámite con sus dependencias requeridas ( RPC atómica ).
create or replace function public.crear_tramite_con_dependencias(
  p_giro_principal text,
  p_giros_anexos text[],
  p_domicilio_negocio text,
  p_colonia text,
  p_cp text,
  p_superficie_m2 numeric,
  p_inversion_estimada numeric,
  p_nombre_contribuyente text,
  p_telefono text,
  p_dependencias text[],
  p_ciudadano_id uuid default null,
  p_tipo_tramite text default 'Licencia de funcionamiento',
  p_domicilio_contribuyente text default '',
  p_fecha_solicitud date default current_date
)
returns public.tramites language plpgsql security definer set search_path = public as $$
declare
  v_rol text := public.mi_rol()::text;
  v_ciudadano uuid := coalesce(p_ciudadano_id, auth.uid());
  v_consecutivo integer;
  v_tramite public.tramites;
  v_clave text;
  v_dependencia public.dependencias;
begin
  if v_rol not in ('ciudadano', 'secretaria') then
    raise exception 'Solo la ciudadanía o la ventanilla pueden registrar solicitudes';
  end if;
  if v_ciudadano is null or not exists (
    select 1 from public.profiles p where p.id = v_ciudadano and p.rol = 'ciudadano'
  ) then
    raise exception 'La persona contribuyente debe existir como perfil ciudadano';
  end if;
  if v_rol = 'ciudadano' and v_ciudadano <> auth.uid() then
    raise exception 'No puedes registrar un trámite a nombre de otra persona';
  end if;
  if coalesce(array_length(p_dependencias, 1), 0) = 0 then
    raise exception 'Selecciona al menos una dependencia';
  end if;
  if p_cp !~ '^[0-9]{5}$' or p_superficie_m2 <= 0 or p_inversion_estimada < 0 then
    raise exception 'Revisa el código postal, la superficie y la inversión';
  end if;

  v_consecutivo := nextval('public.tramite_folio_seq')::integer;

  insert into public.tramites (
    folio, numero_control, ciudadano_id, tipo_tramite, giro_principal, giros_anexos,
    domicilio_negocio, domicilio_contribuyente, fecha_solicitud, colonia, cp,
    superficie_m2, inversion_estimada, nombre_contribuyente, telefono
  ) values (
    'TT-' || to_char(now(), 'YYYY') || '-' || lpad(v_consecutivo::text, 4, '0'),
    'CTRL-' || to_char(now(), 'YYMM') || '-' || lpad(v_consecutivo::text, 4, '0'),
    v_ciudadano, btrim(p_tipo_tramite), btrim(p_giro_principal),
    coalesce(p_giros_anexos, '{}'), btrim(p_domicilio_negocio),
    btrim(coalesce(p_domicilio_contribuyente, '')), coalesce(p_fecha_solicitud, current_date),
    btrim(p_colonia), p_cp, p_superficie_m2, p_inversion_estimada,
    btrim(p_nombre_contribuyente), btrim(p_telefono)
  ) returning * into v_tramite;

  foreach v_clave in array p_dependencias loop
    select * into v_dependencia from public.dependencias where clave = v_clave;
    if not found then
      raise exception 'La dependencia % no existe', v_clave;
    end if;
    insert into public.tramite_dependencias (tramite_id, dependencia_id, sla_horas)
    values (
      v_tramite.id,
      v_dependencia.id,
      coalesce((select horas_limite from public.configuracion_sla where dependencia_id = v_dependencia.id), 72)
    );
  end loop;

  insert into public.historial_eventos (tramite_id, actor_id, actor_rol, accion, datos_despues)
  values (v_tramite.id, auth.uid(), v_rol::public.rol_usuario, 'tramite_creado', row_to_json(v_tramite)::text);

  return v_tramite;
end;
$$;

-- Registro de notificaciones con idempotencia (lo llama /api/cron/sla).
create or replace function public.registrar_notificacion(
  p_tramite_id uuid,
  p_destinatario text,
  p_plantilla text,
  p_asunto text,
  p_clave_idempotencia text
)
returns public.notificaciones language plpgsql security definer set search_path = public as $$
declare
  v_notificacion public.notificaciones;
begin
  insert into public.notificaciones (
    tramite_id, destinatario, plantilla, asunto, estado, clave_idempotencia, intentos
  ) values (
    p_tramite_id, p_destinatario, p_plantilla, p_asunto, 'pendiente', p_clave_idempotencia, 0
  )
  on conflict (clave_idempotencia) do nothing
  returning * into v_notificacion;

  if not found then
    select * into v_notificacion
    from public.notificaciones where clave_idempotencia = p_clave_idempotencia;
  end if;

  return v_notificacion;
end;
$$;

create or replace function public.marcar_notificacion(
  p_id uuid,
  p_estado public.estado_notificacion,
  p_error_motivo text default null
)
returns public.notificaciones language plpgsql security definer set search_path = public as $$
declare
  v_notificacion public.notificaciones;
begin
  update public.notificaciones
  set estado = p_estado,
      error_motivo = p_error_motivo,
      intentos = intentos + 1,
      enviado_at = case when p_estado = 'enviado' then now() else enviado_at end
  where id = p_id
  returning * into v_notificacion;
  return v_notificacion;
end;
$$;

-- Fase 6: registra cada intento con su número y dirección real de envío.
create or replace function public.marcar_intento_notificacion(
  p_id uuid,
  p_estado public.estado_notificacion,
  p_intentos integer,
  p_error_motivo text default null,
  p_enviado_at timestamptz default null,
  p_cuerpo text default null,
  p_enviado_a text default null,
  p_destinatario_original text default null
)
returns public.notificaciones language plpgsql security definer set search_path = public as $$
declare
  v_notificacion public.notificaciones;
begin
  update public.notificaciones
  set estado = p_estado,
      intentos = greatest(0, p_intentos),
      error_motivo = p_error_motivo,
      enviado_at = case when p_estado = 'enviado' then coalesce(p_enviado_at, now()) else null end,
      cuerpo = coalesce(p_cuerpo, cuerpo),
      enviado_a = coalesce(p_enviado_a, enviado_a),
      destinatario_original = coalesce(p_destinatario_original, destinatario_original)
  where id = p_id
  returning * into v_notificacion;

  if not found then
    raise exception 'No existe esa notificación';
  end if;
  return v_notificacion;
end;
$$;

-- Fase 6: cambio de rol. Sólo administración, nunca el propio perfil.
create or replace function public.actualizar_rol_usuario(
  p_id uuid,
  p_rol public.rol_usuario
)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  v_perfil public.profiles;
begin
  if public.mi_rol() <> 'admin' then
    raise exception 'Sólo la administración puede cambiar roles';
  end if;
  if p_id = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol';
  end if;
  update public.profiles set rol = p_rol where id = p_id returning * into v_perfil;
  if not found then
    raise exception 'No existe ese usuario';
  end if;
  return v_perfil;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.dependencias enable row level security;
alter table public.tramites enable row level security;
alter table public.tramite_dependencias enable row level security;
alter table public.oficios_turnados enable row level security;
alter table public.documentos enable row level security;
alter table public.historial_eventos enable row level security;
alter table public.notificaciones enable row level security;
alter table public.configuracion_sla enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using (id = auth.uid() or public.mi_rol() in ('secretaria', 'admin'));
create policy profiles_insert_admin on public.profiles for insert to authenticated
with check (public.mi_rol() = 'admin');
create policy profiles_update_admin on public.profiles for update to authenticated
using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');

create policy dependencias_select on public.dependencias for select to authenticated using (true);
create policy dependencias_insert_admin on public.dependencias for insert to authenticated
with check (public.mi_rol() = 'admin');
create policy dependencias_update_admin on public.dependencias for update to authenticated
using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');
create policy dependencias_delete_admin on public.dependencias for delete to authenticated
using (public.mi_rol() = 'admin');

create policy tramites_select on public.tramites for select to authenticated
using (public.puede_ver_tramite(id));
create policy tramites_insert on public.tramites for insert to authenticated
with check (
  public.mi_rol() in ('secretaria', 'admin')
  or (public.mi_rol() = 'ciudadano' and ciudadano_id = auth.uid())
);
create policy tramites_update_ventanilla on public.tramites for update to authenticated
using (public.mi_rol() in ('secretaria', 'admin'))
with check (public.mi_rol() in ('secretaria', 'admin'));

create policy td_select on public.tramite_dependencias for select to authenticated
using (public.puede_ver_tramite(tramite_id));
create policy td_insert_ventanilla on public.tramite_dependencias for insert to authenticated
with check (public.mi_rol() in ('secretaria', 'admin'));
create policy td_update on public.tramite_dependencias for update to authenticated
using (
  public.mi_rol() in ('secretaria', 'admin')
  or (public.mi_rol() in ('bomberos', 'proteccion_civil') and dependencia_id = public.mi_dependencia_id())
  or (
    public.mi_rol() = 'ciudadano'
    and exists (select 1 from public.tramites t where t.id = tramite_id and t.ciudadano_id = auth.uid())
  )
)
with check (
  public.mi_rol() in ('secretaria', 'admin')
  or (public.mi_rol() in ('bomberos', 'proteccion_civil') and dependencia_id = public.mi_dependencia_id())
  or (
    public.mi_rol() = 'ciudadano'
    and exists (select 1 from public.tramites t where t.id = tramite_id and t.ciudadano_id = auth.uid())
  )
);

create policy oficios_select on public.oficios_turnados for select to authenticated
using (
  exists (
    select 1 from public.tramite_dependencias td
    where td.oficio_id = oficios_turnados.id and public.puede_ver_tramite(td.tramite_id)
  )
);
create policy oficios_insert on public.oficios_turnados for insert to authenticated
with check (public.mi_rol() in ('secretaria', 'admin'));
create policy oficios_update_sello on public.oficios_turnados for update to authenticated
using (public.mi_rol() in ('secretaria', 'admin')) with check (public.mi_rol() in ('secretaria', 'admin'));
create policy oficios_delete_admin on public.oficios_turnados for delete to authenticated
using (public.mi_rol() = 'admin');

create policy documentos_select on public.documentos for select to authenticated
using (public.puede_ver_tramite(tramite_id));
create policy documentos_insert on public.documentos for insert to authenticated
with check (
  created_by = auth.uid()
  and public.puede_ver_tramite(tramite_id)
  and (
    public.mi_rol() <> 'ciudadano'
    or exists (select 1 from public.tramites t where t.id = tramite_id and t.ciudadano_id = auth.uid())
  )
);

create policy historial_select on public.historial_eventos for select to authenticated
using (public.puede_ver_tramite(tramite_id));
create policy historial_insert on public.historial_eventos for insert to authenticated
with check (actor_id = auth.uid() and public.puede_ver_tramite(tramite_id));
-- Sin políticas de UPDATE ni DELETE. El trigger historial_inmutable las bloquea.

create policy notificaciones_select on public.notificaciones for select to authenticated
using (public.mi_rol() in ('secretaria', 'admin') or destinatario = auth.email());
-- Sin INSERT/UPDATE/DELETE para authenticated: solo service_role / funciones SECURITY DEFINER.

create policy sla_select on public.configuracion_sla for select to authenticated using (true);
create policy sla_insert_admin on public.configuracion_sla for insert to authenticated
with check (public.mi_rol() = 'admin');
create policy sla_update_admin on public.configuracion_sla for update to authenticated
using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');
create policy sla_delete_admin on public.configuracion_sla for delete to authenticated
using (public.mi_rol() = 'admin');

grant usage on schema public to authenticated;
grant execute on function public.mi_rol() to authenticated;
grant execute on function public.mi_dependencia_id() to authenticated;
grant execute on function public.puede_ver_tramite(uuid) to authenticated;
grant execute on function public.crear_tramite_con_dependencias(text, text[], text, text, text, numeric, numeric, text, text, text[], uuid, text, text, date) to authenticated;
grant execute on function public.marcar_intento_notificacion(uuid, public.estado_notificacion, integer, text, timestamptz, text, text, text) to authenticated;
grant execute on function public.actualizar_rol_usuario(uuid, public.rol_usuario) to authenticated;
grant select on public.profiles, public.dependencias, public.tramites, public.tramite_dependencias,
  public.oficios_turnados, public.documentos, public.historial_eventos, public.notificaciones,
  public.configuracion_sla to authenticated;
grant insert on public.profiles, public.dependencias, public.tramites, public.tramite_dependencias,
  public.oficios_turnados, public.documentos, public.historial_eventos, public.configuracion_sla to authenticated;
grant update on public.profiles, public.dependencias, public.tramites, public.tramite_dependencias,
  public.oficios_turnados, public.configuracion_sla to authenticated;
grant delete on public.dependencias, public.oficios_turnados, public.configuracion_sla to authenticated;
revoke update, delete on public.historial_eventos from authenticated;
revoke insert, update, delete on public.notificaciones from authenticated;

-- ---------------------------------------------------------------------------
-- 6. Storage (buckets privados; la ruta es <tramite_id>/<archivo>)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('documentos-tramites', 'documentos-tramites', false),
  ('evidencias', 'evidencias', false),
  ('oficios', 'oficios', false)
on conflict (id) do nothing;

create or replace function public.tramite_id_desde_ruta(p_ruta text)
returns uuid language sql immutable as $$
  select case
    when (storage.foldername(p_ruta))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then ((storage.foldername(p_ruta))[1])::uuid
    else null::uuid
  end;
$$;

create policy storage_leer on storage.objects for select to authenticated
using (
  bucket_id in ('documentos-tramites', 'evidencias', 'oficios')
  and public.puede_ver_tramite(public.tramite_id_desde_ruta(name))
);

create policy storage_subir on storage.objects for insert to authenticated
with check (
  bucket_id in ('documentos-tramites', 'evidencias', 'oficios')
  and owner = auth.uid()
  and public.puede_ver_tramite(public.tramite_id_desde_ruta(name))
);
-- Sin UPDATE ni DELETE: los documentos conservan trazabilidad.

-- ---------------------------------------------------------------------------
-- 7. Datos semilla FICTICIOS
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'maria.ruiz@correo-ejemplo.mx', crypt('Demo1234!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'teresa.aguilar@tonala-ejemplo.gob.mx', crypt('Demo1234!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'roberto.salinas@tonala-ejemplo.gob.mx', crypt('Demo1234!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'veronica.paredes@tonala-ejemplo.gob.mx', crypt('Demo1234!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'admin.siget@tonala-ejemplo.gob.mx', crypt('Demo1234!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into public.dependencias (id, clave, nombre) values
  ('80000000-0000-0000-0000-000000000001', 'bomberos', 'Bomberos Tonalá'),
  ('80000000-0000-0000-0000-000000000002', 'proteccion_civil', 'Protección Civil Tonalá'),
  ('80000000-0000-0000-0000-000000000003', 'ventanilla', 'Ventanilla')
on conflict (id) do nothing;

insert into public.profiles (id, nombre, email, rol, dependencia_id) values
  ('a0000000-0000-0000-0000-000000000001', 'María Elena Ruiz López', 'maria.ruiz@correo-ejemplo.mx', 'ciudadano', null),
  ('a0000000-0000-0000-0000-000000000002', 'Lic. Teresa Aguilar Méndez', 'teresa.aguilar@tonala-ejemplo.gob.mx', 'secretaria', '80000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000003', 'Cap. Roberto Salinas Vega', 'roberto.salinas@tonala-ejemplo.gob.mx', 'bomberos', '80000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000004', 'Ing. Verónica Paredes Nava', 'veronica.paredes@tonala-ejemplo.gob.mx', 'proteccion_civil', '80000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000005', 'Administrador SIGET (demo)', 'admin.siget@tonala-ejemplo.gob.mx', 'admin', null)
on conflict (id) do nothing;

insert into public.configuracion_sla (id, dependencia_id, horas_limite, tipo_horas, horas_alerta_previa) values
  ('90000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 72, 'naturales', 48),
  ('90000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', 72, 'habiles', 48),
  ('90000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000003', 72, 'naturales', 48)
on conflict (id) do nothing;

-- 10 trámites ficticios. Colonias y giros son ejemplos editables, NO requisitos oficiales.
insert into public.tramites (
  id, folio, numero_control, ciudadano_id, tipo_tramite, giro_principal, giros_anexos,
  domicilio_negocio, colonia, cp, superficie_m2, inversion_estimada, nombre_contribuyente, telefono
) values
  ('20000000-0000-0000-0000-000000000001', 'TT-2026-0001', 'CTRL-2601-0001', 'a0000000-0000-0000-0000-000000000001', 'Licencia de funcionamiento', 'Abarrotes', '{}', 'Calle Hidalgo 214', 'Centro', '45400', 48, 85000, 'María Elena Ruiz López', '3331000001'),
  ('20000000-0000-0000-0000-000000000002', 'TT-2026-0002', 'CTRL-2601-0002', 'a0000000-0000-0000-0000-000000000001', 'Licencia de funcionamiento', 'Panadería', '{Venta de café}', 'Av. Reforma 1025', 'Lázaro Cárdenas', '45420', 92, 160000, 'Jorge Alberto Sánchez Pérez', '3331000002'),
  ('20000000-0000-0000-0000-000000000003', 'TT-2026-0003', 'CTRL-2601-0003', 'a0000000-0000-0000-0000-000000000001', 'Licencia de funcionamiento', 'Papelería', '{}', 'Calle Juárez 88', 'Centro', '45400', 36, 60000, 'Rosa María Gutiérrez Vargas', '3331000003'),
  ('20000000-0000-0000-0000-000000000004', 'TT-2026-0004', 'CTRL-2601-0004', 'a0000000-0000-0000-0000-000000000001', 'Permiso de funcionamiento', 'Restaurante', '{Venta de bebidas}', 'Av. Ribot 340', 'Jardines de Tonalá', '45460', 150, 320000, 'Carlos Daniel Mendoza Ruiz', '3331000004'),
  ('20000000-0000-0000-0000-000000000005', 'TT-2026-0005', 'CTRL-2601-0005', 'a0000000-0000-0000-0000-000000000001', 'Licencia de funcionamiento', 'Taller mecánico', '{}', 'Calle Industrial 77', 'Prados de la Providencia', '45485', 210, 240000, 'Ana Patricia Flores Hernández', '3331000005'),
  ('20000000-0000-0000-0000-000000000006', 'TT-2026-0006', 'CTRL-2601-0006', 'a0000000-0000-0000-0000-000000000001', 'Licencia de funcionamiento', 'Salón de belleza', '{}', 'Calle Morelos 19', 'Villa de Tonalá', '45430', 42, 75000, 'Laura Guadalupe Ramírez Díaz', '3331000006'),
  ('20000000-0000-0000-0000-000000000007', 'TT-2026-0007', 'CTRL-2601-0007', 'a0000000-0000-0000-0000-000000000001', 'Permiso de funcionamiento', 'Ferretería', '{}', 'Av. Tonalá 812', 'El Rosario', '45440', 120, 190000, 'Miguel Ángel Torres Campos', '3331000007'),
  ('20000000-0000-0000-0000-000000000008', 'TT-2026-0008', 'CTRL-2601-0008', 'a0000000-0000-0000-0000-000000000001', 'Licencia de funcionamiento', 'Venta de ropa', '{}', 'Calle Zaragoza 501', 'La Aurora', '45450', 65, 110000, 'Sofía Alejandra Nieto Cruz', '3331000008'),
  ('20000000-0000-0000-0000-000000000009', 'TT-2026-0009', 'CTRL-2601-0009', 'a0000000-0000-0000-0000-000000000001', 'Licencia de funcionamiento', 'Panadería', '{Venta de pan de dulce}', 'Calle Obrero Mundial 233', 'Cerro del Cuatro', '45410', 78, 130000, 'Pedro Antonio Villanueva León', '3331000009'),
  ('20000000-0000-0000-0000-000000000010', 'TT-2026-0010', 'CTRL-2601-0010', 'a0000000-0000-0000-0000-000000000001', 'Permiso de funcionamiento', 'Abarrotes', '{}', 'Calle Loma Dorada 64', 'Prados de la Providencia', '45485', 55, 95000, 'Elena Beatriz Castillo Ortega', '3331000010')
on conflict (id) do nothing;

insert into public.oficios_turnados (
  id, numero_oficio, fecha_emision, dependencia_destino, sello_fecha, sello_hora, sello_folio, acuse_documento_id, created_by
) values
  ('40000000-0000-0000-0000-000000000001', 'OF-2026-0001-01', now() - interval '20 hours', '80000000-0000-0000-0000-000000000001', null, null, null, null, 'a0000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000002', 'OF-2026-0002-01', now() - interval '50 hours', '80000000-0000-0000-0000-000000000001', (now() - interval '45 hours')::date, (now() - interval '45 hours')::time, 'SEL-2026-0002', '50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000003', 'OF-2026-0002-02', now() - interval '12 hours', '80000000-0000-0000-0000-000000000002', null, null, null, null, 'a0000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000004', 'OF-2026-0003-01', now() - interval '180 hours', '80000000-0000-0000-0000-000000000001', (now() - interval '175 hours')::date, (now() - interval '175 hours')::time, 'SEL-2026-0003', '50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000005', 'OF-2026-0003-02', now() - interval '180 hours', '80000000-0000-0000-0000-000000000002', (now() - interval '174 hours')::date, (now() - interval '174 hours')::time, 'SEL-2026-0004', '50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000006', 'OF-2026-0004-01', now() - interval '100 hours', '80000000-0000-0000-0000-000000000001', (now() - interval '95 hours')::date, (now() - interval '95 hours')::time, 'SEL-2026-0005', '50000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000007', 'OF-2026-0004-02', now() - interval '100 hours', '80000000-0000-0000-0000-000000000002', (now() - interval '96 hours')::date, (now() - interval '96 hours')::time, 'SEL-2026-0006', '50000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000008', 'OF-2026-0005-01', now() - interval '280 hours', '80000000-0000-0000-0000-000000000001', (now() - interval '275 hours')::date, (now() - interval '275 hours')::time, 'SEL-2026-0007', '50000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000009', 'OF-2026-0005-02', now() - interval '280 hours', '80000000-0000-0000-0000-000000000002', (now() - interval '274 hours')::date, (now() - interval '274 hours')::time, 'SEL-2026-0008', '50000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000010', 'OF-2026-0007-01', now() - interval '140 hours', '80000000-0000-0000-0000-000000000001', (now() - interval '138 hours')::date, (now() - interval '138 hours')::time, 'SEL-2026-0009', '50000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000011', 'OF-2026-0007-02', now() - interval '140 hours', '80000000-0000-0000-0000-000000000002', (now() - interval '136 hours')::date, (now() - interval '136 hours')::time, 'SEL-2026-0010', '50000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000012', 'OF-2026-0008-01', now() - interval '80 hours', '80000000-0000-0000-0000-000000000001', null, null, null, null, 'a0000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000013', 'OF-2026-0009-01', now() - interval '35 hours', '80000000-0000-0000-0000-000000000001', (now() - interval '32 hours')::date, (now() - interval '32 hours')::time, 'SEL-2026-0011', '50000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000014', 'OF-2026-0010-01', now() - interval '38 hours', '80000000-0000-0000-0000-000000000002', (now() - interval '36 hours')::date, (now() - interval '36 hours')::time, 'SEL-2026-0012', '50000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

-- Un renglón por dependencia requerida; el trigger deriva estado_general.
insert into public.tramite_dependencias (
  id, tramite_id, dependencia_id, estado, turnado_at, acuse_at, dictamen_at, dictamen, motivo,
  oficio_id, sla_horas, pausado_desde, horas_pausadas
) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'turnado', now() - interval '20 hours', null, null, null, null, '40000000-0000-0000-0000-000000000001', 72, null, 0),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'en_inspeccion', now() - interval '50 hours', now() - interval '45 hours', null, null, null, '40000000-0000-0000-0000-000000000002', 72, null, 0),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', 'turnado', now() - interval '12 hours', null, null, null, null, '40000000-0000-0000-0000-000000000003', 72, null, 0),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', 'aprobado', now() - interval '180 hours', now() - interval '175 hours', now() - interval '150 hours', 'aprobado', null, '40000000-0000-0000-0000-000000000004', 72, null, 0),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000002', 'aprobado', now() - interval '180 hours', now() - interval '174 hours', now() - interval '140 hours', 'aprobado', null, '40000000-0000-0000-0000-000000000005', 72, null, 0),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000001', 'observaciones', now() - interval '100 hours', now() - interval '95 hours', now() - interval '40 hours', 'observaciones', 'Falta el croquis de salidas de emergencia.', '40000000-0000-0000-0000-000000000006', 72, now() - interval '40 hours', 0),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000002', 'aprobado', now() - interval '100 hours', now() - interval '96 hours', now() - interval '70 hours', 'aprobado', null, '40000000-0000-0000-0000-000000000007', 72, null, 0),
  ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000001', 'rechazado', now() - interval '280 hours', now() - interval '275 hours', now() - interval '220 hours', 'rechazado', 'No hay extintor vigente en el local.', '40000000-0000-0000-0000-000000000008', 72, null, 0),
  ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000002', 'aprobado', now() - interval '280 hours', now() - interval '274 hours', now() - interval '250 hours', 'aprobado', null, '40000000-0000-0000-0000-000000000009', 72, null, 0),
  ('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000001', 'aprobado', now() - interval '140 hours', now() - interval '138 hours', now() - interval '100 hours', 'aprobado', null, '40000000-0000-0000-0000-000000000010', 72, null, 0),
  ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000002', 'en_inspeccion', now() - interval '140 hours', now() - interval '136 hours', null, null, null, '40000000-0000-0000-0000-000000000011', 72, null, 0),
  ('30000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000001', 'turnado', now() - interval '80 hours', null, null, null, null, '40000000-0000-0000-0000-000000000012', 72, null, 0),
  ('30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000001', 'en_inspeccion', now() - interval '35 hours', now() - interval '32 hours', null, null, null, '40000000-0000-0000-0000-000000000013', 72, now() - interval '10 hours', 4),
  ('30000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000010', '80000000-0000-0000-0000-000000000002', 'observaciones', now() - interval '38 hours', now() - interval '36 hours', now() - interval '15 hours', 'observaciones', 'Falta el croquis del local.', '40000000-0000-0000-0000-000000000014', 72, now() - interval '15 hours', 0)
on conflict (id) do nothing;

insert into public.documentos (id, tramite_id, tipo, storage_path, mime, size_bytes, created_by) values
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'solicitud', '20000000-0000-0000-0000-000000000001/solicitud.pdf', 'application/pdf', 245000, 'a0000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'acuse', '20000000-0000-0000-0000-000000000002/acuse-bomberos.pdf', 'application/pdf', 128000, 'a0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'solicitud', '20000000-0000-0000-0000-000000000003/solicitud.pdf', 'application/pdf', 198000, 'a0000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', 'acuse', '20000000-0000-0000-0000-000000000003/acuse-pc.pdf', 'application/pdf', 121000, 'a0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000004', 'acuse', '20000000-0000-0000-0000-000000000004/acuse-bomberos.pdf', 'application/pdf', 132000, 'a0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000009', 'acuse', '20000000-0000-0000-0000-000000000009/acuse-bomberos.pdf', 'application/pdf', 126000, 'a0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000010', 'acuse', '20000000-0000-0000-0000-000000000010/acuse-pc.pdf', 'application/pdf', 130000, 'a0000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

insert into public.historial_eventos (id, tramite_id, actor_id, actor_rol, accion, datos_antes, datos_despues) values
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'ciudadano', 'tramite_creado', null, '{"folio":"TT-2026-0001"}'),
  ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'secretaria', 'turnado_registrado', '{"estado":"pendiente"}', '{"estado":"turnado"}'),
  ('60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', 'bomberos', 'dictamen_registrado', '{"estado":"en_inspeccion"}', '{"estado":"observaciones","motivo":"Falta el croquis de salidas de emergencia."}'),
  ('60000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 'bomberos', 'dictamen_registrado', '{"estado":"en_inspeccion"}', '{"estado":"rechazado","motivo":"No hay extintor vigente en el local."}'),
  ('60000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', 'proteccion_civil', 'dictamen_registrado', '{"estado":"en_inspeccion"}', '{"estado":"aprobado"}')
on conflict (id) do nothing;

insert into public.notificaciones (
  id, tramite_id, destinatario, plantilla, asunto, estado, error_motivo, clave_idempotencia, intentos
) values
  ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'maria.ruiz@correo-ejemplo.mx', 'observaciones_ciudadano', 'Tu trámite TT-2026-0004 necesita un documento', 'enviado', null, 'demo-observaciones-0004-v1', 1),
  ('70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'bomberos.recordatorio@tonala-ejemplo.gob.mx', 'recordatorio_sla', 'Recordatorio: revisión del trámite TT-2026-0001', 'pendiente', null, 'demo-sla-0001-v1', 0)
on conflict (id) do nothing;

-- Verificación rápida esperada: 10 trámites, 14 renglones de dependencia.
-- select estado_general, count(*) from public.tramites group by 1 order by 1;
