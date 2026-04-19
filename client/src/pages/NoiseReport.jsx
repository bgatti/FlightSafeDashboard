import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconMapPin,
  IconMicrophone,
  IconVideo,
  IconCheck,
  IconArrowRight,
  IconArrowLeft,
  IconReload,
  IconPlayerPlay,
  IconPlayerStopFilled,
  IconSparkles,
  IconTrophy,
  IconX,
} from '@tabler/icons-react'
import { FRNAA_AIRPORTS } from '../frnaa/frnaaData'
import { fetchActiveExcursions, KLASS_COLORS } from '../lib/noiseApi'

/* ─── Scoring ─────────────────────────────────────────────────────────────── */
const POINTS = {
  location: { city: 1, cross: 3, precise: 5 },
  media:    { audio: 3, video: 5 },
}

/* ─── Cross-street lookup (Overpass) ──────────────────────────────────────── */
const OVERPASS_MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

async function fetchNearestCrossStreet(lat, lng, { signal } = {}) {
  const q =
    `[out:json][timeout:10];` +
    `way(around:400,${lat},${lng})[highway][name];` +
    `out tags geom;`
  for (const url of OVERPASS_MIRRORS) {
    const ctrl = new AbortController()
    const onAbort = () => ctrl.abort()
    signal?.addEventListener('abort', onAbort)
    const timer = setTimeout(() => ctrl.abort(), 8000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(q),
        signal: ctrl.signal,
      })
      if (!res.ok) continue
      const data = await res.json()
      const buckets = new Map()
      for (const w of data.elements || []) {
        const name = w.tags?.name
        if (!name || !w.geometry) continue
        for (const p of w.geometry) {
          const key = `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`
          let b = buckets.get(key)
          if (!b) { b = { lat: p.lat, lng: p.lon, names: new Set() }; buckets.set(key, b) }
          b.names.add(name)
        }
      }
      let best = null
      let bestDist = Infinity
      for (const b of buckets.values()) {
        if (b.names.size < 2) continue
        const d = haversine(lat, lng, b.lat, b.lng)
        if (d < bestDist) { bestDist = d; best = b }
      }
      if (best) return { names: [...best.names].slice(0, 2), distanceMeters: bestDist }
      return null
    } catch (err) {
      if (signal?.aborted) throw err
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }
  throw new Error('overpass unavailable')
}

