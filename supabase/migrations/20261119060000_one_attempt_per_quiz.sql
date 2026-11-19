
-- Enforce one quiz entry per user, preserving historical attempts.

CREATE TABLE public.quiz_entries (
    user_id uuid NOT NULL REFERENCES public.profiles(id),
    quiz_id uuid NOT NULL REFERENCES public.quizzes(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, quiz_id)
);

-- Preserve all existing user/quiz entry history.
INSERT INTO public.quiz_entries (user_id, quiz_id)
SELECT DISTINCT user_id, quiz_id
FROM public.attempts
ON CONFLICT (user_id, quiz_id) DO NOTHING;


-- Update quiz entry logic to prevent repeat entries.
CREATE OR REPLACE FUNCTION public.enter_quiz(
    p_user uuid,
    p_quiz uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_quiz public.quizzes%rowtype;
    v_balance bigint;
    v_id uuid;
    v_rows int;
BEGIN
    SELECT * INTO v_quiz
    FROM public.quizzes
    WHERE id = p_quiz AND published = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quiz unavailable' USING errcode = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.questions WHERE quiz_id = p_quiz
    ) THEN
        RAISE EXCEPTION 'Quiz has no questions' USING errcode = 'P0001';
    END IF;

    -- Claim the one permitted entry before charging credits.
    INSERT INTO public.quiz_entries (user_id, quiz_id)
    VALUES (p_user, p_quiz)
    ON CONFLICT (user_id, quiz_id) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
        RAISE EXCEPTION 'You have already entered this quiz'
            USING errcode = 'P0001';
    END IF;

    SELECT balance INTO v_balance
    FROM public.wallets
    WHERE user_id = p_user
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found' USING errcode = 'P0001';
    END IF;

    IF v_balance < v_quiz.stake THEN
        RAISE EXCEPTION 'Insufficient credits' USING errcode = 'P0001';
    END IF;

    UPDATE public.wallets
    SET balance = balance - v_quiz.stake,
        updated_at = now()
    WHERE user_id = p_user;

    INSERT INTO public.attempts (
        user_id, quiz_id, stake, reward, pass_percentage
    )
    VALUES (
        p_user, p_quiz, v_quiz.stake, v_quiz.reward,
        v_quiz.pass_percentage
    )
    RETURNING id INTO v_id;

    INSERT INTO public.credit_transactions (
        user_id, amount, kind, balance_after, reference_id
    )
    VALUES (
        p_user, -v_quiz.stake, 'stake',
        v_balance - v_quiz.stake, v_id
    );

    RETURN jsonb_build_object(
        'attempt_id', v_id,
        'balance', v_balance - v_quiz.stake
    );
END;
$$;
