-- ============================================================================
-- SIGET-Tonalá · Fase 2 · RPCs transaccionales
-- Ejecutar DESPUÉS de supabase/schema.sql. Cada operación que toca varias
-- tablos lo hace en una sola transacción y valida permisos con auth.uid(),
-- no con un parámetro enviado por el navegador.
-- ============================================================================

create sequence if not exists public.oficio_folio_seq start 1;

-- ---------------------------------------------------------------------------
-- Horas entre dos fechas. Naturales = 24/7. Hábiles = lunes a viernes 9-17 h
-- en hora de Jalisco (America/Tijuana). No inventa días festivos.
-- ---------------------------------------------------------------------------
create or replace function public.horas_entre(
  p_ini timestamptz,
  p_fin timestamptz,
  p_tipo public.tipo_horas
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_total numeric := 0;
  v_dia date;
  v_apertura timestamptz;
  v_cierre timestamptz;
  v_desde timestamptz;
  v_hasta timestamptz;
begin
  if p_fin is null or p_ini is null or p_fin <= p_ini then
    return 0;
  end if;

  if p_tipo = 'naturales' then
    return extract(epoch from (p_fin - p_ini)) / 3600;
  end if;

  v_dia := (p_ini at time zone 'America/Tijuana')::date;
  while v_dia <= (p_fin at time zone 'America/Tijuana')::date loop
    if extract(isodow from v_dia) between 1 and 5 then
      v_apertura := (v_dia + time '09:00') at time zone 'America/Tijuana';
      v_cierre := (v_dia + time '17:00') at time zone 'America/Tijuana';
      v_desde := greatest(p_ini, v_apertura);
      v_hasta := least(p_fin, v_cierre);
      if v_hasta > v_desde then
        v_total := v_total + extract(epoch from (v_hasta - v_desde)) / 3600;
      end if;
    end if;
    v_dia := v_dia + 1;
  end loop;

  return v_total;
end;
$$;

-- Horas efectivas del reloj de dictamen, descontando pausas del ciudadano.
create or replace function public.horas_para_sla(p_td public.tramite_dependencias)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_fin timestamptz := coalesce(p_td.dictamen_at, now());
  v_tipo public.tipo_horas;
  v_pausas numeric := coalesce(p_td.horas_pausadas, 0);
begin
  select tipo_horas into v_tipo
  from public.configuracion_sla
  where dependencia_id = p_td.dependencia_id;
  v_tipo := coalesce(v_tipo, 'naturales');

  if p_td.pausado_desde is not null then
    v_pausas := v_pausas + public.horas_entre(p_td.pausado_desde, v_fin, v_tipo);
  end if;

  return greatest(
    0,
    public.horas_entre(coalesce(p_td.turnado_at, v_fin), v_fin, v_tipo) - v_pausas
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Turnar: ventanilla crea el oficio y marca el turno en la misma transacción.
-- ---------------------------------------------------------------------------
create or replace function public.turnar_dependencia(p_td_id uuid)
returns public.tramite_dependencias
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := public.mi_rol()::text;
  v_td public.tramite_dependencias;
  v_oficio_id uuid;
  v_numero text;
begin
  if v_rol is distinct from 'secretaria' then
    raise exception 'Solo la ventanilla puede turnar un oficio';
  end if;

  select * into v_td from public.tramite_dependencias where id = p_td_id for update;
  if not found then
    raise exception 'No encontramos esa revisión';
  end if;
  if v_td.estado <> 'pendiente' then
    raise exception 'Esta revisión ya fue turnada o está en revisión';
  end if;

  v_numero := 'OF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.oficio_folio_seq')::text, 4, '0');
  insert into public.oficios_turnados (
    numero_oficio, fecha_emision, dependencia_destino, created_by
  ) values (
    v_numero, now(), v_td.dependencia_id, auth.uid()
  ) returning id into v_oficio_id;

  update public.tramite_dependencias
  set estado = 'turnado', turnado_at = now(), oficio_id = v_oficio_id
  where id = p_td_id
  returning * into v_td;

  insert into public.historial_eventos (tramite_id, actor_id, actor_rol, accion, datos_antes, datos_despues)
  values (
    v_td.tramite_id, auth.uid(), 'secretaria', 'turnado_registrado',
    '{"estado":"pendiente"}', json_build_object('estado', 'turnado', 'numero_oficio', v_numero)::text
  );

  return v_td;
end;
$$;