/* ─── Main page ───────────────────────────────────────────────────────────── */
export function NoiseReport() {
  const [step, setStep] = useState(1)

  // Region + location
  const [regionId, setRegionId] = useState('KBJC')
  const [rawCoords, setRawCoords] = useState(null) // { lat, lng, accuracy }
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState(null)

  // Precision
  const [precision, setPrecision] = useState('cross')
  const [crossStreet, setCrossStreet] = useState(null)
  const [crossLoading, setCrossLoading] = useState(false)

  // Media
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [recordingAudio, setRecordingAudio] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)

  const [videoBlob, setVideoBlob] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [recordingVideo, setRecordingVideo] = useState(false)
  const [videoSeconds, setVideoSeconds] = useState(0)
  const [videoError, setVideoError] = useState(null)
  const [audioError, setAudioError] = useState(null)

  const [submitted, setSubmitted] = useState(false)

  // Active excursions (from noise-api)
  const [activeList, setActiveList] = useState([])
  const [activeStatus, setActiveStatus] = useState('idle')
  const [selectedExcursion, setSelectedExcursion] = useState(null) // full excursion object or null

  // Refs
  const audioRecRef = useRef(null)
  const audioStreamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const audioAnalyserRef = useRef(null)
  const audioRafRef = useRef(null)
  const audioStartRef = useRef(0)

  const videoRecRef = useRef(null)
  const videoStreamRef = useRef(null)
  const videoPreviewRef = useRef(null)
  const videoTimerRef = useRef(null)

  const region = FRNAA_AIRPORTS.find((a) => a.id === regionId)

  /* ── Location request ─────────────────────────────────────────────────── */
  function requestLocation() {
    setLocating(true)
    setLocationError(null)
    if (!navigator.geolocation) {
      setLocationError('Geolocation not available')
      setLocating(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRawCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 0,
        })
        setLocating(false)
      },
      (err) => {
        setLocationError(err.code === 1 ? 'Permission denied' : 'Location unavailable')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 },
    )
  }

  /* ── Load the active excursions list (from noise API) ───────────────── */
  useEffect(() => {
    const ctrl = new AbortController()
    setActiveStatus('loading')
    fetchActiveExcursions({ hours: 48, signal: ctrl.signal })
      .then((data) => {
        if (ctrl.signal.aborted) return
        setActiveList(data.active || [])
        setActiveStatus('ok')
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setActiveStatus('error')
      })
    return () => ctrl.abort()
  }, [])

  /* ── Deep link: /noise-report?tail=XYZ preselects the excursion ─────── */
  useEffect(() => {
    if (activeStatus !== 'ok' || selectedExcursion) return
    const params = new URLSearchParams(window.location.search)
    const tail = params.get('tail')
    if (!tail) return
    const match = activeList.find((a) => a.tail === tail)
    if (match) setSelectedExcursion(match)
  }, [activeList, activeStatus, selectedExcursion])

  /* ── Cross-street lookup when the user picks that tier ───────────────── */
  useEffect(() => {
    if (!rawCoords || precision !== 'cross' || crossStreet) return
    const ctrl = new AbortController()
    setCrossLoading(true)
    fetchNearestCrossStreet(rawCoords.lat, rawCoords.lng, { signal: ctrl.signal })
      .then((r) => { if (!ctrl.signal.aborted) setCrossStreet(r) })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setCrossLoading(false) })
    return () => ctrl.abort()
  }, [rawCoords, precision, crossStreet])

  /* ── Displayed location ──────────────────────────────────────────────── */
  const displayedLocation = useMemo(() => {
    if (!rawCoords) return null
    if (precision === 'city') {
      const lat = Math.round(rawCoords.lat * 100) / 100
      const lng = Math.round(rawCoords.lng * 100) / 100
      return { text: `~${lat.toFixed(2)}, ${lng.toFixed(2)}`, detail: 'General area (±1 km)' }
    }
    if (precision === 'cross') {
      if (crossStreet) {
        return {
          text: crossStreet.names.join(' & '),
          detail: `nearest intersection · ≈${Math.round(crossStreet.distanceMeters)} m away`,
        }
      }
      return { text: crossLoading ? 'Looking up intersection…' : 'No intersection found', detail: '' }
    }
    return {
      text: `${rawCoords.lat.toFixed(5)}, ${rawCoords.lng.toFixed(5)}`,
      detail: `Precise GPS · ±${Math.round(rawCoords.accuracy)} m`,
    }
  }, [rawCoords, precision, crossStreet, crossLoading])

  /* ── Audio recording (5 sec auto-stop) ──────────────────────────────── */
  async function startAudio() {
    setAudioError(null)
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); setAudioBlob(null) }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream
      const ACtx = window.AudioContext || window.webkitAudioContext
      const ctx = new ACtx()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      audioCtxRef.current = ctx
      audioAnalyserRef.current = analyser

      const rec = new MediaRecorder(stream)
      const chunks = []
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        teardownAudio()
      }
      audioRecRef.current = rec
      audioStartRef.current = Date.now()
      rec.start()
      setRecordingAudio(true)
      tickAudio()
      setTimeout(() => {
        if (rec.state === 'recording') rec.stop()
      }, 5000)
    } catch (err) {
      setAudioError(err.message || 'Microphone access denied')
      teardownAudio()
    }
  }

  function tickAudio() {
    const analyser = audioAnalyserRef.current
    if (!analyser) return
    const data = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128
      sum += v * v
    }
    const rms = Math.sqrt(sum / data.length)
    setAudioLevel(Math.min(1, rms * 3.5))
    const elapsed = (Date.now() - audioStartRef.current) / 1000
    setAudioProgress(Math.min(1, elapsed / 5))
    audioRafRef.current = requestAnimationFrame(tickAudio)
  }

  function teardownAudio() {
    setRecordingAudio(false)
    setAudioLevel(0)
    if (audioRafRef.current) { cancelAnimationFrame(audioRafRef.current); audioRafRef.current = null }
    if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach((t) => t.stop()); audioStreamRef.current = null }
    if (audioCtxRef.current) { try { audioCtxRef.current.close() } catch {} audioCtxRef.current = null }
    audioAnalyserRef.current = null
  }

  /* ── Video recording ─────────────────────────────────────────────────── */
  async function startVideo() {
    setVideoError(null)
    if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null); setVideoBlob(null) }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: true,
      })
      videoStreamRef.current = stream
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream
        videoPreviewRef.current.muted = true
        await videoPreviewRef.current.play().catch(() => {})
      }
      const mimeCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
      const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || ''
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      const chunks = []
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' })
        setVideoBlob(blob)
        setVideoUrl(URL.createObjectURL(blob))
        teardownVideo()
      }
      videoRecRef.current = rec
      rec.start()
      setRecordingVideo(true)
      setVideoSeconds(0)
      videoTimerRef.current = setInterval(() => {
        setVideoSeconds((s) => {
          const n = s + 1
          if (n >= 15 && rec.state === 'recording') rec.stop()
          return n
        })
      }, 1000)
    } catch (err) {
      setVideoError(err.message || 'Camera access denied')
      teardownVideo()
    }
  }

  function stopVideo() {
    if (videoRecRef.current?.state === 'recording') videoRecRef.current.stop()
  }

  function teardownVideo() {
    setRecordingVideo(false)
    if (videoTimerRef.current) { clearInterval(videoTimerRef.current); videoTimerRef.current = null }
    if (videoStreamRef.current) { videoStreamRef.current.getTracks().forEach((t) => t.stop()); videoStreamRef.current = null }
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null
  }

  /* ── Scoring ─────────────────────────────────────────────────────────── */
  const score = useMemo(() => {
    let total = 0
    const breakdown = []
    if (videoBlob) {
      total += POINTS.media.video
      breakdown.push({ label: 'Video evidence', pts: POINTS.media.video })
    } else if (audioBlob) {
      total += POINTS.media.audio
      breakdown.push({ label: 'Audio recording', pts: POINTS.media.audio })
    }
    if (rawCoords) {
      const p = POINTS.location[precision]
      const lbl = precision === 'city'
        ? 'Approximate area'
        : precision === 'cross'
        ? 'Nearest cross street'
        : 'Precise GPS location'
      total += p
      breakdown.push({ label: lbl, pts: p })
    }
    return { total, max: 10, breakdown }
  }, [audioBlob, videoBlob, rawCoords, precision])

  const tier = score.total >= 9 ? 'Exceptional' : score.total >= 6 ? 'Strong' : score.total >= 3 ? 'Useful' : 'Minimal'
  const tierColor =
    score.total >= 9 ? 'text-emerald-300'
    : score.total >= 6 ? 'text-sky-300'
    : score.total >= 3 ? 'text-amber-300'
    : 'text-neutral-400'

  /* ── Cleanup on unmount ──────────────────────────────────────────────── */
  useEffect(() => () => { teardownAudio(); teardownVideo() }, [])

  /* ── Step navigation guards ──────────────────────────────────────────── */
  const canLeaveStep1 = !!rawCoords
  const canSubmit = !!rawCoords && (audioBlob || videoBlob)

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-black to-slate-950 text-neutral-100 flex flex-col">
      <Header step={step} />

      <main className="flex-1 flex items-start justify-center px-4 py-6">
        <div className="w-full max-w-xl">
          {submitted ? (
            <SubmittedCard
              score={score}
              region={region}
              onReset={() => {
                setSubmitted(false); setStep(1)
                setAudioBlob(null); setAudioUrl(null)
                setVideoBlob(null); setVideoUrl(null)
                setRawCoords(null); setCrossStreet(null)
              }}
            />
          ) : (
            <>
              {step === 1 && (
                <Step1Region
                  region={region}
                  regionId={regionId}
                  setRegionId={setRegionId}
                  rawCoords={rawCoords}
                  locating={locating}
                  locationError={locationError}
                  requestLocation={requestLocation}
                  onSubmit={() => setStep(2)}
                  canLeave={canLeaveStep1}
                />
              )}

              {step === 2 && (
                <Step2Capture
                  recordingAudio={recordingAudio}
                  audioProgress={audioProgress}
                  audioLevel={audioLevel}
                  audioBlob={audioBlob}
                  audioUrl={audioUrl}
                  audioError={audioError}
                  startAudio={startAudio}
                  recordingVideo={recordingVideo}
                  videoSeconds={videoSeconds}
                  videoBlob={videoBlob}
                  videoUrl={videoUrl}
                  videoError={videoError}
                  videoPreviewRef={videoPreviewRef}
                  startVideo={startVideo}
                  stopVideo={stopVideo}
                  precision={precision}
                  setPrecision={setPrecision}
                  displayedLocation={displayedLocation}
                  activeList={activeList}
                  activeStatus={activeStatus}
                  selectedExcursion={selectedExcursion}
                  setSelectedExcursion={setSelectedExcursion}
                />
              )}

              {step === 3 && (
                <Step3Review
                  region={region}
                  displayedLocation={displayedLocation}
                  audioUrl={audioUrl}
                  videoUrl={videoUrl}
                  score={score}
                  tier={tier}
                  tierColor={tierColor}
                  selectedExcursion={selectedExcursion}
                />
              )}

              <WizardNav
                step={step}
                onBack={() => setStep((s) => Math.max(1, s - 1))}
                onNext={() => setStep((s) => Math.min(3, s + 1))}
                onSubmit={() => setSubmitted(true)}
                canNext={step === 1 ? canLeaveStep1 : true}
                canSubmit={canSubmit}
              />
            </>
          )}
        </div>
      </main>
    </div>
  )
}

