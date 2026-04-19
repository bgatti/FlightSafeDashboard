import { useState, useMemo, useEffect } from 'react'
import { PIPELINE_STAGES, LEAD_SOURCES, CONTACT_TYPES, OPERATOR_PACKAGES, OPERATOR_LABELS, getSampleProspects } from './crmData'
import { fmt$ } from '../portal'
import { apiClient } from '../lib/apiClient'

/* ═══════════════════════════════════════════════════════════
   ProspectsBoard — Shared Sales CRM Component
   Used by MileHighGliding, MileHiSkydiving, JourneysBoulder
   ═══════════════════════════════════════════════════════════ */

/* ── Email settings — persisted on server via /api/email/settings ── */
function useEmailSettings() {
  const [settings, setSettings] = useState({})
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    apiClient.get('/email/settings').then(({ data }) => { setSettings(data); setLoaded(true) }).catch(() => setLoaded(true))
  }, [])
  const update = (next) => {
    setSettings(next)
    apiClient.put('/email/settings', next).catch(() => {})
  }
  return { settings, loaded, update }
}

const LS_KEY = (op) => `crm_prospects_${op}`

function loadProspects(operator) {
  try {
    const stored = JSON.parse(localStorage.getItem(LS_KEY(operator)))
    if (stored?.length) return stored
  } catch { /* ignore */ }
  const sample = getSampleProspects(operator)
  localStorage.setItem(LS_KEY(operator), JSON.stringify(sample))
  return sample
}

function saveProspects(operator, prospects) {
  localStorage.setItem(LS_KEY(operator), JSON.stringify(prospects))
}

/* ── Stage badge ── */
const STAGE_STYLES = {
  new:       'bg-sky-400/15 text-sky-400 border-sky-400/30',
  contacted: 'bg-violet-400/15 text-violet-400 border-violet-400/30',
  quoted:    'bg-amber-400/15 text-amber-400 border-amber-400/30',
  booked:    'bg-green-400/15 text-green-400 border-green-400/30',
  completed: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30',
  lost:      'bg-red-400/15 text-red-400 border-red-400/30',
}
const STAGE_DOT = {
  new: 'bg-sky-400', contacted: 'bg-violet-400', quoted: 'bg-amber-400',
  booked: 'bg-green-400', completed: 'bg-emerald-400', lost: 'bg-red-400',
}