-- ---------------------------------------------------------------------------
-- Turno múltiple: un mismo oficio consecutivo para todas las dependencias
-- seleccionadas de un mismo trámite. La ventanilla lo ejecuta en una transacción.
-- ---------------------------------------------------------------------------
create or replace function public.turnar_oficio(p_td_ids uuid[])
returns setof public.tramite_dependencias
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := public.mi_rol()::text;
  v_td public.tramite_dependencias;
  v_tramite_id uuid;
  v_numero text;
  v_oficio_id uuid;
begin
  if v_rol is distinct from 'secretaria' then
    raise exception 'Solo la ventanilla puede turnar un oficio';
  end if;
  if coalesce(array_length(p_td_ids, 1), 0) = 0 then
    raise exception 'Selecciona al menos una dependencia para turnar';
  end if;

  select tramite_id into v_tramite_id
  from public.tramite_dependencias where id = p_td_ids[1] for update;
  if not found then
    raise exception 'No encontramos esa revisión';
  end if;
  if exists (
    select 1 from public.tramite_dependencias
    where id = any(p_td_ids) and tramite_id is distinct from v_tramite_id
  ) then
    raise exception 'Todas las revisiones deben ser del mismo trámite';
  end if;

  v_numero := 'DPL/VF/' || lpad(nextval('public.oficio_folio_seq')::text, 4, '0') || '/2026';

  for v_td in
    select * from public.tramite_dependencias
    where id = any(p_td_ids) for update
  loop
    if v_td.estado <> 'pendiente' then
      raise exception 'Una de las revisiones ya fue turnada o está en revisión';
    end if;

    insert into public.oficios_turnados (
      numero_oficio, fecha_emision, dependencia_destino, created_by
    ) values (
      v_numero, now(), v_td.dependencia_id, auth.uid()
    ) returning id into v_oficio_id;

    update public.tramite_dependencias
    set estado = 'turnado', turnado_at = now(), oficio_id = v_oficio_id
    where id = v_td.id
    returning * into v_td;

    insert into public.historial_eventos (tramite_id, actor_id, actor_rol, accion, datos_antes, datos_despues)
    values (
      v_td.tramite_id, auth.uid(), 'secretaria', 'turnado_registrado',
      '{"estado":"pendiente"}', json_build_object('estado', 'turnado', 'numero_oficio', v_numero)::text
    );
  end loop;

  return next v_td;
end;
$$;

-- ---------------------------------------------------------------------------
-- Acuse sellado: solo ventanilla; exige que ya exista el oficio.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_acuse(
  p_td_id uuid,
  p_sello_folio text,
  p_sello_fecha date default null,
  p_sello_hora time default null,
  p_documento_id uuid default null
)
returns public.tramite_dependencias
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := public.mi_rol()::text;
  v_td public.tramite_dependencias;
begin
  if v_rol is distinct from 'secretaria' then
    raise exception 'Solo la ventanilla puede registrar el acuse';
  end if;
  if nullif(btrim(coalesce(p_sello_folio, '')), '') is null then
    raise exception 'Escribe el folio del sello';
  end if;

  select * into v_td from public.tramite_dependencias where id = p_td_id for update;
  if not found then
    raise exception 'No encontramos esa revisión';
  end if;
  if v_td.estado <> 'turnado' or v_td.oficio_id is null then
    raise exception 'Primero se debe turnar el oficio y después registrar el acuse';
  end if;
  if p_documento_id is not null and not exists (
    select 1 from public.documentos d
    where d.id = p_documento_id and d.tramite_id = v_td.tramite_id
  ) then
    raise exception 'El documento de acuse no pertenece a este trámite';
  end if;

  update public.oficios_turnados
  set sello_folio = btrim(p_sello_folio),
      sello_fecha = coalesce(p_sello_fecha, now()::date),
      sello_hora = coalesce(p_sello_hora, now()::time),
      acuse_documento_id = p_documento_id
  where id = v_td.oficio_id;

  update public.tramite_dependencias
  set acuse_at = coalesce(v_td.acuse_at, now())
  where id = p_td_id
  returning * into v_td;

  insert into public.historial_eventos (tramite_id, actor_id, actor_rol, accion, datos_antes, datos_despues)
  values (
    v_td.tramite_id, auth.uid(), 'secretaria', 'acuse_registrado', null,
    json_build_object('sello_folio', btrim(p_sello_folio), 'documento_id', p_documento_id)::text
  );

  return v_td;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recepción: la dependencia asignada confirma que recibió el oficio y empieza