/* ─── Header ──────────────────────────────────────────────────────────────── */
function Header({ step }) {
  const steps = [
    { n: 1, label: 'Region' },
    { n: 2, label: 'Capture' },
    { n: 3, label: 'Review' },
  ]
  return (
    <header className="w-full border-b border-white/5 bg-black/40 backdrop-blur-md">
      <div className="max-w-xl mx-auto px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Aircraft Noise</p>
        <h1 className="text-xl font-semibold text-neutral-100 mt-0.5">File a Noise Report</h1>

        <ol className="flex items-center gap-2 mt-4">
          {steps.map((s, i) => {
            const active = step === s.n
            const done = step > s.n
            return (
              <li key={s.n} className="flex-1 flex items-center gap-2">
                <div
                  className={[
                    'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors',
                    done ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                      : active ? 'bg-sky-400/20 text-sky-300 border border-sky-400/40'
                      : 'bg-white/5 text-neutral-500 border border-white/10',
                  ].join(' ')}
                >
                  {done ? <IconCheck size={12} stroke={3} /> : s.n}
                </div>
                <span
                  className={[
                    'text-[11px] tracking-wide',
                    active ? 'text-neutral-100' : done ? 'text-neutral-300' : 'text-neutral-500',
                  ].join(' ')}
                >
                  {s.label}
                </span>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-px ${done ? 'bg-emerald-400/40' : 'bg-white/10'}`} />
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </header>
  )
}

/* ─── Step 1: Region + request location ──────────────────────────────────── */
function Step1Region({ region, regionId, setRegionId, rawCoords, locating, locationError, requestLocation, onSubmit, canLeave }) {
  return (
    <section className="space-y-5">
      <Card title="Region" subtitle="Select the airfield closest to where you heard the aircraft">
        <div className="grid grid-cols-1 gap-2">
          {FRNAA_AIRPORTS.map((a) => {
            const active = a.id === regionId
            return (
              <button
                key={a.id}
                onClick={() => setRegionId(a.id)}
                className={[
                  'text-left rounded-lg px-3 py-2.5 border transition-colors',
                  active
                    ? 'border-sky-400/60 bg-sky-400/10'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-neutral-100">{a.icao} · {a.name}</div>
                    <div className="text-[11px] text-neutral-500">{a.city}</div>
                  </div>
                  {active && <IconCheck size={16} className="text-sky-300" />}
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      <Card title="Your Location" subtitle="We need this to route the report to the right office and inspector">
        {!rawCoords && (
          <button
            onClick={requestLocation}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-sky-500/90 hover:bg-sky-500 text-white font-medium py-3 transition-colors disabled:opacity-50"
          >
            <IconMapPin size={18} />
            {locating ? 'Requesting location…' : 'Request my location'}
          </button>
        )}
        {rawCoords && (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-3">
            <IconCheck size={18} className="text-emerald-300 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-neutral-100 font-medium">Location captured</div>
              <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                {rawCoords.lat.toFixed(5)}, {rawCoords.lng.toFixed(5)} · ±{Math.round(rawCoords.accuracy)}m
              </div>
            </div>
            <button
              onClick={requestLocation}
              className="text-[11px] text-neutral-400 hover:text-neutral-200 flex items-center gap-1"
            >
              <IconReload size={12} /> redo
            </button>
          </div>
        )}
        {locationError && (
          <div className="mt-2 text-xs text-rose-300">{locationError}</div>
        )}
      </Card>

      <button
        onClick={onSubmit}
        disabled={!canLeave}
        className={[
          'w-full flex items-center justify-center gap-2 rounded-lg py-3 font-semibold transition-colors',
          canLeave
            ? 'bg-white text-black hover:bg-neutral-200'
            : 'bg-white/10 text-neutral-500 cursor-not-allowed',
        ].join(' ')}
      >
        Start report
        <IconArrowRight size={18} />
      </button>
    </section>
  )
}

/* ─── Step 2: Capture media + precision ──────────────────────────────────── */
function Step2Capture(props) {
  const {
    recordingAudio, audioProgress, audioLevel, audioBlob, audioUrl, audioError, startAudio,
    recordingVideo, videoSeconds, videoBlob, videoUrl, videoError, videoPreviewRef, startVideo, stopVideo,
    precision, setPrecision, displayedLocation,
    activeList, activeStatus, selectedExcursion, setSelectedExcursion,
  } = props

  return (
    <section className="space-y-5">
      <Card
        title="Record the Aircraft"
        subtitle="Capture 5 seconds of audio or a short video clip. More detail = more credible report."
      >
        <div className="flex flex-col items-center gap-4">
          <MicButton
            recording={recordingAudio}
            progress={audioProgress}
            level={audioLevel}
            onClick={startAudio}
            hasRecording={!!audioBlob}
          />
          <div className="text-[11px] text-neutral-500 text-center">
            {recordingAudio
              ? `Recording… ${Math.max(0, 5 - Math.round(audioProgress * 5))}s remaining`
              : audioBlob
              ? 'Audio captured — tap to re-record'
              : 'Tap to record 5 seconds of audio'}
          </div>
          {audioUrl && !recordingAudio && (
            <audio controls src={audioUrl} className="w-full" />
          )}
          {audioError && <div className="text-xs text-rose-300">{audioError}</div>}
        </div>
      </Card>

      <Card title="Or Record Video" subtitle="Video includes audio and counts as stronger evidence">
        <div className="space-y-3">
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-white/10">
            {recordingVideo ? (
              <video ref={videoPreviewRef} className="w-full h-full object-cover" playsInline muted />
            ) : videoUrl ? (
              <video src={videoUrl} controls className="w-full h-full object-cover" playsInline />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-neutral-600">
                <IconVideo size={32} />
              </div>
            )}
            {recordingVideo && (
              <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-rose-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                REC {videoSeconds}s
              </div>
            )}
          </div>
          {!recordingVideo ? (
            <button
              onClick={startVideo}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-rose-500/90 hover:bg-rose-500 text-white font-medium py-2.5 transition-colors"
            >
              <IconVideo size={18} />
              {videoBlob ? 'Re-record video' : 'Record video'}
            </button>
          ) : (
            <button
              onClick={stopVideo}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-white text-black font-semibold py-2.5 transition-colors hover:bg-neutral-200"
            >
              <IconPlayerStopFilled size={18} /> Stop
            </button>
          )}
          {videoError && <div className="text-xs text-rose-300">{videoError}</div>}
        </div>
      </Card>

      <ExcursionPicker
        activeList={activeList}
        activeStatus={activeStatus}
        selected={selectedExcursion}
        onSelect={setSelectedExcursion}
      />

      <Card
        title="Location Detail"
        subtitle="More precise locations let inspectors correlate with radar tracks."
      >
        <PrecisionPicker value={precision} onChange={setPrecision} displayedLocation={displayedLocation} />
        <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-400/5 border border-amber-400/20 px-3 py-2">
          <IconSparkles size={14} className="text-amber-300 mt-0.5" />
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            Reports with <span className="font-semibold">precise location</span> and{' '}
            <span className="font-semibold">video evidence</span> are taken more seriously and
            followed up first.
          </p>
        </div>
      </Card>
    </section>
  )
}

/* ─── Microphone button ──────────────────────────────────────────────────── */
function MicButton({ recording, progress, level, onClick, hasRecording }) {
  const size = 148
  const stroke = 3
  const r = (size - stroke) / 2 - 8
  const c = 2 * Math.PI * r
  const offset = c * (1 - progress)
  const glow = 0.25 + level * 0.75
  const scale = recording ? 1 + level * 0.06 : 1

  return (
    <button
      onClick={onClick}
      disabled={recording}
      className="relative group"
      style={{ width: size, height: size }}
      aria-label="Record audio"
    >
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-200"
        style={{
          background: recording
            ? `radial-gradient(closest-side, rgba(56,189,248,${glow}) 0%, rgba(56,189,248,0) 70%)`
            : 'radial-gradient(closest-side, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 70%)',
          transform: `scale(${1.1 + level * 0.25})`,
        }}
      />

      {/* Ambient pulse when idle */}
      {!recording && !hasRecording && (
        <span className="absolute inset-2 rounded-full border border-white/10 animate-[micPulse_2.6s_ease-out_infinite]" />
      )}

      {/* Core button */}
      <div
        className={[
          'absolute inset-2 rounded-full flex items-center justify-center transition-all duration-150',
          recording
            ? 'bg-gradient-to-br from-sky-400 to-sky-600 shadow-[0_0_40px_rgba(56,189,248,0.5)]'
            : hasRecording
            ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_30px_rgba(52,211,153,0.35)]'
            : 'bg-gradient-to-br from-neutral-100 to-neutral-300 text-black shadow-[0_10px_40px_rgba(0,0,0,0.5)]',
        ].join(' ')}
        style={{ transform: `scale(${scale})` }}
      >
        {hasRecording && !recording ? (
          <IconCheck size={44} stroke={2.5} className="text-white" />
        ) : (
          <IconMicrophone size={44} stroke={2} className={recording ? 'text-white' : 'text-black'} />
        )}
      </div>

      {/* Countdown ring */}
      {recording && (
        <svg className="absolute inset-0 -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="white"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 60ms linear' }}
          />
        </svg>
      )}

      <style>{`
        @keyframes micPulse {
          0%   { transform: scale(0.95); opacity: 0.6; }
          70%  { transform: scale(1.25); opacity: 0; }
          100% { transform: scale(1.25); opacity: 0; }
        }
      `}</style>
    </button>
  )
}

/* ─── Excursion picker ───────────────────────────────────────────────────── */
function ExcursionPicker({ activeList, activeStatus, selected, onSelect }) {
  // Group by type — list unique types, expand to show tails when tapped
  const [expandedType, setExpandedType] = useState(null)
  const groups = useMemo(() => {
    const m = new Map()
    for (const a of activeList) {
      const k = a.type || 'Unknown'
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(a)
    }
    return Array.from(m.entries()).map(([type, tails]) => {
      const sev = { yellow: 1, orange: 2, red: 3 }
      const worst = tails.reduce((w, a) => (sev[a.worst] > sev[w.worst] ? a : w), tails[0])
      return { type, tails, worst: worst.worst }
    })
  }, [activeList])

  return (
    <Card
      title="Identify the Aircraft (optional)"
      subtitle="Tag your report to an aircraft currently flagged for noise excursions."
    >
      {activeStatus === 'loading' && (
        <p className="text-[11px] text-neutral-500">Loading active excursions…</p>
      )}
      {activeStatus === 'error' && (
        <p className="text-[11px] text-rose-300">Feed unavailable — you can still submit.</p>
      )}
      {activeStatus === 'ok' && groups.length === 0 && (
        <p className="text-[11px] text-neutral-500">No active excursions in the last 48 hours.</p>
      )}
      {activeStatus === 'ok' && groups.length > 0 && (
        <>
          {selected && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-sky-300">Tagged</div>
                <div className="text-sm font-medium text-neutral-100">{selected.type}</div>
                <div className="text-[10px] font-mono text-neutral-400">{selected.tail}</div>
              </div>
              <button
                onClick={() => onSelect(null)}
                className="text-neutral-400 hover:text-neutral-200"
                aria-label="Clear selection"
              >
                <IconX size={16} />
              </button>
            </div>
          )}
          <ul className="space-y-1.5">
            {groups.map((g) => {
              const isOpen = expandedType === g.type
              return (
                <li key={g.type} className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
                  <button
                    onClick={() => setExpandedType(isOpen ? null : g.type)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.04]"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ background: KLASS_COLORS[g.worst], boxShadow: `0 0 8px ${KLASS_COLORS[g.worst]}` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-neutral-100 truncate">{g.type}</div>
                      <div className="text-[10px] text-neutral-500">
                        {g.tails.length} aircraft · worst: {g.worst}
                      </div>
                    </div>
                    <IconArrowRight
                      size={14}
                      className={`text-neutral-600 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <ul className="border-t border-white/5">
                      {g.tails.map((a) => {
                        const picked = selected?.tail === a.tail
                        return (
                          <li key={a.tail}>
                            <button
                              onClick={() => onSelect(picked ? null : a)}
                              className={[
                                'w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors',
                                picked ? 'bg-sky-400/10 text-neutral-100' : 'text-neutral-400 hover:bg-white/[0.04]',
                              ].join(' ')}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: KLASS_COLORS[a.worst] }}
                              />
                              <span className="font-mono">{a.tail}</span>
                              <span className="ml-auto text-neutral-500">
                                {a.counts.red > 0 && <span className="text-rose-400">●{a.counts.red} </span>}
                                {a.counts.orange > 0 && <span className="text-orange-400">●{a.counts.orange} </span>}
                                {a.counts.yellow > 0 && <span className="text-yellow-400">●{a.counts.yellow}</span>}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Card>
  )
}

/* ─── Precision picker ───────────────────────────────────────────────────── */
function PrecisionPicker({ value, onChange, displayedLocation }) {
  const options = [
    { key: 'city',    label: '1 km area',      hint: '±1 km',     pts: POINTS.location.city },
    { key: 'cross',   label: 'Cross street',   hint: 'Intersection', pts: POINTS.location.cross },
    { key: 'precise', label: 'Precise GPS',    hint: '±metres',   pts: POINTS.location.precise },
  ]
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const active = value === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => onChange(opt.key)}
              className={[
                'relative rounded-lg border px-2 py-3 text-left transition-colors',
                active
                  ? 'border-sky-400/60 bg-sky-400/10'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]',
              ].join(' ')}
            >
              <div className="text-[11px] font-semibold text-neutral-100">{opt.label}</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">{opt.hint}</div>
              <div className={`absolute top-1.5 right-1.5 text-[9px] font-bold ${active ? 'text-sky-300' : 'text-neutral-600'}`}>
                +{opt.pts}
              </div>
            </button>
          )
        })}
      </div>
      {displayedLocation && (
        <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-500">Will submit as</div>
          <div className="text-sm text-neutral-100 font-medium mt-0.5">{displayedLocation.text}</div>
          {displayedLocation.detail && (
            <div className="text-[10px] text-neutral-500 mt-0.5">{displayedLocation.detail}</div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Step 3: Review + score ─────────────────────────────────────────────── */
function Step3Review({ region, displayedLocation, audioUrl, videoUrl, score, tier, tierColor, selectedExcursion }) {
  return (
    <section className="space-y-5">
      <Card title="Report Score" subtitle="Higher scores are prioritised for follow-up investigation.">
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="44" fill="none"
                stroke="currentColor"
                className={tierColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 44}
                strokeDashoffset={2 * Math.PI * 44 * (1 - score.total / score.max)}
                style={{ transition: 'stroke-dashoffset 400ms ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-neutral-100">{score.total}</div>
                <div className="text-[9px] uppercase tracking-wider text-neutral-500">/ {score.max}</div>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className={`text-sm font-semibold ${tierColor}`}>
              <IconTrophy size={14} className="inline mr-1 -mt-0.5" />
              {tier}
            </div>
            <ul className="mt-2 space-y-1">
              {score.breakdown.length === 0 && (
                <li className="text-[11px] text-neutral-500">Nothing captured yet.</li>
              )}
              {score.breakdown.map((b) => (
                <li key={b.label} className="flex justify-between text-[11px]">
                  <span className="text-neutral-400">{b.label}</span>
                  <span className="text-neutral-200 font-mono">+{b.pts}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card title="Summary">
        <dl className="space-y-2 text-xs">
          <Row label="Region" value={region ? `${region.icao} · ${region.name}` : '—'} />
          <Row
            label="Location"
            value={displayedLocation?.text || 'Not set'}
            sub={displayedLocation?.detail}
          />
          <Row label="Audio" value={audioUrl ? '5-second clip captured' : 'None'} />
          <Row label="Video" value={videoUrl ? 'Clip captured' : 'None'} />
          <Row
            label="Aircraft"
            value={selectedExcursion ? selectedExcursion.type : 'Not identified'}
            sub={selectedExcursion ? selectedExcursion.tail : undefined}
          />
        </dl>
      </Card>
    </section>
  )
}

function Row({ label, value, sub }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right">
        <div className="text-neutral-100">{value}</div>
        {sub && <div className="text-[10px] text-neutral-500">{sub}</div>}
      </dd>
    </div>
  )
}

/* ─── Submitted confirmation ─────────────────────────────────────────────── */
function SubmittedCard({ score, region, onReset }) {
  return (
    <section className="rounded-xl border border-emerald-400/30 bg-gradient-to-b from-emerald-400/10 to-transparent p-6 text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center">
        <IconCheck size={28} className="text-emerald-300" stroke={2.5} />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-neutral-100">Report submitted</h2>
      <p className="text-xs text-neutral-400 mt-1">
        Routed to {region?.icao} noise office · scored {score.total}/{score.max}
      </p>
      <button
        onClick={onReset}
        className="mt-5 text-xs text-sky-300 hover:text-sky-200 underline underline-offset-2"
      >
        File another report
      </button>
    </section>
  )
}

/* ─── Wizard nav ─────────────────────────────────────────────────────────── */
function WizardNav({ step, onBack, onNext, onSubmit, canNext, canSubmit }) {
  if (step === 1) return null
  return (
    <div className="mt-5 flex items-center gap-2">
      <button
        onClick={onBack}
        className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] px-4 py-2.5 text-sm text-neutral-300"
      >
        <IconArrowLeft size={16} /> Back
      </button>
      <div className="flex-1" />
      {step < 3 && (
        <button
          onClick={onNext}
          disabled={!canNext}
          className={[
            'flex items-center gap-1 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors',
            canNext ? 'bg-white text-black hover:bg-neutral-200' : 'bg-white/10 text-neutral-500 cursor-not-allowed',
          ].join(' ')}
        >
          Next <IconArrowRight size={16} />
        </button>
      )}
      {step === 3 && (
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className={[
            'flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors',
            canSubmit ? 'bg-emerald-400 text-black hover:bg-emerald-300' : 'bg-white/10 text-neutral-500 cursor-not-allowed',
          ].join(' ')}
        >
          Submit report <IconCheck size={16} stroke={3} />
        </button>
      )}
    </div>
  )
}

/* ─── Card shell ─────────────────────────────────────────────────────────── */
function Card({ title, subtitle, children }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
        {subtitle && <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}
