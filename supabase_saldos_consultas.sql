alter table public.profiles
add column if not exists saldo_psicologia integer not null default 0,
add column if not exists saldo_nutricion integer not null default 0;
