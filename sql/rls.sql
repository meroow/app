-- RLS policies for R-Control
alter table public.profiles enable row level security;
alter table public.kitchens enable row level security;
alter table public.user_kitchens enable row level security;
alter table public.kitchen_staff enable row level security;
alter table public.plans enable row level security;
alter table public.plan_items enable row level security;
alter table public.plan_item_audit enable row level security;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.can_access_kitchen(target_kitchen_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_role() in ('admin', 'storekeeper', 'viewer') then true
    when public.current_role() = 'chef' then exists (
      select 1 from public.user_kitchens uk
      where uk.user_id = auth.uid() and uk.kitchen_id = target_kitchen_id
    )
    else false
  end;
$$;

-- profiles
create policy "profiles_select_self_or_admin" on public.profiles
for select using (id = auth.uid() or public.current_role() = 'admin');

create policy "profiles_update_self_or_admin" on public.profiles
for update using (id = auth.uid() or public.current_role() = 'admin')
with check (id = auth.uid() or public.current_role() = 'admin');

create policy "profiles_admin_insert" on public.profiles
for insert with check (public.current_role() = 'admin');

-- kitchens
create policy "kitchens_select_by_role" on public.kitchens
for select using (public.can_access_kitchen(id));

create policy "kitchens_admin_write" on public.kitchens
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

-- user_kitchens
create policy "user_kitchens_select_self_or_admin" on public.user_kitchens
for select using (user_id = auth.uid() or public.current_role() = 'admin');

create policy "user_kitchens_admin_write" on public.user_kitchens
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

-- kitchen_staff
create policy "kitchen_staff_select_by_kitchen_access" on public.kitchen_staff
for select using (public.can_access_kitchen(kitchen_id));

create policy "kitchen_staff_admin_write" on public.kitchen_staff
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

-- plans
create policy "plans_select_by_role" on public.plans
for select using (public.can_access_kitchen(kitchen_id));

create policy "plans_insert_chef_or_admin" on public.plans
for insert with check (
  (
    public.current_role() = 'chef'
    and public.can_access_kitchen(kitchen_id)
    and created_by = auth.uid()
    and status = 'draft'
  )
  or public.current_role() = 'admin'
);

create policy "plans_update_draft_chef_or_admin" on public.plans
for update using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'chef'
    and created_by = auth.uid()
    and public.can_access_kitchen(kitchen_id)
    and status = 'draft'
  )
)
with check (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'chef'
    and created_by = auth.uid()
    and public.can_access_kitchen(kitchen_id)
  )
);

-- plan_items
create policy "plan_items_select_by_plan_access" on public.plan_items
for select using (
  exists (
    select 1 from public.plans p
    where p.id = plan_id and public.can_access_kitchen(p.kitchen_id)
  )
);

create policy "plan_items_insert_chef_draft_or_admin" on public.plan_items
for insert with check (
  public.current_role() = 'admin'
  or exists (
    select 1 from public.plans p
    where p.id = plan_id
      and p.status = 'draft'
      and p.created_by = auth.uid()
      and public.current_role() = 'chef'
      and public.can_access_kitchen(p.kitchen_id)
  )
);

create policy "plan_items_update_allowed_roles" on public.plan_items
for update using (
  public.current_role() = 'admin'
  or exists (
    select 1 from public.plans p
    where p.id = plan_id
      and public.can_access_kitchen(p.kitchen_id)
      and (
        (public.current_role() = 'chef' and p.created_by = auth.uid() and p.status = 'draft')
        or (public.current_role() = 'storekeeper' and p.status = 'submitted')
      )
  )
)
with check (
  public.current_role() = 'admin'
  or exists (
    select 1 from public.plans p
    where p.id = plan_id
      and public.can_access_kitchen(p.kitchen_id)
      and (
        (public.current_role() = 'chef' and p.created_by = auth.uid() and p.status = 'draft')
        or (public.current_role() = 'storekeeper' and p.status = 'submitted')
      )
  )
);

create policy "plan_items_delete_admin_only" on public.plan_items
for delete using (public.current_role() = 'admin');

-- audit
create policy "plan_item_audit_select_by_plan_access" on public.plan_item_audit
for select using (
  exists (
    select 1
    from public.plan_items pi
    join public.plans p on p.id = pi.plan_id
    where pi.id = plan_item_id and public.can_access_kitchen(p.kitchen_id)
  )
);

create policy "plan_item_audit_insert_admin_only" on public.plan_item_audit
for insert with check (public.current_role() = 'admin');