-- la inspección. Si había pausa abierta, la cierra y la acumula.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_recepcion(p_td_id uuid)
returns public.tramite_dependencias
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := public.mi_rol()::text;
  v_dep uuid := public.mi_dependencia_id();
  v_td public.tramite_dependencias;
  v_tipo public.tipo_horas;
  v_pausas numeric;
begin
  if v_rol not in ('bomberos', 'proteccion_civil') then
    raise exception 'Solo la dependencia asignada puede registrar la recepción';
  end if;

  select * into v_td from public.tramite_dependencias where id = p_td_id for update;
  if not found then
    raise exception 'No encontramos esa revisión';
  end if;
  if v_td.dependencia_id is distinct from v_dep then
    raise exception 'Esta revisión no corresponde a tu dependencia';
  end if;
  if v_td.estado <> 'turnado' then
    raise exception 'La revisión debe estar turnada para registrar la recepción';
  end if;

  select tipo_horas into v_tipo from public.configuracion_sla where dependencia_id = v_dep;
  v_tipo := coalesce(v_tipo, 'naturales');
  v_pausas := coalesce(v_td.horas_pausadas, 0);
  if v_td.pausado_desde is not null then
    v_pausas := v_pausas + public.horas_entre(v_td.pausado_desde, now(), v_tipo);
  end if;

  update public.tramite_dependencias
  set estado = 'en_inspeccion',
      pausado_desde = null,
      horas_pausadas = v_pausas
  where id = p_td_id
  returning * into v_td;

  insert into public.historial_eventos (tramite_id, actor_id, actor_rol, accion, datos_antes, datos_despues)
  values (
    v_td.tramite_id, auth.uid(), v_rol::public.rol_usuario, 'recepcion_registrada',
    '{"estado":"turnado"}', '{"estado":"en_inspeccion"}'
  );

  return v_td;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dictamen: aprobado/rechazado cierran el reloj; observaciones lo pausan a la
-- espera de evidencia del ciudadano. Motivo obligatorio si no es aprobado.
-- ---------------------------------------------------------------------------
create or replace function public.dictaminar_dependencia(
  p_td_id uuid,
  p_dictamen text,
  p_motivo text default null,
  p_fecha_visita date default null
)
returns public.tramite_dependencias
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := public.mi_rol()::text;
  v_dep uuid := public.mi_dependencia_id();
  v_td public.tramite_dependencias;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if v_rol not in ('bomberos', 'proteccion_civil') then
    raise exception 'Solo la dependencia asignada puede dictaminar';
  end if;
  if p_dictamen not in ('aprobado', 'rechazado', 'observaciones') then
    raise exception 'Dictamen no válido';
  end if;
  if p_dictamen <> 'aprobado' and v_motivo is null then
    raise exception 'Escribe el motivo para que la persona contribuyente entienda qué hacer';
  end if;
  if v_rol = 'proteccion_civil' and p_fecha_visita is null then
    raise exception 'Registra la fecha de tu visita antes de emitir el dictamen';
  end if;

  select * into v_td from public.tramite_dependencias where id = p_td_id for update;
  if not found then
    raise exception 'No encontramos esa revisión';
  end if;
  if v_td.dependencia_id is distinct from v_dep then
    raise exception 'Esta revisión no corresponde a tu dependencia';
  end if;
  if v_td.estado <> 'en_inspeccion' then
    raise exception 'Solo se puede dictaminar durante la inspección';
  end if;

  if p_dictamen = 'observaciones' then
    update public.tramite_dependencias
    set estado = 'observaciones', dictamen = p_dictamen, motivo = v_motivo,
        dictamen_at = null, pausado_desde = coalesce(pausado_desde, now()),
        fecha_visita = coalesce(p_fecha_visita, fecha_visita)
    where id = p_td_id
    returning * into v_td;
  else
    update public.tramite_dependencias
    set estado = p_dictamen::public.estado_dependencia,
        dictamen = p_dictamen,
        motivo = case when p_dictamen = 'aprobado' then null else v_motivo end,
        dictamen_at = now(),
        pausado_desde = null,
        fecha_visita = coalesce(p_fecha_visita, fecha_visita)
    where id = p_td_id
    returning * into v_td;
  end if;

  insert into public.historial_eventos (tramite_id, actor_id, actor_rol, accion, datos_antes, datos_despues)
  values (
    v_td.tramite_id, auth.uid(), v_rol::public.rol_usuario, 'dictamen_registrado',
    '{"estado":"en_inspeccion"}',
    json_build_object(
      'estado', v_td.estado,
      'motivo', v_td.motivo,
      'fecha_visita', v_td.fecha_visita
    )::text
  );

  return v_td;
