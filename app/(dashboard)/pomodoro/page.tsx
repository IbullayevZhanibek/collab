'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Play, Pause, RotateCcw, Volume2, VolumeX, Settings, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

type Mode = 'focus' | 'shortBreak' | 'longBreak'

const MODES: Mode[] = ['focus', 'shortBreak', 'longBreak']

// Длительности по умолчанию (в минутах).
const DEFAULTS: Record<Mode, number> = { focus: 25, shortBreak: 5, longBreak: 15 }
const LIMITS: Record<Mode, { min: number; max: number }> = {
  focus: { min: 1, max: 90 },
  shortBreak: { min: 1, max: 30 },
  longBreak: { min: 1, max: 60 },
}
// Длинный перерыв — после каждых 4 завершённых фокус-циклов.
const CYCLES_BEFORE_LONG = 4
const STORAGE_KEY = 'pomodoro:settings'

// Акцентный цвет кольца/вкладки для каждого режима.
const MODE_COLOR: Record<Mode, { text: string; active: string }> = {
  focus: { text: 'text-brand-600', active: 'bg-brand-600' },
  shortBreak: { text: 'text-emerald-500', active: 'bg-emerald-500' },
  longBreak: { text: 'text-indigo-500', active: 'bg-indigo-500' },
}

const fmt = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

