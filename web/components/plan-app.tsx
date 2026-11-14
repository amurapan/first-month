"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronLeft, CircleHelp, Copy, House, Leaf, LockKeyhole, Plus, RefreshCw, Trash2, Users, Wallet, X, CalendarDays, Download, MessageCircle, Sparkles } from 'lucide-react';
import { Brand } from '@/app/page';
import { calculateBudget } from '@/lib/domain/budget.js';
import type { Profile, Expense, Plan, Role } from '@/lib/room';

type State = { id: string; revision: number; role: Role; demo: boolean; moveDate: string; self: Profile; partner: Partial<Profile> & { name: string }; bothShared: boolean; joined: boolean; expenses: Expense[]; plan: Plan; planVersion: number; decisions: Record<Role, string>; calculation: ReturnType<typeof calculateBudget> | null; guide: string | null; checkins: { id: string; date: string; amount: number; note: string; role: Role }[] };
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
const dollars = (cents: number) => (cents / 100).toString();
function parseMoney(value: FormDataEntryValue | string | null) {
  const raw = String(value || '0').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error('Enter a positive dollar amount with up to two decimal places.');
  const [whole, decimal = ''] = raw.split('.');
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > 100_000_000) throw new Error('Please enter an amount below $1,000,000.');
  return amount;
}
const fullDate = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const steps = ['Your starting point', 'Shared expenses', 'Find your balance', 'Your agreement', 'Monthly check-in'];
const stepIcons = [Leaf, House, Wallet, CheckCheck, CalendarDays];
function download(name: string, contents: string, mime = 'text/plain') { const url = URL.createObjectURL(new Blob([contents], { type: mime })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

export default function PlanApp({ id }: { id: string }) {
  const [access, setAccess] = useState(''), [invitation, setInvitation] = useState(''), [state, setState] = useState<State | null>(null);
  const [step, setStep] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(''), [toast, setToast] = useState('');
  const [inviteLink, setInviteLink] = useState(''), [copyFallback, setCopyFallback] = useState(''), [booted, setBooted] = useState(false);
  const [guideBusy, setGuideBusy] = useState(false);
  const initialized = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(location.hash.slice(1)), key = params.get('key') || sessionStorage.getItem('fm:key:' + id) || '';
    const invite = params.get('invite') || '';
    if (invite && !params.get('key')) { setInvitation(invite); setBooted(true); return; }
    if (key) { setAccess(key); sessionStorage.setItem('fm:key:' + id, key); localStorage.setItem('fm:recent', '/plan/' + id + '#key=' + key); }
    setBooted(true);
    const savedInvite = localStorage.getItem('fm:invite:' + id);
    if (savedInvite) setInviteLink(location.origin + '/plan/' + id + '#invite=' + savedInvite);
  }, [id]);
  const refresh = useCallback(async () => {
    if (!access) return;
    const response = await fetch('/api/rooms/' + id, { headers: { Authorization: 'Bearer ' + access } });
    const data = await response.json() as State & { error?: string; token: string; invite?: string }; if (!response.ok) throw new Error(data.error);
    setState(data);
    if (!initialized.current) { initialized.current = true; setStep(data.self.submitted ? (data.bothShared ? 2 : 1) : 0); }
    return data as State;
  }, [access, id]);
  useEffect(() => {
    if (!access) return;
    refresh().catch(error => setError(error.message));
    const interval = setInterval(() => { if (!document.hidden) refresh().catch(() => {}); }, 4000);
    return () => clearInterval(interval);
  }, [refresh, access]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  async function mutate(action: string, payload: Record<string, unknown> = {}) {
    if (!state) return;
    setBusy(true); setError('');
    try {
      const send = (revision: number) => fetch('/api/rooms/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + access }, body: JSON.stringify({ action, revision, ...payload }) });
      let response = await send(state.revision);
      let data = await response.json() as State & { error?: string; token: string; invite?: string };
      if (response.status === 409) {
        const latest = await refresh();
        const independentChange = latest && (
          (action === 'profile' && JSON.stringify(latest.self) === JSON.stringify(state.self)) ||
          (action === 'expenses' && JSON.stringify(latest.expenses) === JSON.stringify(state.expenses)) ||
          (['plan', 'decision'].includes(action) && latest.planVersion === state.planVersion) ||
          action === 'checkin'
        );
        if (independentChange) {
          response = await send(latest.revision);
          data = await response.json() as typeof data;
        }
      }
      if (!response.ok) throw new Error(data.error);
      if (data.revision) setState(data); else await refresh();
      setToast('Saved to your shared space'); return data;
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); return null; }
    finally { setBusy(false); }
  }
  async function join() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/rooms/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'join', invite: invitation }) });
      const data = await response.json() as State & { error?: string; token: string; invite?: string }; if (!response.ok) throw new Error(data.error);
      sessionStorage.setItem('fm:key:' + id, data.token); location.assign('/plan/' + id + '#key=' + data.token); location.reload();
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); setBusy(false); }
  }
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); setToast('Link copied'); } catch { setCopyFallback(text); } }
  async function invite() {
    if (inviteLink) { await copy(inviteLink); return; }
    const result = await mutate('invite');
    if (result?.invite) { const url = location.origin + '/plan/' + id + '#invite=' + result.invite; localStorage.setItem('fm:invite:' + id, result.invite); setInviteLink(url); await copy(url); }
  }
  function switchDemo() {
    const tokens = JSON.parse(localStorage.getItem('fm:demo:' + id) || '{}');
    const key = tokens[state?.role === 'A' ? 'B' : 'A'];
    if (!key) { setError('Open this sample in the browser where you created it to switch roles.'); return; }
    location.assign('/plan/' + id + '#key=' + key); location.reload();
  }
  async function guide() {
    setGuideBusy(true); setError('');
    try {
      const response = await fetch('/api/rooms/' + id + '/guide', { method: 'POST', headers: { Authorization: 'Bearer ' + access, 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: state?.revision }) });
      const data = await response.json() as State & { error?: string; token: string; invite?: string }; if (!response.ok) throw new Error(data.error || 'The conversation guide is unavailable right now.');
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'The conversation guide is unavailable right now.'); }
    finally { setGuideBusy(false); }
  }
  if (invitation) return <div className="join-page"><Brand/><div className="join-card"><span className="section-icon"><Users size={28}/></span><p className="eyebrow">YOU’RE INVITED</p><h1>A little more<br/><em>on the same page.</em></h1><p>Your partner started a space for your first month together. Add your side, then find a plan that works for both of you.</p><button className="button primary full" disabled={busy} onClick={join}>{busy ? 'Joining…' : 'Join our space'}<ArrowRight size={18}/></button>{error && <p className="error" role="alert">{error}</p>}<p className="fine-print">This invitation can be claimed once. You’ll get your own personal access link.</p></div></div>;
  if (!state) return <div className="join-page"><Brand/><div className="join-card"><span className="section-icon"><House size={26}/></span><h2>{error ? 'Let’s find your plan.' : booted && !access ? 'Your personal link, please.' : 'Making a little room…'}</h2><p>{error || (booted && !access ? 'Open the personal link you saved, or ask your partner for your invitation.' : 'Opening your shared space.')}</p><a className="button secondary" href="/">Back to First Month <ArrowRight size={16}/></a></div></div>;
  const a = state.role === 'A' ? state.self : state.partner, b = state.role === 'B' ? state.self : state.partner;
  const total = state.expenses.reduce((sum, item) => sum + item.amount, 0);
  const agreed = state.decisions.A === 'accepted' && state.decisions.B === 'accepted';
  const savedPlan = () => {
    const result = state.calculation;
    return ['FIRST MONTH — ' + a.name + ' & ' + b.name, 'Version ' + state.planVersion + ' · ' + (agreed ? 'Agreed by both' : 'Draft; not agreed by both'), '', 'SHARED EXPENSES', ...state.expenses.map(item => item.label + ': ' + money(item.amount)), 'Total: ' + money(total), '', 'CONTRIBUTIONS', a.name + ': ' + money(result?.contributionsCents[0] || 0), b.name + ': ' + money(result?.contributionsCents[1] || 0), 'Method: ' + state.plan.method, 'Bill payer: ' + (state.plan.payer === 'A' ? a.name : b.name), 'Transfer day: ' + state.plan.payday + ' of each month', 'Discuss unplanned shared purchases from ' + money(state.plan.threshold), 'Next review: ' + fullDate(state.plan.reviewDate), '', state.plan.notes, '', 'Personal commitments and personal spending remain separate. Any changes need both people to review again.'].join('\n');
  };
  return <div className="app-shell">
    <aside className="sidebar"><Brand/><div className="space-label">YOUR SHARED SPACE</div><div className="couple-label"><span className="avatar-stack"><i>{a.name?.[0]}</i><i>{b.name?.[0]}</i></span><div><strong>{a.name} & {b.name}</strong><span>{state.demo ? 'Sample couple' : 'Our next chapter'}</span></div></div>
      <nav className="step-nav">{steps.map((name, index) => { const Icon = stepIcons[index]; return <button key={name} onClick={() => { setStep(index); setError(''); }} className={step === index ? 'active' : ''}><Icon size={18}/><span>{name}</span><small>{index === 0 && state.self.submitted || index === 3 && agreed ? <Check size={14}/> : '0' + (index + 1)}</small></button>; })}</nav>
      <div className="sidebar-bottom"><span className="little-flower">✳</span><p>You don’t have to figure<br/>it all out at once.</p><button className="text-button small-text" onClick={() => copy(location.origin + '/plan/' + id + '#key=' + access)}><Copy size={14}/> Save my access link</button><p className="fine-print">Anyone with your personal link can access your role. Keep it private.</p></div>
    </aside>
    <div className="app-body"><header className="app-header"><span className="breadcrumb">Our first month <span>/</span> {steps[step]}</span><div className="header-actions"><span className="status-dot"/> <span>{state.demo ? 'Demo space' : 'Saved together'}</span><span className="avatar single">{state.self.name[0]}</span></div></header>
      {state.demo && <div className="demo-banner"><span><Sparkles size={15}/> Sample couple · all numbers are fictional · you’re viewing {state.self.name}</span><button onClick={switchDemo}>Switch to {state.partner.name}<ArrowUpRight size={14}/></button></div>}
      <main className="workspace">
        {error && <div className="alert error" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={17}/></button></div>}
        {copyFallback && <div className="alert"><label>Copy this link manually<input value={copyFallback} readOnly onFocus={e => e.target.select()}/></label><button aria-label="Close link" onClick={() => setCopyFallback('')}><X size={18}/></button></div>}
        <div className="workspace-heading"><div><p className="eyebrow">CHAPTER 0{step + 1} <span> / </span> {step === 0 ? 'A LITTLE SPACE FOR YOU' : step === 1 ? 'THE LIFE YOU SHARE' : step === 2 ? 'TWO PERSPECTIVES, ONE PLAN' : step === 3 ? 'MAKE IT YOURS' : 'ROOM TO CHANGE'}</p><h1>{['Start with your side.', 'What makes a home?', 'Find your balance.', 'A plan for both of you.', 'How’s it feeling?'][step]}</h1><p className="workspace-intro">{['Before you compare numbers, take a moment to think about what matters to you.', 'Put a number on your shared life. Keep personal expenses separate.', 'There’s more than one way to share. See what each option leaves for both of you.', 'The small details make a plan you can actually follow.', 'Life changes. Your plan can, too. Make a little time to check in.'][step]}</p></div><span className="chapter-number">0{step + 1}</span></div>
        {!state.joined && state.role === 'A' && <div className="invite-strip"><span className="section-icon small"><Users size={18}/></span><div><strong>Better with {state.partner.name}.</strong><p>You can get started while they add their side.</p></div><button className="button secondary compact" disabled={busy} onClick={invite}><Copy size={15}/> Copy invitation</button></div>}
        {step === 0 && <ProfileForm state={state} busy={busy} onSave={async profile => { const result = await mutate('profile', { profile }); if (result) setStep(1); }} onError={setError}/>}
        {step === 1 && <ExpensesForm state={state} busy={busy} onSave={async expenses => { const result = await mutate('expenses', { expenses }); if (result) setStep(2); }} onError={setError}/>}
        {step >= 2 && !state.bothShared && <div className="waiting-card"><span className="section-icon"><LockKeyhole size={28}/></span><h2>A little space before you share.</h2><p>Both of you need to choose to share your answers before your numbers appear side by side.</p><div className="waiting-people">{[a, b].map((person, index) => <div key={index}><span className={'avatar ' + (index ? 'peach' : '')}>{person.name?.[0]}</span><strong>{person.name}</strong><span className="pill">{person.shared ? 'Ready to share' : 'Taking a moment'}</span></div>)}</div><button className="button secondary" onClick={() => setStep(0)}>Review my answers <ArrowRight size={16}/></button></div>}
        {step === 2 && state.bothShared && <><Balance state={state} busy={busy} onSave={async plan => { const result = await mutate('plan', { plan }); if (result) setStep(3); }} onError={setError}/><section className="conversation-box"><div><span className="overline"><Sparkles size={14}/> A PLACE TO START TALKING</span><h3>Put the differences into words.</h3><p>A conversation guide can turn the priorities you both shared into a neutral starting point.</p></div><button className="button secondary" onClick={guide} disabled={guideBusy}>{guideBusy ? 'Thinking it through…' : 'Make our conversation guide'}<ArrowRight size={16}/></button>{state.guide && <div className="guide-output">{state.guide}</div>}</section></>}
        {step === 3 && state.bothShared && <><Agreement key={state.planVersion} state={state} busy={busy} onSave={plan => mutate('plan', { plan })} onDecision={decision => mutate('decision', { decision, planVersion: state.planVersion })} onError={setError}/>
          <div className="page-actions"><button className="text-button" onClick={() => { if (state.calculation) download('our-first-month.txt', savedPlan()); else setError('Choose a valid contribution method first.'); }}><Download size={16}/> Download {agreed ? 'our plan' : 'draft'}</button><button className="button primary" onClick={() => setStep(4)}>Our monthly check-in <ArrowRight size={17}/></button></div></>}
        {step === 4 && state.bothShared && <Checkin state={state} busy={busy} onSave={checkin => mutate('checkin', { checkin })} onError={setError}/>}
        <footer className="workspace-footer"><span><LockKeyhole size={13}/> Your space. Your pace.</span><button className="text-button small-text" onClick={() => { refresh().then(() => setToast('You’re up to date')).catch(error => setError(error.message)); }}><RefreshCw size={13}/> Refresh partner’s changes</button></footer>
      </main>
    </div>{toast && <div className="toast" role="status"><Check size={16}/>{toast}</div>}
  </div>;
}
function MoneyField({ label, name, value, hint }: { label: string; name: string; value: number; hint?: string }) { return <label>{label}<span className="money-input"><span>$</span><input name={name} type="number" min="0" max="1000000" step="0.01" inputMode="decimal" defaultValue={dollars(value)} required/><span>/ month</span></span>{hint && <small>{hint}</small>}</label>; }
function ProfileForm({ state, busy, onSave, onError }: { state: State; busy: boolean; onSave: (profile: unknown) => Promise<void>; onError: (error: string) => void }) {
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    try { await onSave({ name: String(f.get('name')), income: parseMoney(f.get('income')), personal: parseMoney(f.get('personal')), reserve: parseMoney(f.get('reserve')), priority: String(f.get('priority')), concern: String(f.get('concern')), shared: f.get('shared') === 'on' }); }
    catch (error) { onError((error as Error).message); }
  }
  return <div className="content-columns"><form className="surface form-surface" onSubmit={submit}><div className="panel-heading"><span className="avatar">{state.self.name[0]}</span><div><h3>{state.self.name}’s starting point</h3><p>Use monthly take-home amounts, after tax.</p></div><LockKeyhole size={17}/></div>
    <label>What should we call you?<input name="name" defaultValue={state.self.name} maxLength={60} required/></label>
    <MoneyField name="income" label="What comes in each month?" value={state.self.income} hint="For variable income, use an amount you feel comfortable planning around."/>
    <MoneyField name="personal" label="What’s already committed?" value={state.self.personal} hint="Your own debt payments, transport, family support, or other personal bills. Don’t include the shared expenses you’ll add next."/>
    <MoneyField name="reserve" label="What would you like to keep for yourself?" value={state.self.reserve} hint="For your remaining spending and saving, after personal bills and your shared contribution."/>
    <label>What matters most right now?<select name="priority" defaultValue={state.self.priority}><option>A little breathing room</option><option>A plan I can keep up with</option><option>Keeping some independence</option><option>Saving for our next step</option><option>Less money admin</option></select></label>
    <label>Anything you want your partner to understand?<textarea name="concern" maxLength={800} defaultValue={state.self.concern} placeholder="For example: I’m excited about moving in, but I want to keep building my savings." rows={3}/><small>Optional. This note is shared with your numbers when you both opt in.</small></label>
    <label className="checkbox-label"><input type="checkbox" name="shared" defaultChecked={state.self.shared}/><span>I’m ready to share these numbers, my priority, and my note with {state.partner.name}.<small>They’ll appear once we both choose to share. I can change this later.</small></span></label>
    <div className="form-bottom"><span className="small-text muted">Your answers are saved when you continue.</span><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save & continue'}<ArrowRight size={16}/></button></div>
  </form><aside className="side-note"><div className="line-house"><House size={45} strokeWidth={1}/><span>✳</span></div><p className="overline">A LITTLE REASSURANCE</p><h3>You’re bringing more<br/>than a paycheck.</h3><p>Your numbers are a starting point, not a measure of what you bring to your relationship.</p><hr/><div className="note-item"><Check size={16}/><p>No bank connection. Rounded estimates are okay.</p></div><div className="note-item"><Check size={16}/><p>You choose when your partner can see your answers.</p></div><div className="note-item"><Check size={16}/><p>Nothing is agreed until you both say yes.</p></div></aside></div>;
}
function ExpensesForm({ state, busy, onSave, onError }: { state: State; busy: boolean; onSave: (expenses: Expense[]) => Promise<void>; onError: (message: string) => void }) {
  const [rows, setRows] = useState(state.expenses.map(row => ({ ...row, value: dollars(row.amount) })));
  const originalExpenses = useRef(JSON.stringify(state.expenses));
  const total = rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
  function change(id: string, key: string, value: string) { setRows(rows.map(row => row.id === id ? { ...row, [key]: value } : row)); }
  return <form className="surface expenses-surface" onSubmit={event => { event.preventDefault(); if (originalExpenses.current !== JSON.stringify(state.expenses)) { onError('Your partner changed the shared expenses while you were editing. Reopen this step to review their changes.'); return; } try { onSave(rows.map(({ id, label, value }) => ({ id, label: label.trim(), amount: parseMoney(value) }))); } catch (error) { onError((error as Error).message); } }}>
    <div className="panel-heading"><span className="section-icon small"><House size={22}/></span><div><h3>The things you’ll share</h3><p>Monthly estimates in USD. You can change them together later.</p></div></div>
    <div className="expense-table"><div className="expense-table-head"><span>SHARED EXPENSE</span><span>PER MONTH</span><span/></div>{rows.map(row => <div className="expense-row" key={row.id}><input aria-label="Expense name" value={row.label} maxLength={60} onChange={e => change(row.id, 'label', e.target.value)} required/><span className="money-input"><span>$</span><input aria-label={row.label + ' monthly amount'} value={row.value} onChange={e => change(row.id, 'value', e.target.value)} type="number" min="0" step="0.01" required/></span><button type="button" className="icon-button" aria-label={'Remove ' + row.label} disabled={rows.length === 1} onClick={() => setRows(rows.filter(item => item.id !== row.id))}><Trash2 size={16}/></button></div>)}</div>
    <button type="button" className="text-button add-expense" disabled={rows.length >= 16} onClick={() => setRows([...rows, { id: crypto.randomUUID(), label: '', amount: 0, value: '' }])}><Plus size={16}/> Add a shared expense</button>
    <div className="expense-total"><span>Our monthly shared budget</span><strong>{money(Math.round(total * 100))}</strong></div>
    <div className="soft-note"><CircleHelp size={18}/><p>What counts as shared? Talk about groceries, meals out, subscriptions, and personal treats. Include only what you both intend to share.</p></div>
    <div className="form-bottom"><span className="small-text muted">Changes will ask both of you to review again.</span><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Compare our options'}<ArrowRight size={17}/></button></div>
  </form>;
}
function Balance({ state, busy, onSave, onError }: { state: State; busy: boolean; onSave: (plan: Plan) => Promise<void>; onError: (message: string) => void }) {
  const [method, setMethod] = useState(state.plan.method), [custom, setCustom] = useState(dollars(state.plan.customA));
  const a = (state.role === 'A' ? state.self : state.partner) as Profile, b = (state.role === 'B' ? state.self : state.partner) as Profile;
  const total = state.expenses.reduce((sum, row) => sum + row.amount, 0);
  const calc = (selected: Plan['method']) => calculateBudget({ sharedCents: total, incomeCents: [a.income, b.income], personalCommitmentsCents: [a.personal, b.personal], minimumRemainingCents: [a.reserve, b.reserve], method: selected, customContributionsCents: [parseMoney(custom), total - parseMoney(custom)] });
  let selected: ReturnType<typeof calculateBudget> | null = null; let problem = '';
  try { selected = calc(method); } catch (error) { problem = (error as Error).message; }
  return <><div className="shared-priorities">{[a, b].map((person, i) => <div key={i}><span className={'avatar ' + (i ? 'peach' : '')}>{person.name[0]}</span><div><span className="overline">{person.name}’S PRIORITY</span><strong>{person.priority}</strong>{person.concern && <p>“{person.concern}”</p>}</div></div>)}</div>
    <div className="balance-summary"><p>Your shared expenses <strong>{money(total)}<span>/mo</span></strong></p><span>Choose a starting point. You can adjust it.</span></div>
    <div className="option-grid">{(['equal', 'proportional', 'custom'] as const).map((choice, i) => { let result = null; try { result = calc(choice); } catch {} return <button key={choice} aria-pressed={method === choice} className={'option-card ' + (method === choice ? 'selected' : '')} onClick={() => setMethod(choice)}><span className="option-top"><span className="radio-indicator">{method === choice && <span/>}</span><span>0{i + 1}</span></span><h3>{['Equal shares', 'By income', 'Your own split'][i]}</h3><p>{['The same dollar contribution from each of you.', 'Contribute in proportion to your take-home income.', 'Choose the amounts that fit your situation.'][i]}</p><div className="option-amounts"><span>{a.name}<strong>{result ? money(result.contributionsCents[0]) : '—'}</strong></span><span>{b.name}<strong>{result ? money(result.contributionsCents[1]) : '—'}</strong></span></div></button>; })}</div>
    {method === 'custom' && <div className="surface custom-split"><label>{a.name}’s monthly contribution<span className="money-input"><span>$</span><input aria-label="Custom contribution" value={custom} type="number" min="0" step="0.01" max={total / 100} onChange={e => setCustom(e.target.value)}/></span></label><ArrowRight size={20}/><div><span>{b.name} covers the rest</span><strong>{money(total - Math.round((Number(custom) || 0) * 100))}</strong></div></div>}
    {problem && <div className="alert error">{problem}</div>}
    {selected && <section className="surface breathing-room"><div className="panel-heading"><Leaf size={22}/><div><h3>A little breathing room</h3><p>What remains after personal bills and your shared contribution.</p></div></div><div className="remaining-grid">{[a, b].map((person, i) => <div key={i}><div className="remaining-title"><span><i className={'dot ' + (i ? 'terracotta' : 'green')}/>{person.name}</span><strong>{money(selected!.remainingCents[i])}</strong></div><div className="remaining-bar"><span style={{ width: Math.max(0, Math.min(100, selected!.remainingCents[i] / Math.max(person.income, 1) * 100)) + '%' }} className={i ? 'peach-bg' : ''}/></div><p className={selected!.minimumRemainingMet[i] ? 'muted' : 'attention'}>{selected!.minimumRemainingMet[i] ? 'Meets' : 'Below'} your stated preference of {money(person.reserve)}.</p></div>)}</div>{selected.minimumRemainingMet.includes(false) && <div className="soft-note amber"><CircleHelp size={18}/><p>This option leaves less than one of you hoped to keep. Try another split, adjust the shared budget, or talk about what can change before agreeing.</p></div>}</section>}
    <div className="page-actions"><span className="small-text muted">A calculation can show the trade-offs. You decide what works.</span><button className="button primary" disabled={busy || !selected} onClick={() => { try { onSave({ ...state.plan, method, customA: parseMoney(custom) }); } catch (error) { onError((error as Error).message); } }}>{busy ? 'Saving…' : 'Build our agreement'}<ArrowRight size={17}/></button></div>
  </>;
}
function Agreement({ state, busy, onSave, onDecision, onError }: { state: State; busy: boolean; onSave: (plan: Plan) => Promise<unknown>; onDecision: (decision: string) => Promise<unknown>; onError: (message: string) => void }) {
  const a = state.role === 'A' ? state.self : state.partner, b = state.role === 'B' ? state.self : state.partner;
  const agreed = state.decisions.A === 'accepted' && state.decisions.B === 'accepted';
  const [dirty, setDirty] = useState(false);
  const formRevision = useRef(state.planVersion);
  const stale = formRevision.current !== state.planVersion && dirty;
  return <div className="agreement-layout"><section className="surface agreement-paper"><div className="agreement-title"><span className="paper-symbol"><House size={22}/></span><span className={'pill ' + (agreed ? 'success' : '')}>{agreed ? 'AGREED TOGETHER' : 'DRAFT · VERSION ' + state.planVersion}</span></div><p className="overline">OUR FIRST MONTH</p><h2>{a.name} & {b.name}</h2><p className="muted">A shared starting point, with room to change.</p><div className="agreement-amounts">{[a, b].map((person, i) => <div key={i}><span>{person.name} contributes</span><strong>{state.calculation ? money(state.calculation.contributionsCents[i]) : 'Choose a split'}</strong><small>per month</small></div>)}</div><div className="agreed-expenses">{state.expenses.map(row => <div key={row.id}><span>{row.label}</span><span>{money(row.amount)}</span></div>)}</div><p className="small-text muted">Personal bills, spending, and savings remain separate.</p><hr/><div className="decision-list">{(['A', 'B'] as Role[]).map((role, i) => <div key={role}><span className={'avatar ' + (i ? 'peach' : '')}>{[a, b][i].name?.[0]}</span><strong>{[a, b][i].name}</strong><span className={state.decisions[role] === 'accepted' ? 'approved' : 'muted'}>{state.decisions[role] === 'accepted' ? 'Agreed ✓' : state.decisions[role] === 'needs_changes' ? 'Wants to discuss' : 'Still reviewing'}</span></div>)}</div>
      {state.decisions[state.role] !== 'accepted' ? <button className="button primary full" disabled={busy || dirty || !state.calculation} onClick={() => onDecision('accepted')}><Check size={17}/> I agree to version {state.planVersion}</button> : <div className="accepted-message"><CheckCheck size={18}/>{agreed ? 'You’re both on the same page.' : 'Your yes is saved. Waiting for ' + state.partner.name + '.'}</div>}
      <button className="text-button full discussion-button" disabled={busy} onClick={() => onDecision('needs_changes')}><MessageCircle size={16}/> I’d like to talk about this</button>{dirty && <p className="fine-print attention">Save the details before confirming this version.</p>}
    </section><form className="surface agreement-details" onChange={() => setDirty(true)} onSubmit={async event => { event.preventDefault(); if (stale) { onError('Your partner changed these details while you were editing. Reopen this step to review the latest version.'); return; } const f = new FormData(event.currentTarget); try { const result = await onSave({ ...state.plan, payday: Number(f.get('payday')), payer: f.get('payer') as Role, threshold: parseMoney(f.get('threshold')), reviewDate: String(f.get('reviewDate')), notes: String(f.get('notes')) }); if (result) { setDirty(false); formRevision.current = state.planVersion + 1; } } catch (error) { onError((error as Error).message); } }}>
      <h3>The everyday details</h3><p className="muted small-text">Agree on the routine as well as the numbers.</p>
      <label>Who pays the shared bills?<select name="payer" defaultValue={state.plan.payer}><option value="A">{a.name}</option><option value="B">{b.name}</option></select><small>The other person transfers their monthly contribution to this person.</small></label>
      <label>When should the transfer arrive?<select name="payday" defaultValue={state.plan.payday}>{Array.from({ length: 28 }, (_, i) => <option key={i} value={i + 1}>Day {i + 1} of each month</option>)}</select></label>
      <label>Discuss unplanned shared purchases from<span className="money-input"><span>$</span><input name="threshold" type="number" min="0" step="0.01" defaultValue={dollars(state.plan.threshold)} required/></span><small>For shared purchases. Personal spending stays personal.</small></label>
      <label>Our next check-in<input name="reviewDate" type="date" defaultValue={state.plan.reviewDate} required/></label>
      <label>Anything else we agreed?<textarea name="notes" maxLength={1200} rows={3} defaultValue={state.plan.notes} placeholder="How will we handle grocery overspending? What would make us revisit this sooner?"/></label>
      {stale && <p className="error">A newer version is available. Reopen this step before saving.</p>}
      <button className="button secondary full" disabled={busy || stale}>{busy ? 'Saving…' : 'Save these details'}<Check size={16}/></button><p className="fine-print">Saving a change creates a new version for both of you to review.</p>
    </form></div>;
}
function Checkin({ state, busy, onSave, onError }: { state: State; busy: boolean; onSave: (checkin: unknown) => Promise<unknown>; onError: (message: string) => void }) {
  const total = state.expenses.reduce((sum, row) => sum + row.amount, 0);
  function calendar() { const day = state.plan.reviewDate.replaceAll('-', ''); download('first-month-check-in.ics', ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//First Month//Check-in//EN', 'BEGIN:VEVENT', 'UID:' + state.id + '-' + day + '@firstmonth', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), 'DTSTART;VALUE=DATE:' + day, 'SUMMARY:Our First Month check-in', 'DESCRIPTION:Review shared expenses and what needs to change together.', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n'), 'text/calendar'); }
  return <div className="content-columns"><div><section className="surface checkin-date"><span className="section-icon"><CalendarDays size={25}/></span><div><p className="overline">OUR NEXT MOMENT TOGETHER</p><h2>{fullDate(state.plan.reviewDate)}</h2><p className="muted">Set aside a little time to see what’s working.</p></div><button className="text-button" onClick={calendar}><Plus size={16}/> Add to calendar</button></section><form className="surface checkin-form" onSubmit={async event => { event.preventDefault(); const form = event.currentTarget, f = new FormData(form); try { const result = await onSave({ date: String(f.get('date')), amount: parseMoney(f.get('amount')), note: String(f.get('note')) }); if (result) form.reset(); } catch (error) { onError((error as Error).message); } }}><h3>How did this month go?</h3><p className="muted small-text">Your plan was {money(total)} in shared expenses.</p><label>Check-in date<input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} required/></label><label>What did you actually spend together?<span className="money-input"><span>$</span><input name="amount" type="number" min="0" step="0.01" placeholder={dollars(total)} required/></span></label><label>What worked? What would you change?<textarea name="note" rows={3} maxLength={800} placeholder="Maybe groceries cost more than expected, or your transfer routine worked really well."/></label><button className="button primary" disabled={busy}>Save our check-in <Check size={16}/></button></form>
    {state.checkins.length > 0 && <section className="checkin-history"><h3>Your moments so far</h3>{[...state.checkins].reverse().map(entry => <article className="surface" key={entry.id}><div><strong>{fullDate(entry.date)}</strong><span>{money(entry.amount)} spent together</span></div><p>{entry.note || 'No note added.'}</p></article>)}</section>}</div><aside className="side-note"><span className="little-flower">✳</span><p className="overline">THREE GOOD QUESTIONS</p><h3>A check-in,<br/>not a scorecard.</h3><ol><li>What felt easy this month?</li><li>Did anything catch us off guard?</li><li>What would make next month feel better?</li></ol><hr/><p>If an income, expense, or priority changes, go back to your plan. You’ll both review the new version.</p></aside></div>;
}