end;
$$;

-- ---------------------------------------------------------------------------
-- Evidencia: la persona dueña del trámite sube el archivo y se reanuda el
-- reloj, todo en una transacción. Valida MIME y tamaño también en servidor.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_evidencia(
  p_td_id uuid,
  p_tipo public.tipo_documento,
  p_storage_path text,
  p_mime text,
  p_size_bytes bigint,
  p_nombre_archivo text default null
)
returns public.documentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_td public.tramite_dependencias;
  v_documento public.documentos;
  v_tipo public.tipo_horas;
  v_pausas numeric;
begin
  select * into v_td from public.tramite_dependencias where id = p_td_id for update;
  if not found then
    raise exception 'No encontramos esa revisión';
  end if;
  if public.mi_rol() is distinct from 'ciudadano'
     or not exists (
       select 1 from public.tramites t
       where t.id = v_td.tramite_id and t.ciudadano_id = auth.uid()
     ) then
    raise exception 'Solo la persona dueña del trámite puede entregar evidencia';
  end if;
  if v_td.estado <> 'observaciones' then
    raise exception 'La evidencia solo se puede entregar cuando hay observaciones';
  end if;
  if p_mime not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'El archivo debe ser PDF, JPG o PNG';
  end if;
  if p_size_bytes <= 0 or p_size_bytes > 5242880 then
    raise exception 'El archivo debe pesar menos de 5 MB y no estar vacío';
  end if;
  if nullif(btrim(coalesce(p_storage_path, '')), '') is null then
    raise exception 'Falta la ruta del archivo';
  end if;

  select tipo_horas into v_tipo from public.configuracion_sla where dependencia_id = v_td.dependencia_id;
  v_tipo := coalesce(v_tipo, 'naturales');
  v_pausas := coalesce(v_td.horas_pausadas, 0);
  if v_td.pausado_desde is not null then
    v_pausas := v_pausas + public.horas_entre(v_td.pausado_desde, now(), v_tipo);
  end if;

  insert into public.documentos (tramite_id, tipo, storage_path, mime, size_bytes, created_by)
  values (v_td.tramite_id, p_tipo, btrim(p_storage_path), p_mime, p_size_bytes, auth.uid())
  returning * into v_documento;

  update public.tramite_dependencias
  set estado = 'en_inspeccion', motivo = null,
      pausado_desde = null, horas_pausadas = v_pausas
  where id = p_td_id;

  insert into public.historial_eventos (tramite_id, actor_id, actor_rol, accion, datos_antes, datos_despues)
  values (
    v_td.tramite_id, auth.uid(), 'ciudadano', 'evidencia_entregada',
    json_build_object('estado', v_td.estado, 'pausado_desde', v_td.pausado_desde)::text,
    json_build_object(
      'estado', 'en_inspeccion', 'documento_id', v_documento.id,
      'nombre', coalesce(p_nombre_archivo, p_storage_path)
    )::text
  );

  return v_documento;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos. Las funciones son SECURITY DEFINER, pero sólo authenticated
-- puede invocarlas; dentro validan rol y pertenencia con auth.uid().
-- ---------------------------------------------------------------------------
grant execute on function public.horas_entre(timestamptz, timestamptz, public.tipo_horas) to authenticated;
grant execute on function public.horas_para_sla(public.tramite_dependencias) to authenticated;
grant execute on function public.turnar_dependencia(uuid) to authenticated;
grant execute on function public.turnar_oficio(uuid[]) to authenticated;
grant execute on function public.registrar_acuse(uuid, text, date, time, uuid) to authenticated;
grant execute on function public.registrar_recepcion(uuid) to authenticated;
grant execute on function public.dictaminar_dependencia(uuid, text, text, date) to authenticated;
grant execute on function public.registrar_evidencia(uuid, public.tipo_documento, text, text, bigint, text) to authenticated;

-- ============================================================================
-- Fase 5 · Acuses leídos por OCR (Parser B y Parser C).
-- Sólo ventanilla. El cambio a en_inspeccion se permite al trigger de
-- schema.sql únicamente mientras el flag de transacción está encendido.
-- Ninguna de estas funciones confía en un rol enviado por el navegador.
-- ============================================================================