export default function PomodoroPage() {
  const t = useTranslations('pomodoro')

  const [durations, setDurations] = useState<Record<Mode, number>>(DEFAULTS)
  const [mode, setMode] = useState<Mode>('focus')
  const [remaining, setRemaining] = useState(DEFAULTS.focus * 60)
  const [running, setRunning] = useState(false)
  const [completed, setCompleted] = useState(0)
  const [soundOn, setSoundOn] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Момент окончания (epoch ms) — таймер опирается на реальное время, поэтому
  // не отстаёт, даже если вкладка была неактивна и setInterval «засыпал».
  const endTimeRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const total = durations[mode] * 60
  const progress = total > 0 ? remaining / total : 0

  // ── Загрузка настроек из localStorage при монтировании ──
  // setState в эффекте здесь намеренный: localStorage доступен только на клиенте,
  // а ленивый инициализатор state дал бы рассинхрон при SSR-гидратации.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as { durations?: Partial<Record<Mode, number>>; soundOn?: boolean }
        if (saved.durations) setDurations((d) => ({ ...d, ...saved.durations }))
        if (typeof saved.soundOn === 'boolean') setSoundOn(saved.soundOn)
        setRemaining((saved.durations?.focus ?? DEFAULTS.focus) * 60)
      }
    } catch {
      // повреждённые данные — игнорируем, остаёмся на дефолтах
    }
    setMounted(true)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Сохранение настроек ──
  useEffect(() => {
    if (!mounted) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ durations, soundOn }))
  }, [durations, soundOn, mounted])

  // ── Мягкий сигнал через Web Audio API (два спокойных тона с fade) ──
  const initAudio = useCallback(() => {
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
      return
    }
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (Ctx) audioCtxRef.current = new Ctx()
  }, [])

  const playChime = useCallback(() => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    // Два мягких восходящих тона.
    ;[
      { freq: 660, at: 0 },
      { freq: 880, at: 0.18 },
    ].forEach(({ freq, at }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const start = now + at
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.linearRampToValueAtTime(0.16, start + 0.04) // плавный fade-in
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5) // мягкий fade-out
      osc.start(start)
      osc.stop(start + 0.55)
    })
  }, [])

  const notify = useCallback(
    (finished: Mode) => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      const body = finished === 'focus' ? t('notifyFocusDone') : t('notifyBreakDone')
      new Notification(t('notifyTitle'), { body })
    },
    [t]
  )

  // ── Завершение интервала ──
  // Храним свежую версию обработчика в ref (обновляем в эффекте, не в рендере),
  // чтобы тикающий setInterval всегда видел актуальные mode/durations/completed.
  const completeRef = useRef<() => void>(() => {})
  useEffect(() => {
    completeRef.current = () => {
      setRunning(false)
      endTimeRef.current = null
      if (soundOn) playChime()
      notify(mode)
      if (mode === 'focus') {
        const nextCount = completed + 1
        setCompleted(nextCount)
        // Каждый 4-й фокус → длинный перерыв, иначе короткий.
        const next: Mode = nextCount % CYCLES_BEFORE_LONG === 0 ? 'longBreak' : 'shortBreak'
        setMode(next)
        setRemaining(durations[next] * 60)
      } else {
        setMode('focus')
        setRemaining(durations.focus * 60)
      }
    }
  })

  // ── Тик таймера ──
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const end = endTimeRef.current
      if (end == null) return
      const rem = Math.max(0, Math.round((end - Date.now()) / 1000))
      setRemaining(rem)
      if (rem <= 0) completeRef.current()
    }, 250)
    return () => clearInterval(id)
  }, [running])

  // ── Заголовок вкладки: фиксируем исходный при старте, восстанавливаем при стопе ──
  useEffect(() => {
    if (!running) return
    const original = document.title
    return () => {
      document.title = original
    }
  }, [running])
  useEffect(() => {
    if (running) document.title = `${fmt(remaining)} · ${t(mode)}`
  }, [running, remaining, mode, t])

  // ── Управление ──
  function start() {
    if (running || remaining <= 0) return
    initAudio()
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    endTimeRef.current = Date.now() + remaining * 1000
    setRunning(true)
  }

  function pause() {
    if (!running) return
    const end = endTimeRef.current
    if (end != null) setRemaining(Math.max(0, Math.round((end - Date.now()) / 1000)))
    endTimeRef.current = null
    setRunning(false)
  }

  function reset() {
    endTimeRef.current = null
    setRunning(false)
    setRemaining(durations[mode] * 60)
  }

  function switchMode(m: Mode) {
    if (m === mode) return
    endTimeRef.current = null
    setRunning(false)
    setMode(m)
    setRemaining(durations[m] * 60)
  }

  function adjust(target: Mode, delta: number) {
    setDurations((prev) => {
      const { min, max } = LIMITS[target]
      const next = Math.min(max, Math.max(min, prev[target] + delta))
      const updated = { ...prev, [target]: next }
      // Если правим текущий режим и таймер стоит — сразу обновляем отсчёт.
      if (target === mode && !running) setRemaining(next * 60)
      return updated
    })
  }

  // SVG-кольцо прогресса.
  const R = 88
  const C = 2 * Math.PI * R
  const dashOffset = C * (1 - progress)
  const color = MODE_COLOR[mode]

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-gray-500 text-sm mt-1">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setSoundOn((v) => !v)}
              title={soundOn ? t('soundOn') : t('soundOff')}
              aria-label={soundOn ? t('soundOn') : t('soundOff')}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              onClick={() => setShowSettings((v) => !v)}
              title={t('settings')}
              aria-label={t('settings')}
              className={cn(
                'inline-flex items-center justify-center h-9 w-9 rounded-lg border transition-colors',
                showSettings
                  ? 'border-brand-400 text-brand-700 bg-brand-50'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="grid grid-cols-3 gap-2 mb-8">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={cn(
                'rounded-xl py-2.5 text-sm font-medium transition-colors',
                m === mode
                  ? cn(MODE_COLOR[m].active, 'text-white shadow-soft')
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              {t(m)}
            </button>
          ))}
        </div>

        {/* Circular timer */}
        <div className="flex flex-col items-center">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72">
            <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
              <circle
                cx="100"
                cy="100"
                r={R}
                fill="none"
                strokeWidth="10"
                className="stroke-gray-200"
              />
              <circle
                cx="100"
                cy="100"
                r={R}
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                stroke="currentColor"
                className={cn('transition-[stroke-dashoffset] duration-300 ease-linear', color.text)}
                strokeDasharray={C}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl sm:text-6xl font-bold text-gray-900 tabular-nums leading-none">
                {fmt(remaining)}
              </span>
              <span className={cn('mt-2 text-sm font-medium', color.text)}>{t(mode)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 mt-8">
            <button
              onClick={running ? pause : start}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-brand-600 hover:bg-brand-700 hover:shadow-glow text-white font-semibold text-base transition-all active:scale-[0.98]"
            >
              {running ? <Pause size={18} /> : <Play size={18} />}
              {running ? t('pause') : t('start')}
            </button>
            <button
              onClick={reset}
              title={t('reset')}
              aria-label={t('reset')}
              className="inline-flex items-center justify-center h-12 w-12 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          {/* Cycles counter */}
          <p className="mt-6 text-sm text-gray-500">
            {t('cyclesLabel')}: <span className="font-semibold text-gray-900 tabular-nums">{completed}</span>
          </p>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-soft p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{t('settingsTitle')}</h2>
            <div className="space-y-3">
              {MODES.map((m) => (
                <div key={m} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-700">{t(m)}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjust(m, -1)}
                      disabled={durations[m] <= LIMITS[m].min}
                      aria-label={t('decrease')}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="w-16 text-center text-sm font-medium text-gray-900 tabular-nums">
                      {durations[m]} {t('minutesShort')}
                    </span>
                    <button
                      onClick={() => adjust(m, 1)}
                      disabled={durations[m] >= LIMITS[m].max}
                      aria-label={t('increase')}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
