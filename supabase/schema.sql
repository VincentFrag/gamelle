-- =====================================================================
--  Gamelle : schéma Supabase
--  À coller en entier dans Supabase > SQL Editor > New query > Run.
--  Prévu pour le même projet que Fonte : le script ne crée, ne lit et ne
--  modifie qu'une seule table, `gamelle`. Aucune table de Fonte n'est
--  touchée. Il ne supprime rien et peut être relancé sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table unique de Gamelle
--    kind : meal (repas), recipe (recette perso), ingredient (prix ou
--           ingrédient perso), stock (réserves), list (courses), settings,
--           weight (pesée : id = jour AAAA-MM-JJ), bake (dessert de la
--           semaine), pantry (fond de placard)
--    id   : identifiant dans ce type (ex. « 2026-11-16:soir » pour un repas)
--    data : contenu (JSON), contrôlé par l'app à l'arrivée
-- ---------------------------------------------------------------------

create table if not exists public.gamelle (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('meal', 'recipe', 'ingredient', 'stock', 'list', 'settings', 'weight', 'bake', 'pantry')),
  id          text not null check (char_length(id) between 1 and 80),
  data        jsonb not null default '{}'::jsonb check (pg_column_size(data) < 65536),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  synced_at   timestamptz not null default now(),
  primary key (user_id, kind, id)
);
alter table public.gamelle enable row level security;
create index if not exists gamelle_sync_idx on public.gamelle (user_id, synced_at);

-- ---------------------------------------------------------------------
-- 2. Règles d'accès : chaque utilisateur connecté ne lit et n'écrit que
--    ses propres lignes. Rien pour les visiteurs non connectés.
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gamelle' and policyname = 'Mes lignes uniquement') then
    create policy "Mes lignes uniquement" on public.gamelle for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end;
$$;

grant select, insert, update, delete on public.gamelle     to authenticated;

-- ---------------------------------------------------------------------
-- 3. Trigger de synchronisation
--    - pose synced_at à l'heure du serveur à chaque écriture
--    - « la dernière modification gagne » : une version plus ancienne
--      envoyée par un appareil resté hors ligne n'écrase pas la plus récente
-- ---------------------------------------------------------------------

create or replace function public.gamelle_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

create or replace trigger gamelle_before_write before insert or update on public.gamelle
  for each row execute function public.gamelle_before_write();

-- ---------------------------------------------------------------------
-- 4. Vérification : la ligne doit afficher rls_active = true
--    et au moins 1 règle.
-- ---------------------------------------------------------------------

select c.relname as table_name,
       c.relrowsecurity as rls_active,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as regles
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname = 'gamelle'
order by c.relname;