create or replace function public.registrar_acuse_oficio_ocr(
  p_numero_oficio text,
  p_sello_folio text,
  p_sello_fecha date default null,
  p_sello_hora time default null,
  p_documento jsonb default null
)
returns setof public.tramite_dependencias
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := public.mi_rol()::text;
  v_oficio public.oficios_turnados;
  v_td public.tramite_dependencias;
  v_documento_id uuid;
  v_fecha date := coalesce(p_sello_fecha, now()::date);
  v_hora time := coalesce(p_sello_hora, now()::time);
begin
  if v_rol is distinct from 'secretaria' then
    raise exception 'Solo la ventanilla puede confirmar acuses leídos por OCR';
  end if;
  if nullif(btrim(coalesce(p_sello_folio, '')), '') is null then
    raise exception 'Confirma el folio manuscrito del sello';
  end if;

  select * into v_oficio
  from public.oficios_turnados
  where numero_oficio = btrim(coalesce(p_numero_oficio, ''))
  for update;
  if not found then
    raise exception 'No encontramos ese oficio en la bandeja';
  end if;

  -- Reprocesar el mismo sello no duplica eventos ni documentos.
  if exists (
    select 1 from public.tramite_dependencias
    where oficio_id = v_oficio.id and acuse_at is not null
  ) then
    return query
      select * from public.tramite_dependencias where oficio_id = v_oficio.id;
    return;
  end if;

  update public.oficios_turnados
  set sello_folio = btrim(p_sello_folio),
      sello_fecha = v_fecha,
      sello_hora = v_hora
  where id = v_oficio.id;

  perform set_config('siget.acuse_ocr_confirmado', 'on', true);

  for v_td in
    select * from public.tramite_dependencias where oficio_id = v_oficio.id for update
  loop
    if v_td.estado <> 'turnado' then
      raise exception 'Primero se debe turnar el oficio y después confirmar el acuse';
    end if;

    v_documento_id := null;
    if p_documento is not null and nullif(p_documento ->> 'storage_path', '') is not null then
      insert into public.documentos (
        tramite_id, tipo, storage_path, mime, size_bytes, created_by
      ) values (
        v_td.tramite_id, 'acuse', p_documento ->> 'storage_path',
        coalesce(p_documento ->> 'mime', 'image/jpeg'),
        coalesce((p_documento ->> 'size_bytes')::bigint, 0), auth.uid()
      ) returning id into v_documento_id;

      update public.oficios_turnados
      set acuse_documento_id = coalesce(acuse_documento_id, v_documento_id)
      where id = v_oficio.id;
    end if;

    update public.tramite_dependencias
    set acuse_at = coalesce(acuse_at, now()), estado = 'en_inspeccion'
    where id = v_td.id
    returning * into v_td;

    insert into public.historial_eventos (
      tramite_id, actor_id, actor_rol, accion, datos_antes, datos_despues
    ) values (
      v_td.tramite_id, auth.uid(), 'secretaria', 'acuse_ocr_registrado',
      '{"estado":"turnado"}',
      json_build_object(
        'numero_oficio', v_oficio.numero_oficio,
        'sello_folio', btrim(p_sello_folio),
        'sello_fecha', v_fecha,
        'sello_hora', v_hora,
        'documento_id', v_documento_id
      )::text
    );

    insert into public.historial_eventos (
      tramite_id, actor_id, actor_rol, accion, datos_antes, datos_despues
    ) values (
      v_td.tramite_id, auth.uid(), 'secretaria', 'recepcion_por_acuse_ocr',
      '{"estado":"turnado"}',
      json_build_object('estado', 'en_inspeccion', 'numero_oficio', v_oficio.numero_oficio)::text
    );

    perform public.registrar_notificacion(
      v_td.tramite_id,
      'ventanilla@tonala-ejemplo.gob.mx',
      'acuse_ocr',
      'Acuse recibido: ' || v_oficio.numero_oficio,
      'acuse-ocr-individual-' || v_oficio.numero_oficio || '-' || btrim(p_sello_folio) || '-' || v_td.tramite_id::text
    );

    return next v_td;
  end loop;

  perform set_config('siget.acuse_ocr_confirmado', 'off', true);
end;
$$;

