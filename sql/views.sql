create or replace view public.v_plan_item_diff as
select
  pi.id as plan_item_id,
  pi.plan_id,
  p.kitchen_id,
  p.plan_date,
  pi.product_name,
  pi.unit,
  pi.planned_qty,
  pi.actual_qty,
  (coalesce(pi.actual_qty, 0) - pi.planned_qty) as delta_qty,
  case
    when pi.planned_qty = 0 then null
    else round(((coalesce(pi.actual_qty, 0) - pi.planned_qty) / pi.planned_qty) * 100, 2)
  end as delta_percent,
  pi.is_checked
from public.plan_items pi
join public.plans p on p.id = pi.plan_id;

create or replace view public.v_plan_summary as
with item_stats as (
  select
    p.id as plan_id,
    p.kitchen_id,
    p.plan_date,
    p.status,
    count(pi.id) as item_count,
    count(*) filter (where pi.is_checked) as checked_count,
    coalesce(sum(pi.planned_qty), 0) as total_planned,
    coalesce(sum(coalesce(pi.actual_qty, 0)), 0) as total_actual
  from public.plans p
  left join public.plan_items pi on pi.plan_id = p.id
  group by p.id, p.kitchen_id, p.plan_date, p.status
),
top_dev as (
  select
    d.plan_id,
    jsonb_agg(
      jsonb_build_object(
        'product_name', d.product_name,
        'unit', d.unit,
        'planned_qty', d.planned_qty,
        'actual_qty', d.actual_qty,
        'delta_qty', d.delta_qty,
        'delta_percent', d.delta_percent
      )
      order by abs(d.delta_qty) desc
    ) filter (where d.rn <= 3) as top_deviations
  from (
    select
      v.*, row_number() over (partition by v.plan_id order by abs(v.delta_qty) desc) as rn
    from public.v_plan_item_diff v
  ) d
  group by d.plan_id
)
select
  s.plan_id,
  s.kitchen_id,
  s.plan_date,
  s.status,
  s.item_count,
  s.checked_count,
  case when s.item_count = 0 then 0 else round((s.checked_count::numeric / s.item_count) * 100, 2) end as checked_percent,
  s.total_planned,
  s.total_actual,
  round(s.total_actual - s.total_planned, 3) as total_delta,
  case when s.total_planned = 0 then null else round(((s.total_actual - s.total_planned) / s.total_planned) * 100, 2) end as total_delta_percent,
  coalesce(t.top_deviations, '[]'::jsonb) as top_deviations
from item_stats s
left join top_dev t on t.plan_id = s.plan_id;
