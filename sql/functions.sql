-- Workflow and admin functions
create or replace function public.assert_role(allowed public.user_role[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  select role into v_role from public.profiles where id = auth.uid() and is_active;
  if v_role is null then
    raise exception 'Пользователь не активен или профиль не найден';
  end if;
  if not (v_role = any(allowed)) then
    raise exception 'Недостаточно прав';
  end if;
end;
$$;

create or replace function public.enforce_plan_item_edit_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_status public.plan_status;
  v_creator uuid;
begin
  select p.status, p.created_by into v_status, v_creator
  from public.plans p
  where p.id = new.plan_id;

  select role into v_role from public.profiles where id = auth.uid();

  if v_role = 'admin' then
    return new;
  end if;

  if v_role = 'chef' and v_status = 'draft' and v_creator = auth.uid() then
    if new.product_name is distinct from old.product_name
      or new.unit is distinct from old.unit
      or new.actual_qty is distinct from old.actual_qty
      or new.is_checked is distinct from old.is_checked
      or new.storekeeper_comment is distinct from old.storekeeper_comment then
      raise exception 'Chef может менять только planned_qty в draft';
    end if;
    return new;
  end if;

  if v_role = 'storekeeper' and v_status = 'submitted' then
    if new.product_name is distinct from old.product_name
      or new.unit is distinct from old.unit
      or new.planned_qty is distinct from old.planned_qty then
      raise exception 'Storekeeper может менять только факт/проверку/комментарий в submitted';
    end if;
    return new;
  end if;

  raise exception 'Изменение строки плана запрещено в текущем статусе';
end;
$$;

drop trigger if exists trg_plan_items_enforce_rules on public.plan_items;
create trigger trg_plan_items_enforce_rules
before update on public.plan_items
for each row execute function public.enforce_plan_item_edit_rules();

create or replace function public.submit_plan(p_plan_id bigint)
returns public.plans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.plans;
  v_deadline timestamptz;
begin
  perform public.assert_role(array['chef','admin']::public.user_role[]);

  select * into v_plan from public.plans where id = p_plan_id for update;
  if not found then
    raise exception 'План не найден';
  end if;

  if v_plan.status <> 'draft' then
    raise exception 'Отправка возможна только из draft';
  end if;

  if public.current_role() = 'chef' and v_plan.created_by <> auth.uid() then
    raise exception 'Chef может отправлять только свои планы';
  end if;

  if public.current_role() = 'chef' and not public.can_access_kitchen(v_plan.kitchen_id) then
    raise exception 'Нет доступа к кухне';
  end if;

  v_deadline := ((v_plan.plan_date::text || ' 23:59:59 Asia/Almaty')::timestamptz);
  if public.current_role() = 'chef' and now() > v_deadline then
    raise exception 'Срок отправки истёк (после 23:59 Asia/Almaty)';
  end if;

  update public.plans
  set status = 'submitted',
      submitted_at = now()
  where id = p_plan_id
  returning * into v_plan;

  return v_plan;
end;
$$;

create or replace function public.close_check(p_plan_id bigint)
returns public.plans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.plans;
begin
  perform public.assert_role(array['storekeeper','admin']::public.user_role[]);

  select * into v_plan from public.plans where id = p_plan_id for update;
  if not found then
    raise exception 'План не найден';
  end if;

  if v_plan.status <> 'submitted' then
    raise exception 'Проверку можно завершить только в submitted';
  end if;

  update public.plans
  set status = 'checked',
      checked_by = auth.uid(),
      checked_at = now()
  where id = p_plan_id
  returning * into v_plan;

  return v_plan;
end;
$$;

create or replace function public.finalize_plan(p_plan_id bigint)
returns public.plans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.plans;
begin
  perform public.assert_role(array['chef','admin']::public.user_role[]);

  select * into v_plan from public.plans where id = p_plan_id for update;
  if not found then
    raise exception 'План не найден';
  end if;

  if v_plan.status <> 'checked' then
    raise exception 'Закрытие возможно только для checked';
  end if;

  if public.current_role() = 'chef' and v_plan.created_by <> auth.uid() then
    raise exception 'Chef может закрыть только свой план';
  end if;

  update public.plans
  set status = 'finalized',
      finalized_by = auth.uid(),
      finalized_at = now()
  where id = p_plan_id
  returning * into v_plan;

  return v_plan;
end;
$$;

create or replace function public.admin_fix_plan_item(
  p_plan_item_id bigint,
  p_actual_qty numeric,
  p_is_checked boolean,
  p_storekeeper_comment text,
  p_reason text
)
returns public.plan_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.plan_items;
  v_old public.plan_items;
begin
  perform public.assert_role(array['admin']::public.user_role[]);

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Причина обязательна';
  end if;

  select pi.* into v_old from public.plan_items pi where pi.id = p_plan_item_id for update;
  if not found then
    raise exception 'Строка не найдена';
  end if;

  update public.plan_items
  set actual_qty = p_actual_qty,
      is_checked = coalesce(p_is_checked, is_checked),
      storekeeper_comment = p_storekeeper_comment
  where id = p_plan_item_id
  returning * into v_item;

  if v_old.actual_qty is distinct from v_item.actual_qty then
    insert into public.plan_item_audit(plan_item_id, changed_by, field_name, old_value, new_value, reason, source)
    values (v_item.id, auth.uid(), 'actual_qty', v_old.actual_qty::text, v_item.actual_qty::text, p_reason, 'admin_fix');
  end if;
  if v_old.is_checked is distinct from v_item.is_checked then
    insert into public.plan_item_audit(plan_item_id, changed_by, field_name, old_value, new_value, reason, source)
    values (v_item.id, auth.uid(), 'is_checked', v_old.is_checked::text, v_item.is_checked::text, p_reason, 'admin_fix');
  end if;
  if v_old.storekeeper_comment is distinct from v_item.storekeeper_comment then
    insert into public.plan_item_audit(plan_item_id, changed_by, field_name, old_value, new_value, reason, source)
    values (v_item.id, auth.uid(), 'storekeeper_comment', v_old.storekeeper_comment, v_item.storekeeper_comment, p_reason, 'admin_fix');
  end if;

  return v_item;
end;
$$;

create or replace function public.admin_return_plan_to_check(
  p_plan_id bigint,
  p_reason text,
  p_reset_checks boolean default false
)
returns public.plans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.plans;
begin
  perform public.assert_role(array['admin']::public.user_role[]);

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Причина обязательна';
  end if;

  select * into v_plan from public.plans where id = p_plan_id for update;
  if not found then
    raise exception 'План не найден';
  end if;

  if v_plan.status not in ('checked', 'finalized') then
    raise exception 'Возврат на проверку возможен только из checked/finalized';
  end if;

  update public.plans
  set status = 'submitted',
      checked_by = case when p_reset_checks then null else checked_by end,
      checked_at = case when p_reset_checks then null else checked_at end,
      finalized_by = null,
      finalized_at = null
  where id = p_plan_id
  returning * into v_plan;

  if p_reset_checks then
    with changed_items as (
      update public.plan_items
      set is_checked = false
      where plan_id = p_plan_id and is_checked = true
      returning id
    )
    insert into public.plan_item_audit(plan_item_id, changed_by, field_name, old_value, new_value, reason, source)
    select id, auth.uid(), 'is_checked', 'true', 'false', p_reason, 'admin_return_to_check'
    from changed_items;
  end if;

  return v_plan;
end;
$$;
