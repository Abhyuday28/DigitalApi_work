-- Supabase migration for DigitalAPI Quiz. Apply only to the intended project.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'user' check(role in ('user','admin')),
 created_at timestamptz not null default now()
);
create table public.wallets (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 balance bigint not null default 500 check(balance >= 0),
 updated_at timestamptz not null default now()
);
create table public.quizzes (
 id uuid primary key default gen_random_uuid(), title text not null,description text not null default '',
 stake bigint not null check(stake > 0),reward bigint not null check(reward > 0),
 pass_percentage int not null default 60 check(pass_percentage between 1 and 100),
 published boolean not null default false,created_at timestamptz not null default now()
);
create table public.questions (
 id uuid primary key default gen_random_uuid(),quiz_id uuid not null references public.quizzes(id) on delete cascade,
 prompt text not null,options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 6),
 correct_index int not null check(correct_index between 0 and 5),created_at timestamptz not null default now(),
 constraint valid_correct_index check(correct_index < jsonb_array_length(options))
);
create table public.attempts (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),
 quiz_id uuid not null references public.quizzes(id),stake bigint not null,reward bigint not null,
 pass_percentage int not null,status text not null default 'started' check(status in ('started','passed','failed')),
 score int,question_count int,answers jsonb,created_at timestamptz not null default now(),submitted_at timestamptz
);
create table public.credit_transactions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),
 amount bigint not null,kind text not null check(kind in ('signup','stake','reward','purchase')),
 balance_after bigint not null check(balance_after >= 0),reference_id uuid,
 created_at timestamptz not null default now()
);
create unique index one_signup_bonus on public.credit_transactions(user_id) where kind='signup';
create unique index one_stake_per_attempt on public.credit_transactions(reference_id) where kind='stake';
create unique index one_reward_per_attempt on public.credit_transactions(reference_id) where kind='reward';
create table public.mock_payments (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),
 idempotency_key uuid not null,amount bigint not null check(amount between 1 and 10000),
 created_at timestamptz not null default now(),unique(user_id,idempotency_key)
);
create function public.on_user_created() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id) values(new.id);
 insert into public.wallets(user_id,balance) values(new.id,500);
 insert into public.credit_transactions(user_id,amount,kind,balance_after) values(new.id,500,'signup',500);
 return new;
end $$;
create trigger user_signup_wallet after insert on auth.users for each row execute function public.on_user_created();
-- Backfill existing users without double-granting signup credits.
insert into public.profiles(id) select id from auth.users on conflict(id) do nothing;
insert into public.wallets(user_id,balance) select id,500 from auth.users on conflict(user_id) do nothing;
insert into public.credit_transactions(user_id,amount,kind,balance_after)
select u.id,500,'signup',500 from auth.users u
where not exists(select 1 from public.credit_transactions t where t.user_id=u.id and t.kind='signup');