function StageBadge({ stage }) {
  const s = PIPELINE_STAGES.find((p) => p.id === stage) || PIPELINE_STAGES[0]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border ${STAGE_STYLES[stage] || STAGE_STYLES.new}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STAGE_DOT[stage] || STAGE_DOT.new}`} />
      {s.label}
    </span>
  )
}

/* ── Source badge ── */
const SOURCE_ICONS = { website: '🌐', phone: '📞', 'walk-in': '🚶', referral: '🤝', social: '📱', event: '🎪', 'portal-booking': '💻' }

/* ── Quick-add form ── */
function QuickAdd({ operator, onAdd }) {
  const [open, setOpen] = useState(false)
  const packages = OPERATOR_PACKAGES[operator] || []
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'website', package: packages[0]?.id || '', groupSize: 1, notes: '' })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target?.value ?? e }))

  const submit = () => {
    if (!form.name.trim()) return
    const pkg = packages.find((p) => p.id === form.package)
    onAdd({
      id: `p-${operator}-${Date.now()}`,
      ...form,
      stage: 'new',
      value: (pkg?.price || 0) * (Number(form.groupSize) || 1),
      created: new Date().toISOString(),
      nextAction: '',
      contactLog: [],
    })
    setForm({ name: '', email: '', phone: '', source: 'website', package: packages[0]?.id || '', groupSize: 1, notes: '' })
    setOpen(false)
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 text-xs font-medium px-4 py-2 rounded-lg border border-sky-500/30 transition-colors">
      + New Lead
    </button>
  )

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-white text-sm font-semibold">New Lead</h4>
        <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 text-xs">Cancel</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input placeholder="Name *" value={form.name} onChange={set('name')} className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
        <input placeholder="Email" value={form.email} onChange={set('email')} className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
        <input placeholder="Phone" value={form.phone} onChange={set('phone')} className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <select value={form.source} onChange={set('source')} className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-sky-400 focus:outline-none">
          {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s.replace(/-/g, ' ')}</option>)}
        </select>
        <select value={form.package} onChange={set('package')} className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-sky-400 focus:outline-none">
          {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="number" min={1} placeholder="Group" value={form.groupSize} onChange={set('groupSize')} className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
        <button onClick={submit} className="bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold py-2 rounded-lg transition-colors">Add Lead</button>
      </div>
      <textarea placeholder="Notes..." value={form.notes} onChange={set('notes')} rows={2} className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none resize-none" />
    </div>
  )
}

/* ── Contact type helpers ── */
const CONTACT_TYPE_ICONS = Object.fromEntries(CONTACT_TYPES.map((t) => [t.id, t.icon]))
const CONTACT_TYPE_LABELS = Object.fromEntries(CONTACT_TYPES.map((t) => [t.id, t.label]))

/* ── Quick Note / Contact Log Entry ── */
function QuickNote({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('email')
  const [direction, setDirection] = useState('outbound')
  const [body, setBody] = useState('')

  const submit = () => {
    if (!body.trim()) return
    onAdd({ id: `cl-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, type, direction, body: body.trim(), at: new Date().toISOString() })
    setBody('')
    setOpen(false)
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="text-sky-400 text-[10px] hover:text-sky-300 transition-colors">+ Log contact</button>
  )

  return (
    <div className="bg-surface border border-surface-border rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className="bg-surface-card border border-surface-border rounded-lg px-2 py-1.5 text-[10px] text-slate-200 focus:border-sky-400 focus:outline-none">
          {CONTACT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
        </select>
        <div className="flex border border-surface-border rounded-lg overflow-hidden">
          <button onClick={() => setDirection('outbound')} className={`px-2 py-1 text-[10px] font-medium transition-colors ${direction === 'outbound' ? 'bg-sky-500/20 text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}>Out</button>
          <button onClick={() => setDirection('inbound')} className={`px-2 py-1 text-[10px] font-medium transition-colors ${direction === 'inbound' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>In</button>
        </div>
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="What happened? Keep it short — subject line, outcome, next step."
        className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none resize-none" />
      {/* Best practices reminder */}
      {(type === 'text' || type === 'email') && (
        <div className="text-slate-600 text-[9px] leading-relaxed px-1">
          {type === 'text'
            ? '📋 SMS: Get opt-in before texting. Include business name. Respect quiet hours (8a–9p). Include opt-out ("Reply STOP"). Keep under 160 chars. No all-caps.'
            : '📋 Email: Use clear subject line. Identify yourself + business. Include unsubscribe link for marketing. CAN-SPAM: honor opt-outs within 10 days. No misleading headers.'}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={submit} disabled={!body.trim()} className="bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[10px] font-semibold px-4 py-1.5 rounded-lg transition-colors">Log Entry</button>
        <button onClick={() => { setOpen(false); setBody('') }} className="text-slate-500 hover:text-slate-300 text-[10px]">Cancel</button>
      </div>
    </div>
  )
}

/* ── Contact Log timeline ── */
function ContactLog({ entries = [], onAdd }) {
  const sorted = [...entries].sort((a, b) => new Date(b.at) - new Date(a.at))
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-slate-500 text-[10px] uppercase tracking-wide">Contact Log ({entries.length})</label>
        <QuickNote onAdd={onAdd} />
      </div>
      {sorted.length === 0 ? (
        <div className="text-slate-700 text-[10px] italic py-3 text-center">No contacts logged yet</div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {sorted.map((e) => {
            const dt = new Date(e.at)
            const age = Math.max(0, Math.round((Date.now() - dt.getTime()) / 86400000))
            const timeLabel = age === 0 ? 'Today' : age === 1 ? 'Yesterday' : `${age}d ago`
            const dirColor = e.direction === 'inbound' ? 'text-emerald-400' : 'text-sky-400'
            const dirArrow = e.direction === 'inbound' ? '←' : '→'
            return (
              <div key={e.id} className="flex gap-2 items-start bg-surface border border-surface-border rounded-lg px-3 py-2 group">
                <span className="text-sm flex-shrink-0 mt-0.5">{CONTACT_TYPE_ICONS[e.type] || '📝'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-medium ${dirColor}`}>{dirArrow} {CONTACT_TYPE_LABELS[e.type] || e.type}</span>
                    <span className="text-slate-600 text-[9px]">{timeLabel}</span>
                  </div>
                  <div className="text-slate-300 text-[11px] leading-relaxed">{e.body}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Quick Reply — compose & send email via SMTP, log to contact history ── */
function QuickReply({ email, prospectName, onSent }) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const { settings } = useEmailSettings()

  const fromLabel = settings.fromName
    ? `${settings.fromName}${settings.fromEmail ? ' <' + settings.fromEmail + '>' : ''}`
    : settings.fromEmail || ''

  const send = async () => {
    if (!subject.trim()) return
    setSending(true)
    setError(null)
    try {
      const { data } = await apiClient.post('/email/send', {
        to: email,
        subject: subject.trim(),
        body: body.trim(),
        prospectName,
      })
      // Log the actual sent text to contact history
      onSent({
        id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: 'email',
        direction: 'outbound',
        body: `Subject: ${data.sentSubject}\n${data.sentBody}`,
        at: new Date().toISOString(),
      })
      setSubject('')
      setBody('')
      setOpen(false)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSending(false)
    }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-[10px] font-medium px-3 py-1.5 rounded-lg border border-sky-500/20 transition-colors">
      ✉️ Quick Reply
    </button>
  )

  return (
    <div className="bg-surface border border-sky-400/20 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-slate-500">
          To: <span className="text-slate-300">{email}</span>
          {fromLabel && <> · From: <span className="text-slate-300">{fromLabel}</span></>}
        </div>
        <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 text-xs">&times;</button>
      </div>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
        className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
        placeholder={`Hi ${prospectName?.split(' ')[0] || ''},\n\nThank you for your interest...`}
        className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none resize-none" />
      {settings.signature && (
        <div className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-[10px] text-slate-500 whitespace-pre-line">{settings.signature}</div>
      )}
      {error && (
        <div className="bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2 text-red-400 text-[10px]">{error}</div>
      )}
      {!settings.smtpHost && (
        <p className="text-amber-400/70 text-[9px]">SMTP not configured. Go to Management → Sales CRM → Settings to set up outbound email.</p>
      )}
      <div className="flex gap-2">
        <button onClick={send} disabled={!subject.trim() || sending}
          className="bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[10px] font-semibold px-4 py-1.5 rounded-lg transition-colors">
          {sending ? 'Sending...' : 'Send Email'}
        </button>
        <button onClick={() => { setOpen(false); setSubject(''); setBody(''); setError(null) }} className="text-slate-500 hover:text-slate-300 text-[10px]">Cancel</button>
      </div>
    </div>
  )
}

/* ── Email Settings Panel (exported for Management page) ── */
export function EmailSettingsPanel() {
  const { settings, loaded, update } = useEmailSettings()
  const [testStatus, setTestStatus] = useState(null)
  const set = (k) => (e) => update({ ...settings, [k]: e.target.value })

  const testConnection = async () => {
    setTestStatus('testing')
    try {
      await apiClient.post('/email/send', {
        to: settings.fromEmail || settings.smtpUser,
        subject: 'CRM Test — SMTP connection verified',
        body: 'This is a test email from your FlightSafe CRM. If you received this, your SMTP settings are working correctly.',
      })
      setTestStatus('ok')
    } catch (err) {
      setTestStatus(err.response?.data?.error || err.message)
    }
  }

  if (!loaded) return <div className="text-slate-500 text-sm py-8 text-center">Loading settings...</div>

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-white font-semibold text-sm mb-1">Email Configuration</h3>
        <p className="text-slate-500 text-xs">Configure SMTP to send emails directly from the CRM. The full sent text is logged in each prospect's contact history.</p>
      </div>

      {/* SMTP server */}
      <div className="bg-surface border border-surface-border rounded-xl p-4 space-y-3">
        <h4 className="text-white text-xs font-semibold">SMTP Server</h4>
        <p className="text-slate-500 text-[11px] leading-relaxed">Your outbound mail server. For Gmail use <code className="text-slate-400">smtp.gmail.com</code> port <code className="text-slate-400">587</code> with an App Password. For Outlook use <code className="text-slate-400">smtp.office365.com</code> port <code className="text-slate-400">587</code>.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-slate-500 text-[10px] uppercase tracking-wide">SMTP Host</label>
            <input value={settings.smtpHost || ''} onChange={set('smtpHost')} placeholder="smtp.gmail.com"
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none mt-1" />
          </div>
          <div>
            <label className="text-slate-500 text-[10px] uppercase tracking-wide">SMTP Port</label>
            <input value={settings.smtpPort || ''} onChange={set('smtpPort')} placeholder="587"
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none mt-1" />
          </div>
          <div>
            <label className="text-slate-500 text-[10px] uppercase tracking-wide">Username / Email</label>
            <input value={settings.smtpUser || ''} onChange={set('smtpUser')} placeholder="you@gmail.com"
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none mt-1" />
          </div>
          <div>
            <label className="text-slate-500 text-[10px] uppercase tracking-wide">Password / App Password</label>
            <input type="password" value={settings.smtpPass || ''} onChange={set('smtpPass')} placeholder="••••••••"
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none mt-1" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={testConnection} disabled={!settings.smtpHost || !settings.smtpUser || testStatus === 'testing'}
            className="bg-sky-500/15 hover:bg-sky-500/25 disabled:opacity-40 text-sky-400 text-[10px] font-medium px-4 py-1.5 rounded-lg border border-sky-500/20 transition-colors">
            {testStatus === 'testing' ? 'Sending test...' : 'Send Test Email'}
          </button>
          {testStatus === 'ok' && <span className="text-emerald-400 text-[10px]">Test email sent successfully</span>}
          {testStatus && testStatus !== 'ok' && testStatus !== 'testing' && <span className="text-red-400 text-[10px]">{testStatus}</span>}
        </div>
      </div>

      {/* Sender identity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-slate-500 text-[10px] uppercase tracking-wide">Sender Name</label>
          <input value={settings.fromName || ''} onChange={set('fromName')} placeholder="e.g. Linda Foster"
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none mt-1" />
        </div>
        <div>
          <label className="text-slate-500 text-[10px] uppercase tracking-wide">From Email</label>
          <input type="email" value={settings.fromEmail || ''} onChange={set('fromEmail')} placeholder="e.g. linda@journeysaviation.com"
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none mt-1" />
        </div>
        <div>
          <label className="text-slate-500 text-[10px] uppercase tracking-wide">Reply-To <span className="text-slate-600 normal-case">(optional)</span></label>
          <input type="email" value={settings.replyTo || ''} onChange={set('replyTo')} placeholder="e.g. info@journeysaviation.com"
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none mt-1" />
        </div>
        <div>
          <label className="text-slate-500 text-[10px] uppercase tracking-wide">Subject Prefix <span className="text-slate-600 normal-case">(optional)</span></label>
          <input value={settings.subjectPrefix || ''} onChange={set('subjectPrefix')} placeholder="e.g. [Journeys Aviation]"
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none mt-1" />
        </div>
      </div>

      {/* Signature */}
      <div>
        <label className="text-slate-500 text-[10px] uppercase tracking-wide">Email Signature</label>
        <textarea value={settings.signature || ''} onChange={set('signature')} rows={4}
          placeholder={"Best regards,\nLinda Foster\nCFI / CFII\nJourneys Aviation · (303) 530-7662\njourneysaviation.com"}
          className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none mt-1 resize-none font-mono" />
      </div>

      {/* How it works */}
      <div className="bg-surface border border-surface-border rounded-xl p-4">
        <h4 className="text-white text-xs font-semibold mb-2">How Quick Reply Works</h4>
        <div className="space-y-2 text-slate-400 text-[11px] leading-relaxed">
          <p>When you click <strong className="text-slate-200">Quick Reply</strong> on a prospect with an email address, the CRM sends the email directly through your SMTP server — no external email client needed.</p>
          <p>The <strong className="text-slate-200">exact subject, body, and signature</strong> are logged in the prospect's contact history, so your team sees the full conversation thread.</p>
          <p>The server never stores the email body — it sends via SMTP and returns the sent text to the client for logging in the prospect record.</p>
        </div>
      </div>

      <p className="text-emerald-400/60 text-[10px]">Settings auto-save to the server as you type.</p>
    </div>
  )
}

/* ── Prospect detail / edit modal ── */
function ProspectDetail({ prospect, operator, onUpdate, onClose }) {
  const [form, setForm] = useState({ ...prospect })
  const packages = OPERATOR_PACKAGES[operator] || []
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target?.value ?? e }))
  const activeStages = PIPELINE_STAGES.filter((s) => s.id !== 'lost')

  const save = () => {
    const pkg = packages.find((p) => p.id === form.package)
    onUpdate({ ...form, value: (pkg?.price || 0) * (Number(form.groupSize) || 1) })
    onClose()
  }

  const addContactEntry = (entry) => {
    setForm((f) => ({ ...f, contactLog: [...(f.contactLog || []), entry] }))
  }

  const age = Math.max(0, Math.round((Date.now() - new Date(prospect.created).getTime()) / 86400000))

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-3xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-white text-lg font-bold">{prospect.name}</h3>
              <p className="text-slate-500 text-xs">{age} day{age !== 1 ? 's' : ''} in pipeline · {SOURCE_ICONS[prospect.source]} {prospect.source}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none">&times;</button>
          </div>

          {/* Stage selector */}
          <div>
            <label className="text-slate-500 text-[10px] uppercase tracking-wide">Stage</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {PIPELINE_STAGES.map((s) => (
                <button key={s.id} onClick={() => setForm((f) => ({ ...f, stage: s.id }))}
                  className={`text-[10px] font-medium px-3 py-1 rounded-full border transition-all ${form.stage === s.id ? STAGE_STYLES[s.id] + ' ring-1 ' + (s.id === 'new' ? 'ring-sky-400/40' : s.id === 'contacted' ? 'ring-violet-400/40' : s.id === 'quoted' ? 'ring-amber-400/40' : s.id === 'booked' ? 'ring-green-400/40' : s.id === 'completed' ? 'ring-emerald-400/40' : 'ring-red-400/40') : 'border-surface-border text-slate-500 hover:text-slate-300'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-500 text-[10px] uppercase tracking-wide">Email</label>
              <input value={form.email} onChange={set('email')} className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-sky-400 focus:outline-none mt-1" />
            </div>
            <div>
              <label className="text-slate-500 text-[10px] uppercase tracking-wide">Phone</label>
              <input value={form.phone} onChange={set('phone')} className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-sky-400 focus:outline-none mt-1" />
            </div>
          </div>

          {/* Quick Reply */}
          {form.email && (
            <QuickReply email={form.email} prospectName={form.name} onSent={addContactEntry} />
          )}

          {/* Package / group */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-slate-500 text-[10px] uppercase tracking-wide">Package</label>
              <select value={form.package} onChange={set('package')} className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-sky-400 focus:outline-none mt-1">
                {packages.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmt$(p.price)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-500 text-[10px] uppercase tracking-wide">Group</label>
              <input type="number" min={1} value={form.groupSize} onChange={set('groupSize')} className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-sky-400 focus:outline-none mt-1" />
            </div>
          </div>

          {/* Value */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Est. Value:</span>
            <span className="text-green-400 font-bold">{fmt$((packages.find((p) => p.id === form.package)?.price || 0) * (Number(form.groupSize) || 1))}</span>
          </div>

          {/* Contact Log */}
          <ContactLog entries={form.contactLog || []} onAdd={addContactEntry} />

          {/* Notes */}
          <div>
            <label className="text-slate-500 text-[10px] uppercase tracking-wide">Notes</label>
            <textarea value={form.notes || ''} onChange={set('notes')} rows={3} className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-sky-400 focus:outline-none mt-1 resize-none" />
          </div>

          {/* Next action */}
          <div>
            <label className="text-slate-500 text-[10px] uppercase tracking-wide">Next Action</label>
            <input value={form.nextAction || ''} onChange={set('nextAction')} placeholder="e.g. Call back Tuesday, send pricing PDF..." className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none mt-1" />
          </div>

          {/* Save */}
          <div className="flex gap-2 pt-2">
            <button onClick={save} className="flex-1 bg-sky-500 hover:bg-sky-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Save Changes</button>
            <button onClick={onClose} className="px-6 border border-surface-border hover:border-slate-500 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Kanban column ── */
function KanbanColumn({ stage, prospects, onSelect }) {
  const total = prospects.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="flex-1 min-w-[200px]">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${STAGE_DOT[stage.id]}`} />
          <span className="text-white text-xs font-semibold">{stage.label}</span>
          <span className="text-slate-600 text-[10px]">{prospects.length}</span>
        </div>
        {total > 0 && <span className="text-green-400/70 text-[10px] font-mono">{fmt$(total)}</span>}
      </div>
      <div className="space-y-2">
        {prospects.map((p) => {
          const age = Math.max(0, Math.round((Date.now() - new Date(p.created).getTime()) / 86400000))
          const pkg = OPERATOR_PACKAGES[p.operator]?.find((pk) => pk.id === p.package) || (OPERATOR_PACKAGES.mhg.concat(OPERATOR_PACKAGES.skydiving, OPERATOR_PACKAGES.journeys)).find((pk) => pk.id === p.package)
          return (
            <div key={p.id} onClick={() => onSelect(p)} className="bg-surface-card border border-surface-border rounded-xl p-3 cursor-pointer hover:border-sky-400/30 transition-all group">
              <div className="flex items-start justify-between mb-1">
                <span className="text-white text-xs font-semibold group-hover:text-sky-300 transition-colors">{p.name}</span>
                <span className="text-green-400 text-[10px] font-mono font-bold">{fmt$(p.value)}</span>
              </div>
              <div className="text-slate-500 text-[10px] mb-1.5">{SOURCE_ICONS[p.source]} {p.source} · {age}d ago{p.groupSize > 1 ? ` · ${p.groupSize} pax` : ''}{p.contactLog?.length ? ` · ${p.contactLog.length} contact${p.contactLog.length !== 1 ? 's' : ''}` : ''}</div>
              {pkg && <div className="text-slate-400 text-[10px]">{pkg.name}</div>}
              {p.nextAction && <div className="mt-1.5 text-sky-400/70 text-[10px] italic truncate">→ {p.nextAction}</div>}
            </div>
          )
        })}
        {prospects.length === 0 && <div className="text-slate-700 text-[10px] text-center py-4 italic">No prospects</div>}
      </div>
    </div>
  )
}

/* ── Table row ── */
function ProspectRow({ prospect, operator, onSelect }) {
  const age = Math.max(0, Math.round((Date.now() - new Date(prospect.created).getTime()) / 86400000))
  const packages = OPERATOR_PACKAGES[operator] || []
  const pkg = packages.find((p) => p.id === prospect.package)
  return (
    <tr onClick={() => onSelect(prospect)} className="hover:bg-surface-card/50 cursor-pointer transition-colors border-b border-surface-border/50">
      <td className="py-2.5 px-3 text-xs text-white font-medium">{prospect.name}</td>
      <td className="py-2.5 px-3"><StageBadge stage={prospect.stage} /></td>
      <td className="py-2.5 px-3 text-xs text-slate-400">{SOURCE_ICONS[prospect.source]} {prospect.source}</td>
      <td className="py-2.5 px-3 text-xs text-slate-400">{pkg?.name || '—'}</td>
      <td className="py-2.5 px-3 text-xs text-green-400 font-mono">{fmt$(prospect.value)}</td>
      <td className="py-2.5 px-3 text-xs text-slate-500">{age}d</td>
      <td className="py-2.5 px-3 text-xs text-sky-400/70 truncate max-w-[180px]">{prospect.nextAction || '—'}</td>
    </tr>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN EXPORT — ProspectsBoard
   ═══════════════════════════════════════════════════════════ */

export function ProspectsBoard({ operator, heading, subtitle }) {
  const [prospects, setProspects] = useState(() => loadProspects(operator))
  const [view, setView] = useState('kanban') // 'kanban' | 'table'
  const [filterStage, setFilterStage] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const persist = (next) => { setProspects(next); saveProspects(operator, next) }

  const addProspect = (p) => persist([{ ...p, operator }, ...prospects])

  const updateProspect = (updated) => {
    persist(prospects.map((p) => p.id === updated.id ? updated : p))
  }

  const filtered = useMemo(() => {
    let list = prospects
    if (filterStage !== 'all') list = list.filter((p) => p.stage === filterStage)
    if (filterSource !== 'all') list = list.filter((p) => p.source === filterSource)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.notes?.toLowerCase().includes(q))
    }
    return list
  }, [prospects, filterStage, filterSource, search])

  // Pipeline stats
  const activeStages = PIPELINE_STAGES.filter((s) => s.id !== 'completed' && s.id !== 'lost')
  const pipelineValue = prospects.filter((p) => p.stage !== 'completed' && p.stage !== 'lost').reduce((s, p) => s + (p.value || 0), 0)
  const bookedValue = prospects.filter((p) => p.stage === 'booked').reduce((s, p) => s + (p.value || 0), 0)
  const completedValue = prospects.filter((p) => p.stage === 'completed').reduce((s, p) => s + (p.value || 0), 0)

  return (
    <section id="sec-prospects" className="py-16 px-4 sm:px-6 bg-gradient-to-b from-surface to-surface-card/30">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">{heading || 'Sales Pipeline'}</h2>
            <p className="text-slate-400 text-sm mt-1">{subtitle || `${OPERATOR_LABELS[operator]} — prospect tracking & follow-up`}</p>
          </div>
          <QuickAdd operator={operator} onAdd={addProspect} />
        </div>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Active Leads', value: prospects.filter((p) => !['completed', 'lost'].includes(p.stage)).length, color: 'sky' },
            { label: 'Pipeline Value', value: fmt$(pipelineValue), color: 'amber' },
            { label: 'Booked Revenue', value: fmt$(bookedValue), color: 'green' },
            { label: 'Completed Revenue', value: fmt$(completedValue), color: 'emerald' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-surface-card border border-surface-border rounded-xl p-4">
              <div className="text-slate-500 text-[10px] uppercase tracking-wide">{kpi.label}</div>
              <div className={`text-${kpi.color}-400 text-xl font-bold mt-1`}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, notes..."
            className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none w-full sm:w-64" />
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-sky-400 focus:outline-none">
            <option value="all">All stages</option>
            {PIPELINE_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-sky-400 focus:outline-none">
            <option value="all">All sources</option>
            {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s.replace(/-/g, ' ')}</option>)}
          </select>
          <div className="flex ml-auto border border-surface-border rounded-lg overflow-hidden">
            <button onClick={() => setView('kanban')} className={`px-3 py-2 text-xs font-medium transition-colors ${view === 'kanban' ? 'bg-sky-500/20 text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}>Board</button>
            <button onClick={() => setView('table')} className={`px-3 py-2 text-xs font-medium transition-colors ${view === 'table' ? 'bg-sky-500/20 text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}>Table</button>
          </div>
        </div>

        {/* Kanban view */}
        {view === 'kanban' && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {PIPELINE_STAGES.map((stage) => (
              <KanbanColumn key={stage.id} stage={stage} prospects={filtered.filter((p) => p.stage === stage.id)} onSelect={setSelected} />
            ))}
          </div>
        )}

        {/* Table view */}
        {view === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-border text-slate-500 text-[10px] uppercase tracking-wide">
                  <th className="py-2 px-3 text-left font-medium">Name</th>
                  <th className="py-2 px-3 text-left font-medium">Stage</th>
                  <th className="py-2 px-3 text-left font-medium">Source</th>
                  <th className="py-2 px-3 text-left font-medium">Package</th>
                  <th className="py-2 px-3 text-left font-medium">Value</th>
                  <th className="py-2 px-3 text-left font-medium">Age</th>
                  <th className="py-2 px-3 text-left font-medium">Next Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => <ProspectRow key={p.id} prospect={p} operator={operator} onSelect={setSelected} />)}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-slate-600 py-8 text-sm">No prospects match your filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Detail modal */}
        {selected && (
          <ProspectDetail prospect={selected} operator={operator} onUpdate={updateProspect} onClose={() => setSelected(null)} />
        )}
      </div>
    </section>
  )
}
