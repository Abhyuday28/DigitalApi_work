"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Quiz = {
  id: string; title: string; description: string; stake: number;
  reward: number; pass_percentage: number; published?: boolean;
};
type Question = { id: string; prompt: string; options: string[] };
type Transaction = {
  id: string; amount: number; kind: string; balance_after: number;
  created_at: string; reference_id?: string | null;
};
type AttemptResult = {
  attempt_id?: string; status?: string; score?: number; correct?: number;
  total?: number; reward?: number; balance?: number; already_submitted?: boolean;
};
type Tab = "overview" | "quizzes" | "wallet" | "admin";

const API = "/api/v1";

async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error ?? payload?.message ?? `Request failed (${response.status})`;
    throw new Error(typeof message === "string" ? message : "Something went wrong");
  }
  return payload.data as T;
}

const number = (value: unknown) => Number(value ?? 0).toLocaleString("en-IN");
const date = (value: string) => new Date(value).toLocaleString();

export default function QuizDashboard() {
  const [token, setToken] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [adminQuizzes, setAdminQuizzes] = useState<Quiz[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [attemptId, setAttemptId] = useState("");
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState("100");
  const [quizForm, setQuizForm] = useState({ title: "", description: "", stake: "50", reward: "100", pass_percentage: "60" });
  const [questionForm, setQuestionForm] = useState({ quizId: "", prompt: "", options: "Option 1\nOption 2\nOption 3\nOption 4", correct_index: "0" });
  const [adminAvailable, setAdminAvailable] = useState(false);

  const clearMessages = () => { setError(""); setNotice(""); };
  const showError = (e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong");

  const refresh = useCallback(async (authToken: string) => {
    setLoading(true);
    try {
      const [quizData, walletData, transactionData] = await Promise.all([
        api<Quiz[]>("/quizzes", authToken),
        api<{ balance: number }>("/wallet/balance", authToken),
        api<Transaction[]>("/wallet/transactions", authToken),
      ]);
      setQuizzes(quizData ?? []);
      setBalance(Number(walletData?.balance ?? 0));
      setTransactions(transactionData ?? []);
      try {
        const adminData = await api<Quiz[]>("/admin/quizzes", authToken);
        setAdminQuizzes(adminData ?? []);
        setAdminAvailable(true);
      } catch {
        setAdminAvailable(false);
        setAdminQuizzes([]);
      }
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("quiz_access_token");
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (token) void refresh(token);
  }, [token, refresh]);

  const latestTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); clearMessages(); setAuthBusy(true);
    try {
      if (authMode === "register") {
        const response = await api<{ user_id: string; confirmation_required: boolean }>("/auth/register", undefined, {
          method: "POST", body: JSON.stringify({ email, password }),
        });
        setNotice(response.confirmation_required
          ? "Account created. Confirm your email, then sign in."
          : "Account created. You can now sign in.");
        setAuthMode("login");
      } else {
        const response = await api<{ access_token: string }>("/auth/login", undefined, {
          method: "POST", body: JSON.stringify({ email, password }),
        });
        window.localStorage.setItem("quiz_access_token", response.access_token);
        setToken(response.access_token);
        setNotice("Welcome back. You're signed in.");
      }
    } catch (e) { showError(e); }
    finally { setAuthBusy(false); }
  }

  function logout() {
    window.localStorage.removeItem("quiz_access_token");
    setToken(""); setBalance(null); setQuizzes([]); setTransactions([]);
    setSelectedQuiz(null); setResult(null); setTab("overview"); clearMessages();
  }

  async function openQuiz(quiz: Quiz) {
    clearMessages(); setSelectedQuiz(quiz); setResult(null); setAttemptId(""); setAnswers({});
    try {
      const data = await api<Quiz & { questions: Question[] }>(`/quizzes/${quiz.id}`, token);
      setSelectedQuiz(data); setQuestions(data.questions ?? []);
    } catch (e) { showError(e); setSelectedQuiz(null); }
  }

  async function startQuiz() {
    if (!selectedQuiz) return;
    clearMessages();
    try {
      const data = await api<{ attempt_id: string; balance: number }>(`/quizzes/${selectedQuiz.id}/enter`, token, {
        method: "POST", body: JSON.stringify({}),
      });
      setAttemptId(data.attempt_id);
      if (typeof data.balance === "number") setBalance(data.balance);
      await refresh(token);
      setNotice("Quiz started. Your entry stake has been deducted.");
    } catch (e) { showError(e); }
  }

  async function submitQuiz() {
    if (!attemptId) return;
    clearMessages();
    try {
      const data = await api<AttemptResult>(`/attempts/${attemptId}/submit`, token, {
        method: "POST", body: JSON.stringify({ answers }),
      });
      setResult(data);
      await refresh(token);
    } catch (e) { showError(e); }
  }

  async function purchaseCredits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); clearMessages();
    try {
      const amount = Number(purchaseAmount);
      if (!Number.isInteger(amount) || amount < 1 || amount > 10000) throw new Error("Enter an amount between 1 and 10,000 credits.");
      await api("/payments/mock", token, {
        method: "POST", body: JSON.stringify({ amount, idempotency_key: crypto.randomUUID() }),
      });
      setNotice(`${number(amount)} mock credits added to your wallet.`);
      await refresh(token);
    } catch (e) { showError(e); }
  }

  async function createQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); clearMessages();
    try {
      const created = await api<Quiz>("/admin/quizzes", token, {
        method: "POST",
        body: JSON.stringify({
          title: quizForm.title, description: quizForm.description,
          stake: Number(quizForm.stake), reward: Number(quizForm.reward),
          pass_percentage: Number(quizForm.pass_percentage), published: false,
        }),
      });
      setNotice("Quiz created as a draft. Add questions, then publish it.");
      setQuizForm({ title: "", description: "", stake: "50", reward: "100", pass_percentage: "60" });
      await refresh(token);
      if (created?.id) setQuestionForm(p => ({ ...p, quizId: created.id }));
    } catch (e) { showError(e); }
  }

  async function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); clearMessages();
    try {
      const options = questionForm.options.split("\n").map(v => v.trim()).filter(Boolean);
      const correct_index = Number(questionForm.correct_index);
      if (!questionForm.quizId) throw new Error("Select a quiz first.");
      if (options.length < 2 || correct_index < 0 || correct_index >= options.length) throw new Error("Check the options and correct answer index.");
      await api(`/admin/quizzes/${questionForm.quizId}/questions`, token, {
        method: "POST",
        body: JSON.stringify({ prompt: questionForm.prompt, options, correct_index }),
      });
      setNotice("Question added successfully.");
      setQuestionForm(p => ({ ...p, prompt: "" }));
    } catch (e) { showError(e); }
  }

  async function togglePublish(quiz: Quiz) {
    clearMessages();
    try {
      await api(`/admin/quizzes/${quiz.id}`, token, {
        method: "PATCH", body: JSON.stringify({ published: !quiz.published }),
      });
      setNotice(quiz.published ? "Quiz unpublished." : "Quiz published.");
      await refresh(token);
    } catch (e) { showError(e); }
  }

  if (!token) {
    return (
      <main className="auth-shell">
        <section className="auth-visual">
          <div className="brand brand-light"><span className="brand-mark">Q</span> Quizly</div>
          <div className="auth-copy">
            <span className="eyebrow">LEARN · PLAY · EARN</span>
            <h1>Make every<br />answer count.</h1>
            <p>Challenge yourself with quizzes, put your credits to work, and earn rewards as you learn.</p>
            <div className="auth-stat-row"><div><strong>500</strong><span>Starter credits</span></div><div><strong>100%</strong><span>Skill focused</span></div></div>
          </div>
          <div className="auth-visual-foot">A simple quiz experience powered by your knowledge.</div>
        </section>
        <section className="auth-panel">
          <div className="auth-card">
            <div className="brand"><span className="brand-mark">Q</span> Quizly</div>
            <span className="eyebrow">YOUR LEARNING SPACE</span>
            <h2>{authMode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p className="muted">{authMode === "login" ? "Sign in to continue to your dashboard." : "Join and get 500 credits to start playing."}</p>
            {error && <div className="alert alert-error">{error}</div>}
            {notice && <div className="alert alert-success">{notice}</div>}
            <form onSubmit={handleAuth} className="form-stack">
              <label>Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
              <label>Password<input type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
              <button className="button button-primary button-wide" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"} <span>→</span></button>
            </form>
            <p className="auth-switch">{authMode === "login" ? "New to Quizly?" : "Already have an account?"} <button className="text-button" onClick={() => { clearMessages(); setAuthMode(authMode === "login" ? "register" : "login"); }}> {authMode === "login" ? "Create an account" : "Sign in"}</button></p>
            <p className="tiny-note">Credits are for demonstration only and have no cash value.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#"><span className="brand-mark">Q</span> Quizly</a>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav">
          <button className={tab === "overview" ? "active" : ""} onClick={() => { setTab("overview"); setSelectedQuiz(null); }}> <span>▦</span> Overview</button>
          <button className={tab === "quizzes" ? "active" : ""} onClick={() => { setTab("quizzes"); setSelectedQuiz(null); }}> <span>▤</span> Explore quizzes</button>
          <button className={tab === "wallet" ? "active" : ""} onClick={() => { setTab("wallet"); setSelectedQuiz(null); }}> <span>◈</span> My wallet</button>
          {adminAvailable && <><div className="side-label side-label-spaced">MANAGEMENT</div><button className={tab === "admin" ? "active" : ""} onClick={() => { setTab("admin"); setSelectedQuiz(null); }}> <span>⚙</span> Admin panel</button></>}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><span className="help-icon">?</span><div><strong>Need a hand?</strong><small>Explore the quiz and wallet tools.</small></div></div>
          <button className="logout-button" onClick={logout}><span>↪</span> Sign out</button>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div><span className="breadcrumb">Workspace</span><span className="breadcrumb-sep">/</span><strong>{selectedQuiz ? "Quiz attempt" : tab === "overview" ? "Overview" : tab === "quizzes" ? "Explore quizzes" : tab === "wallet" ? "My wallet" : "Admin panel"}</strong></div>
          <div className="topbar-right"><span className="online-dot" /> <span className="topbar-status">Connected</span><div className="avatar">{email.slice(0,1).toUpperCase() || "U"}</div></div>
        </header>

        <div className="content">
          {error && <div className="alert alert-error page-alert">{error}<button onClick={() => setError("")}>×</button></div>}
          {notice && <div className="alert alert-success page-alert">{notice}<button onClick={() => setNotice("")}>×</button></div>}

          {selectedQuiz ? (
            <section className="quiz-view">
              <button className="back-button" onClick={() => { setSelectedQuiz(null); setResult(null); }}>← Back to quizzes</button>
              <div className="section-heading"><div><span className="eyebrow">QUIZ CHALLENGE</span><h1>{selectedQuiz.title}</h1><p>{selectedQuiz.description || "Test your knowledge and earn credits."}</p></div><span className="pill pill-purple">{number(selectedQuiz.stake)} credits to enter</span></div>
              <div className="quiz-meta"><span>🏆 Reward: <strong>{number(selectedQuiz.reward)} credits</strong></span><span>✓ Pass mark: <strong>{selectedQuiz.pass_percentage}%</strong></span><span>☷ {questions.length} questions</span></div>
              {result ? (
                <div className="result-card">
                  <div className={result.status === "passed" ? "result-icon result-win" : "result-icon result-loss"}>{result.status === "passed" ? "✓" : "↻"}</div>
                  <span className="eyebrow">YOUR RESULT</span><h2>{result.status === "passed" ? "Well done! You passed." : "Good try. Keep learning."}</h2>
                  <div className="score-number">{number(result.score)}<small>/100</small></div>
                  <p>{number(result.correct)} out of {number(result.total)} correct answers</p>
                  <div className="result-reward">{result.status === "passed" ? `+${number(result.reward)} credits earned` : "Your entry stake was used"}</div>
                  <button className="button button-primary" onClick={() => { setSelectedQuiz(null); setResult(null); setTab("overview"); }}>Back to dashboard</button>
                </div>
              ) : !attemptId ? (
                <div className="start-card"><div className="start-illustration">✦</div><h2>Ready to take the challenge?</h2><p>Entering this quiz will deduct <strong>{number(selectedQuiz.stake)} credits</strong> from your wallet. Pass the quiz to earn <strong>{number(selectedQuiz.reward)} credits</strong>.</p><button className="button button-primary" onClick={startQuiz} disabled={balance !== null && balance < selectedQuiz.stake}>Enter quiz · {number(selectedQuiz.stake)} credits</button>{balance !== null && balance < selectedQuiz.stake && <small className="field-hint">You need more credits to enter this quiz.</small>}</div>
              ) : (
                <div className="question-list">
                  <div className="question-progress"><span>{Object.keys(answers).length} of {questions.length} answered</span><span>{Math.round(Object.keys(answers).length / Math.max(questions.length,1) * 100)}%</span></div>
                  <div className="progress-track"><div style={{ width: `${Object.keys(answers).length / Math.max(questions.length,1) * 100}%` }} /></div>
                  {questions.map((question, index) => (
                    <article className="question-card" key={question.id}>
                      <span className="question-count">QUESTION {String(index + 1).padStart(2,"0")}</span><h3>{question.prompt}</h3>
                      <div className="option-list">{question.options.map((option, optionIndex) => <button key={optionIndex} className={answers[question.id] === optionIndex ? "option selected" : "option"} onClick={() => setAnswers(p => ({ ...p, [question.id]: optionIndex }))}><span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span>{option}<span className="option-check">{answers[question.id] === optionIndex ? "✓" : ""}</span></button>)}</div>
                    </article>
                  ))}
                  <button className="button button-primary button-wide" onClick={submitQuiz} disabled={questions.length === 0 || Object.keys(answers).length !== questions.length}>Submit answers ({Object.keys(answers).length}/{questions.length})</button>
                </div>
              )}
            </section>
          ) : tab === "overview" ? (
            <>
              <div className="welcome-row"><div><span className="eyebrow">YOUR LEARNING SPACE</span><h1>Good to see you again 👋</h1><p>Ready to challenge yourself with something new?</p></div><button className="button button-primary" onClick={() => setTab("quizzes")}>Explore quizzes <span>→</span></button></div>
              <div className="stats-grid">
                <div className="stat-card stat-highlight"><div className="stat-top"><span>Available credits</span><span className="stat-icon">◈</span></div><strong>{balance === null ? "—" : number(balance)}</strong><small>Credits in your wallet</small></div>
                <div className="stat-card"><div className="stat-top"><span>Available quizzes</span><span className="stat-icon icon-blue">▤</span></div><strong>{number(quizzes.length)}</strong><small>Ready to explore</small></div>
                <div className="stat-card"><div className="stat-top"><span>Transactions</span><span className="stat-icon icon-green">↗</span></div><strong>{number(transactions.length)}</strong><small>Wallet activity recorded</small></div>
              </div>
              <div className="section-row"><div><h2>Featured quizzes</h2><p>Pick a topic and put your knowledge to the test.</p></div><button className="link-button" onClick={() => setTab("quizzes")}>View all quizzes →</button></div>
              <div className="quiz-grid">{quizzes.slice(0,3).map((quiz,index) => <QuizCard key={quiz.id} quiz={quiz} index={index} onClick={() => void openQuiz(quiz)} />)}{quizzes.length === 0 && <EmptyState title="No published quizzes yet" text="Check back soon or ask an administrator to publish a quiz." />}</div>
              <div className="section-row section-row-gap"><div><h2>Recent wallet activity</h2><p>Your latest credit movements.</p></div><button className="link-button" onClick={() => setTab("wallet")}>View wallet →</button></div>
              <TransactionTable transactions={latestTransactions} />
            </>
          ) : tab === "quizzes" ? (
            <>
              <div className="page-title"><span className="eyebrow">FIND YOUR NEXT CHALLENGE</span><h1>Explore quizzes</h1><p>Choose a quiz, stake credits and see how much you know.</p></div>
              <div className="quiz-grid quiz-grid-all">{quizzes.map((quiz,index) => <QuizCard key={quiz.id} quiz={quiz} index={index} onClick={() => void openQuiz(quiz)} />)}{quizzes.length === 0 && <EmptyState title="No quizzes available" text="Published quizzes will appear here." />}</div>
            </>
          ) : tab === "wallet" ? (
            <>
              <div className="page-title"><span className="eyebrow">CREDITS & ACTIVITY</span><h1>My wallet</h1><p>Track your balance, purchases, stakes and rewards.</p></div>
              <div className="wallet-layout">
                <div className="wallet-balance"><span>YOUR AVAILABLE BALANCE</span><strong>{balance === null ? "—" : number(balance)} <small>credits</small></strong><p>Credits are used to enter quizzes and can be earned by passing.</p><div className="wallet-orbit">◈</div></div>
                <form className="purchase-card" onSubmit={purchaseCredits}><span className="eyebrow">MOCK TOP-UP</span><h2>Add credits</h2><p>This is a simulated purchase. No real payment is collected.</p><label>Credit amount<input type="number" min="1" max="10000" step="1" value={purchaseAmount} onChange={e => setPurchaseAmount(e.target.value)} required /></label><button className="button button-primary button-wide">Add credits <span>→</span></button></form>
              </div>
              <div className="section-row section-row-gap"><div><h2>Transaction history</h2><p>A record of every wallet movement.</p></div></div>
              <TransactionTable transactions={transactions} />
            </>
          ) : (
            <>
              <div className="page-title"><span className="eyebrow">QUIZ MANAGEMENT</span><h1>Admin panel</h1><p>Create quizzes, add questions and control publication.</p></div>
              <div className="admin-grid">
                <form className="admin-card form-stack" onSubmit={createQuiz}><div><span className="eyebrow">01 · QUIZ DETAILS</span><h2>Create a quiz</h2><p className="muted">New quizzes are created as drafts.</p></div><label>Quiz title<input required minLength={3} value={quizForm.title} onChange={e => setQuizForm(p => ({...p,title:e.target.value}))} placeholder="e.g. JavaScript Fundamentals" /></label><label>Description<textarea rows={3} value={quizForm.description} onChange={e => setQuizForm(p => ({...p,description:e.target.value}))} placeholder="What will users learn?" /></label><div className="form-two"><label>Entry stake<input type="number" min="1" value={quizForm.stake} onChange={e => setQuizForm(p => ({...p,stake:e.target.value}))} /></label><label>Reward<input type="number" min="1" value={quizForm.reward} onChange={e => setQuizForm(p => ({...p,reward:e.target.value}))} /></label></div><label>Passing percentage<input type="number" min="1" max="100" value={quizForm.pass_percentage} onChange={e => setQuizForm(p => ({...p,pass_percentage:e.target.value}))} /></label><button className="button button-primary">Create draft quiz</button></form>
                <form className="admin-card form-stack" onSubmit={addQuestion}><div><span className="eyebrow">02 · QUESTION BANK</span><h2>Add a question</h2><p className="muted">Choose a quiz and provide its answer options.</p></div><label>Select quiz<select required value={questionForm.quizId} onChange={e => setQuestionForm(p => ({...p,quizId:e.target.value}))}><option value="">Choose a quiz</option>{adminQuizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}</select></label><label>Question prompt<textarea required rows={3} value={questionForm.prompt} onChange={e => setQuestionForm(p => ({...p,prompt:e.target.value}))} placeholder="Enter your question" /></label><label>Options (one per line)<textarea required rows={5} value={questionForm.options} onChange={e => setQuestionForm(p => ({...p,options:e.target.value}))} /></label><label>Correct option index<input type="number" min="0" max="5" value={questionForm.correct_index} onChange={e => setQuestionForm(p => ({...p,correct_index:e.target.value}))} /><small className="field-hint">Zero-based: 0 = first option, 1 = second option, etc.</small></label><button className="button button-primary">Add question</button></form>
              </div>
              <div className="section-row section-row-gap"><div><h2>Manage quizzes</h2><p>Publish a quiz after adding its questions.</p></div></div>
              <div className="admin-list">{adminQuizzes.map(quiz => <div className="admin-quiz-row" key={quiz.id}><div><strong>{quiz.title}</strong><small>{number(quiz.stake)} stake · {number(quiz.reward)} reward · {quiz.pass_percentage}% to pass</small></div><span className={quiz.published ? "pill pill-green" : "pill pill-muted"}>{quiz.published ? "Published" : "Draft"}</span><button className="button button-small button-secondary" onClick={() => void togglePublish(quiz)}>{quiz.published ? "Unpublish" : "Publish"}</button></div>)}</div>
            </>
          )}
          {loading && <div className="loading-line">Refreshing your dashboard…</div>}
          <footer className="app-footer"><span>Quizly · Quiz Application with Credit System</span><span>Demo credits have no cash value.</span></footer>
        </div>
      </section>
    </main>
  );
}

function QuizCard({ quiz, index, onClick }: { quiz: Quiz; index: number; onClick: () => void }) {
  const themes = ["quiz-art-violet", "quiz-art-blue", "quiz-art-orange"];
  return <article className="quiz-card"><div className={`quiz-art ${themes[index % themes.length]}`}><span>{["✦","⌘","◉"][index % 3]}</span><small>QUIZ CHALLENGE</small></div><div className="quiz-card-body"><div className="quiz-card-title"><h3>{quiz.title}</h3><span className="pill pill-purple">{number(quiz.stake)} credits</span></div><p>{quiz.description || "Put your knowledge to the test and earn rewards."}</p><div className="quiz-card-meta"><span>✓ {quiz.pass_percentage}% to pass</span><span>🏆 {number(quiz.reward)} reward</span></div><button className="button button-secondary button-wide" onClick={onClick}>View quiz <span>→</span></button></div></article>;
}

function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  if (!transactions.length) return <EmptyState title="No transactions yet" text="Your credit activity will appear here." />;
  return <div className="table-wrap"><table className="transaction-table"><thead><tr><th>TRANSACTION</th><th>DATE</th><th>AMOUNT</th><th>BALANCE AFTER</th></tr></thead><tbody>{transactions.map(tx => <tr key={tx.id}><td><span className="transaction-kind">{tx.kind === "signup" ? "✦" : tx.kind === "reward" ? "🏆" : tx.kind === "stake" ? "↗" : "＋"}</span><span className="capitalize">{tx.kind === "signup" ? "Welcome bonus" : tx.kind === "stake" ? "Quiz entry stake" : tx.kind === "reward" ? "Quiz reward" : "Credit purchase"}</span></td><td>{date(tx.created_at)}</td><td className={tx.amount >= 0 ? "amount-positive" : "amount-negative"}>{tx.amount > 0 ? "+" : ""}{number(tx.amount)}</td><td>{number(tx.balance_after)} credits</td></tr>)}</tbody></table></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><div>✦</div><strong>{title}</strong><p>{text}</p></div>;
}
