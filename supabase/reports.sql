-- ════════════════════════════════════════════════════════════════════
--  جدول البلاغات — شرط سياسة المحتوى من إنشاء المستخدمين في Google Play
--
--  شغّل هذا مرّة واحدة في Supabase:  SQL Editor ← New query ← Run
--
--  السياسة تشترط نظاماً داخل التطبيق للإبلاغ، وأن يُتَّخذ إجراء على
--  البلاغات. هذا الجدول هو الطرف الذي تصل إليه، وتراجعه من لوحة Supabase.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.reports (
  id            bigint generated always as identity primary key,
  reporter_id   text,                       -- من أبلغ (قد يكون فارغاً)
  reported_id   text        not null,       -- المُبلَّغ عنه
  reported_name text        not null,       -- اسمه وقت البلاغ (قد يتغيّر بعده)
  reason        text        not null check (reason in ('name','cheating','abuse','other')),
  note          text        default '',
  created_at    timestamptz not null default now(),
  -- حالة المراجعة: تُحدّثها أنت من اللوحة
  status        text        not null default 'open' check (status in ('open','reviewed','actioned','dismissed'))
);

-- للبحث السريع عن بلاغات لاعب بعينه، وعن المفتوحة منها
create index if not exists reports_reported_idx on public.reports (reported_id);
create index if not exists reports_status_idx   on public.reports (status, created_at desc);

alter table public.reports enable row level security;

-- ⚠ الإدراج فقط للعامّة، والقراءة ممنوعة عليهم.
--   لو سُمح بالقراءة لاستطاع أي أحد تصفّح من أبلغ عن من — وهذا يكشف
--   المُبلِّغين ويفتح باب الانتقام. أنت تقرأها من لوحة Supabase بمفتاح
--   الخدمة، لا من التطبيق.
drop policy if exists "anyone can file a report" on public.reports;
create policy "anyone can file a report"
  on public.reports for insert
  with check (true);

-- لا سياسة select ولا update ولا delete ⇒ ممنوعة على مفتاح anon.

-- حدّ بسيط ضدّ الإغراق: 20 بلاغاً في الساعة لكل مُبلِغ
create or replace function public.reports_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reporter_id is not null and (
       select count(*) from public.reports
       where reporter_id = new.reporter_id
         and created_at > now() - interval '1 hour'
     ) >= 20 then
    raise exception 'too many reports';
  end if;
  return new;
end;
$$;

drop trigger if exists reports_rate_limit_trg on public.reports;
create trigger reports_rate_limit_trg
  before insert on public.reports
  for each row execute function public.reports_rate_limit();