create function public.enter_quiz(p_user uuid,p_quiz uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_quiz public.quizzes%rowtype;v_balance bigint;v_id uuid;
begin
 select * into v_quiz from public.quizzes where id=p_quiz and published=true;
 if not found then raise exception 'Quiz unavailable' using errcode='P0001';end if;
 if not exists(select 1 from public.questions where quiz_id=p_quiz) then raise exception 'Quiz has no questions' using errcode='P0001';end if;
 select balance into v_balance from public.wallets where user_id=p_user for update;
 if not found then raise exception 'Wallet not found' using errcode='P0001';end if;
 if v_balance < v_quiz.stake then raise exception 'Insufficient credits' using errcode='P0001';end if;
 update public.wallets set balance=balance-v_quiz.stake,updated_at=now() where user_id=p_user;
 insert into public.attempts(user_id,quiz_id,stake,reward,pass_percentage)
 values(p_user,p_quiz,v_quiz.stake,v_quiz.reward,v_quiz.pass_percentage) returning id into v_id;
 insert into public.credit_transactions(user_id,amount,kind,balance_after,reference_id)
 values(p_user,-v_quiz.stake,'stake',v_balance-v_quiz.stake,v_id);
 return jsonb_build_object('attempt_id',v_id,'balance',v_balance-v_quiz.stake);
end $$;

create function public.submit_quiz(p_user uuid,p_attempt uuid,p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_attempt public.attempts%rowtype;v_count int;v_correct int;v_score int;v_pass boolean;v_balance bigint;v_invalid int;
begin
 if jsonb_typeof(p_answers)<>'object' then raise exception 'Answers must be an object' using errcode='P0001';end if;
 select * into v_attempt from public.attempts where id=p_attempt and user_id=p_user for update;
 if not found then raise exception 'Attempt not found' using errcode='P0001';end if;
 if v_attempt.status<>'started' then
  return jsonb_build_object('attempt_id',p_attempt,'status',v_attempt.status,'score',v_attempt.score,'total',v_attempt.question_count,'already_submitted',true);
 end if;
 select count(*) into v_invalid from jsonb_each(p_answers) e
 where not exists(select 1 from public.questions q where q.quiz_id=v_attempt.quiz_id and q.id::text=e.key)
 or jsonb_typeof(e.value)<>'number';
 if v_invalid>0 then raise exception 'Invalid answer entries' using errcode='P0001';end if;
 select count(*),count(*) filter(where (p_answers->>id::text) ~ '^[0-9]+$' and (p_answers->>id::text)::int=correct_index)
 into v_count,v_correct from public.questions where quiz_id=v_attempt.quiz_id;
 if v_count=0 then raise exception 'Quiz has no questions' using errcode='P0001';end if;
 v_score:=floor(v_correct::numeric*100/v_count)::int;
 v_pass:=v_score>=v_attempt.pass_percentage;
 update public.attempts set status=case when v_pass then 'passed' else 'failed' end,
 score=v_score,question_count=v_count,answers=p_answers,submitted_at=now() where id=p_attempt;
 if v_pass then
  select balance into v_balance from public.wallets where user_id=p_user for update;
  update public.wallets set balance=balance+v_attempt.reward,updated_at=now() where user_id=p_user;
  insert into public.credit_transactions(user_id,amount,kind,balance_after,reference_id)
  values(p_user,v_attempt.reward,'reward',v_balance+v_attempt.reward,p_attempt);
 end if;
 return jsonb_build_object('attempt_id',p_attempt,'status',case when v_pass then 'passed' else 'failed' end,'score',v_score,'correct',v_correct,'total',v_count,'reward',case when v_pass then v_attempt.reward else 0 end);
end $$;

create function public.mock_purchase(p_user uuid,p_amount bigint,p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_balance bigint;v_id uuid;v_existing public.mock_payments%rowtype;
begin
 if p_amount<1 or p_amount>10000 then raise exception 'Invalid credit purchase amount' using errcode='P0001';end if;
 select balance into v_balance from public.wallets where user_id=p_user for update;
 if not found then raise exception 'Wallet not found' using errcode='P0001';end if;
 select * into v_existing from public.mock_payments where user_id=p_user and idempotency_key=p_key;
 if found then
  if v_existing.amount<>p_amount then raise exception 'Idempotency key reused with different amount' using errcode='P0001';end if;
  return jsonb_build_object('payment_id',v_existing.id,'already_processed',true,'balance',v_balance);
 end if;
 insert into public.mock_payments(user_id,idempotency_key,amount) values(p_user,p_key,p_amount) returning id into v_id;
 update public.wallets set balance=balance+p_amount,updated_at=now() where user_id=p_user;
 insert into public.credit_transactions(user_id,amount,kind,balance_after,reference_id)
 values(p_user,p_amount,'purchase',v_balance+p_amount,v_id);
 return jsonb_build_object('payment_id',v_id,'already_processed',false,'balance',v_balance+p_amount);
end $$;

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.mock_payments enable row level security;
revoke all on public.profiles,public.wallets,public.quizzes,public.questions,public.attempts,public.credit_transactions,public.mock_payments from anon,authenticated;
revoke all on function public.enter_quiz(uuid,uuid),public.submit_quiz(uuid,uuid,jsonb),public.mock_purchase(uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function public.enter_quiz(uuid,uuid),public.submit_quiz(uuid,uuid,jsonb),public.mock_purchase(uuid,bigint,uuid) to service_role;
