import { Router } from 'express'
import { getDb } from '../db/index.js'
import nodemailer from 'nodemailer'

export const emailRouter = Router()

/* ── helpers ── */

const SMTP_KEYS = ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'fromName', 'fromEmail', 'replyTo', 'subjectPrefix', 'signature']

function loadSmtpSettings(db) {
  const rows = db.prepare(
    `SELECT key, value FROM settings WHERE key IN (${SMTP_KEYS.map(() => '?').join(',')})`
  ).all(...SMTP_KEYS)
  const settings = {}
  for (const r of rows) {
    try { settings[r.key] = JSON.parse(r.value) } catch { settings[r.key] = r.value }
  }
  return settings
}

/* ── GET /api/email/settings ── */
emailRouter.get('/settings', (_req, res) => {
  const db = getDb()
  const s = loadSmtpSettings(db)
  // Never return password to client
  if (s.smtpPass) s.smtpPass = '••••••••'
  res.json(s)
})

/* ── PUT /api/email/settings ── */
emailRouter.put('/settings', (req, res) => {
  const db = getDb()
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  const tx = db.transaction((body) => {
    for (const [k, v] of Object.entries(body)) {
      if (SMTP_KEYS.includes(k) && v !== '••••••••') {
        upsert.run(k, JSON.stringify(v))
      }
    }
  })
  tx(req.body)
  const s = loadSmtpSettings(db)
  if (s.smtpPass) s.smtpPass = '••••••••'
  res.json(s)
})

/* ── POST /api/email/send ── */
emailRouter.post('/send', async (req, res) => {
  const { to, subject, body, prospectName } = req.body
  if (!to || !subject) {
    return res.status(400).json({ error: 'to and subject are required' })
  }

  const db = getDb()
  const s = loadSmtpSettings(db)

  if (!s.smtpHost || !s.smtpUser || !s.smtpPass) {
    return res.status(422).json({ error: 'SMTP not configured. Go to Management → Sales CRM → Settings.' })
  }

  const fullBody = body + (s.signature ? '\n\n' + s.signature : '')
  const subjectLine = (s.subjectPrefix ? s.subjectPrefix + ' ' : '') + subject

  try {
    const transport = nodemailer.createTransport({
      host: s.smtpHost,
      port: Number(s.smtpPort) || 587,
      secure: Number(s.smtpPort) === 465,
      auth: { user: s.smtpUser, pass: s.smtpPass },
    })

    const info = await transport.sendMail({
      from: s.fromName ? `"${s.fromName}" <${s.fromEmail || s.smtpUser}>` : (s.fromEmail || s.smtpUser),
      replyTo: s.replyTo || undefined,
      to,
      subject: subjectLine,
      text: fullBody,
    })

    res.json({
      ok: true,
      messageId: info.messageId,
      sentSubject: subjectLine,
      sentBody: fullBody,
    })
  } catch (err) {
    console.error('Email send failed:', err.message)
    res.status(502).json({ error: `Send failed: ${err.message}` })
  }
})