create or replace function public.registrar_acuse_lote_ocr(
  p_numero_oficio text,
  p_acuse_folio text,
  p_acuse_fecha date default null,
  p_acuse_hora time default null,
  p_solicitudes jsonb default '[]'::jsonb,
  p_documento jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := public.mi_rol()::text;
  v_oficio public.oficios_turnados;
  v_tramite public.tramites;
  v_fila record;
  v_iteraciones integer := 0;
  v_sol jsonb;
  v_giro text;
  v_giros text[];
  v_control text;
  v_folio text;
  v_clave text;
  v_previo jsonb;
  v_faltantes jsonb := '[]'::jsonb;
  v_actualizados integer := 0;
  v_notificaciones integer := 0;
  v_primer_tramite uuid;
  v_documento_id uuid;
  v_fecha date := coalesce(p_acuse_fecha, now()::date);
  v_hora time := coalesce(p_acuse_hora, now()::time);
begin
  if v_rol is distinct from 'secretaria' then
    raise exception 'Solo la ventanilla puede confirmar acuses leídos por OCR';
  end if;
  if nullif(btrim(coalesce(p_acuse_folio, '')), '') is null then
    raise exception 'Confirma el folio del acuse';
  end if;

  select * into v_oficio
  from public.oficios_turnados
  where numero_oficio = btrim(coalesce(p_numero_oficio, ''))
  for update;
  if not found then
    raise exception 'No encontramos ese oficio en la bandeja';
  end if;

  v_clave := 'acuse-lote-' || v_oficio.numero_oficio || '-' || btrim(p_acuse_folio);
  select datos_despues::jsonb into v_previo
  from public.historial_eventos
  where accion = 'acuse_lote_ocr_registrado' and datos_despues like '%' || v_clave || '%'
  limit 1;
  if v_previo is not null then
    return jsonb_build_object(
      'numero_oficio', v_oficio.numero_oficio,
      'tramites_actualizados', 0,
      'folios_no_encontrados', coalesce(v_previo -> 'folios_no_encontrados', '[]'::jsonb),
      'notificaciones', coalesce((v_previo ->> 'notificaciones')::integer, 0),
      'reprocessado', true,
      'aviso', 'Este oficio ya se procesó. No se duplicaron eventos ni notificaciones.'
    );
  end if;

  update public.oficios_turnados
  set sello_folio = btrim(p_acuse_folio), sello_fecha = v_fecha, sello_hora = v_hora
  where id = v_oficio.id;

  perform set_config('siget.acuse_ocr_confirmado', 'on', true);

  for v_sol in select value from jsonb_array_elements(coalesce(p_solicitudes, '[]'::jsonb)) as t(value) loop
    v_control := nullif(btrim(coalesce(v_sol ->> 'numero_control', '')), '');
    v_folio := nullif(btrim(coalesce(v_sol ->> 'folio', '')), '');

    select * into v_tramite
    from public.tramites
    where (v_control is not null and numero_control = v_control)
       or (v_folio is not null and folio = v_folio)
    limit 1;
    if not found then
      v_faltantes := v_faltantes || to_jsonb(coalesce(v_folio, v_control, 'folio desconocido'));
      continue;
    end if;
    v_primer_tramite := coalesce(v_primer_tramite, v_tramite.id);

    -- Igual que en DEMO: un acuse multidependencia cierra TODAS las revisiones
    -- turnadas del expediente, no sólo la fila que coincide con este oficio.
    if not exists (
      select 1 from public.tramite_dependencias
      where tramite_id = v_tramite.id and estado = 'turnado'
    ) then
      v_faltantes := v_faltantes || to_jsonb(coalesce(v_folio, v_control, 'folio desconocido'));
      continue;
    end if;

    v_documento_id := null;
    if p_documento is not null and nullif(p_documento ->> 'storage_path', '') is not null then
      insert into public.documentos (
        tramite_id, tipo, storage_path, mime, size_bytes, created_by
      ) values (
        v_tramite.id, 'acuse', p_documento ->> 'storage_path',
        coalesce(p_documento ->> 'mime', 'image/jpeg'),
        coalesce((p_documento ->> 'size_bytes')::bigint, 0), auth.uid()
      ) returning id into v_documento_id;

      update public.oficios_turnados
      set acuse_documento_id = coalesce(acuse_documento_id, v_documento_id)
      where id = v_oficio.id;
    end if;

    v_giros := coalesce(v_tramite.giros_anexos, array[]::text[]);
    for v_giro in
      select jsonb_array_elements_text(coalesce(v_sol -> 'giros', '[]'::jsonb))
    loop
      if btrim(v_giro) <> '' and not (btrim(v_giro) = any(v_giros)) then
        v_giros := v_giros || btrim(v_giro);
      end if;
    end loop;
    if v_giros is distinct from v_tramite.giros_anexos then
      update public.tramites set giros_anexos = v_giros, updated_at = now()
      where id = v_tramite.id;
      insert into public.historial_eventos (
        tramite_id, actor_id, actor_rol, accion, datos_antes, datos_despues
      ) values (
        v_tramite.id, auth.uid(), 'secretaria', 'giros_actualizados_por_ocr',
        to_jsonb(v_tramite.giros_anexos)::text, to_jsonb(v_giros)::text
      );
    end if;

    v_iteraciones := 0;
    for v_fila in
      select *
      from public.tramite_dependencias
      where tramite_id = v_tramite.id and estado = 'turnado'
      for update
    loop
      v_iteraciones := v_iteraciones + 1;

      update public.tramite_dependencias
      set acuse_at = coalesce(acuse_at, now()), estado = 'en_inspeccion'
      where id = v_fila.id;

      insert into public.historial_eventos (
        tramite_id, actor_id, actor_rol, accion, datos_antes, datos_despues
      ) values (
        v_tramite.id, auth.uid(), 'secretaria', 'acuse_ocr_registrado',
        '{"estado":"turnado"}',
        json_build_object(
          'numero_oficio', v_oficio.numero_oficio,
          'sello_folio', btrim(p_acuse_folio),
          'documento_id', v_documento_id
        )::text
      );
      insert into public.historial_eventos (
        tramite_id, actor_id, actor_rol, accion, datos_antes, datos_despues
      ) values (
        v_tramite.id, auth.uid(), 'secretaria', 'recepcion_por_acuse_ocr',
        '{"estado":"turnado"}',
        json_build_object('estado', 'en_inspeccion', 'numero_oficio', v_oficio.numero_oficio)::text
      );
    end loop;

    perform public.registrar_notificacion(
      v_tramite.id,
      coalesce((select email from public.profiles where id = v_tramite.ciudadano_id), 'ventanilla@tonala-ejemplo.gob.mx'),
      'acuse_ocr',
      'Ya recibimos los documentos de ' || v_tramite.folio,
      v_clave || '-' || v_tramite.id::text
    );
    v_notificaciones := v_notificaciones + 1;
    v_actualizados := v_actualizados + v_iteraciones;
  end loop;

  v_primer_tramite := coalesce(
    v_primer_tramite,
    (select tramite_id from public.tramite_dependencias where oficio_id = v_oficio.id limit 1)
  );
  if v_primer_tramite is null then
    raise exception 'Ese oficio no tiene expedientes asociados';
  end if;

  insert into public.historial_eventos (
    tramite_id, actor_id, actor_rol, accion, datos_antes, datos_despues
  ) values (
    v_primer_tramite, auth.uid(), 'secretaria', 'acuse_lote_ocr_registrado', null,
    json_build_object(
      'claveIdempotencia', v_clave,
      'numero_oficio', v_oficio.numero_oficio,
      'acuse_folio', btrim(p_acuse_folio),
      'tramitesActualizados', v_actualizados,
      'foliosNoEncontrados', v_faltantes,
      'notificaciones', v_notificaciones
    )::text
  );

  perform set_config('siget.acuse_ocr_confirmado', 'off', true);

  return jsonb_build_object(
    'numero_oficio', v_oficio.numero_oficio,
    'tramites_actualizados', v_actualizados,
    'folios_no_encontrados', v_faltantes,
    'notificaciones', v_notificaciones,
    'reprocessado', false,
    'aviso', format(
      'Se actualizaron %s expediente(s) y %s folio(s) no se encontraron',
      v_actualizados, jsonb_array_length(v_faltantes)
    )
  );
end;
$$;

grant execute on function public.registrar_acuse_oficio_ocr(text, text, date, time, jsonb) to authenticated;
grant execute on function public.registrar_acuse_lote_ocr(text, text, date, time, jsonb, jsonb) to authenticated;

-- El trigger de schema.sql ya prohíbe UPDATE/DELETE en historial_eventos.
-- Verificación rápida:
-- select proname from pg_proc where pronamespace = 'public'::regnamespace order by proname;
