'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MoreHorizontal, History, BarChart3, ClipboardCheck, CheckCircle2, RotateCcw, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { ActivityLog, type ActivityLogHandle } from './ActivityLog'
import { MonitoringButton, type MonitoringButtonHandle } from './MonitoringButton'
import { GradingButton, type GradingButtonHandle } from './GradingButton'
import { CompleteBoardButton, type CompleteBoardButtonHandle } from './CompleteBoardButton'
import { MembersButton } from './MembersButton'
import type { MemberWithProfile, BoardInvitation } from '@/lib/types'

interface BoardActionsProps {
  boardId: string
  isOwner: boolean
  currentUserId: string
  members: MemberWithProfile[]
  invitations: BoardInvitation[]
  boardTitle: string
  initialStatus: 'active' | 'completed'
}

export function BoardActions({
  boardId,
  isOwner,
  currentUserId,
  members,
  invitations,
  boardTitle,
  initialStatus,
}: BoardActionsProps) {
  const t = useTranslations('nav')
  const tb = useTranslations('board')
  const tc = useTranslations('common')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [boardStatus, setBoardStatus] = useState<'active' | 'completed'>(initialStatus)
  const [desktopMoreOpen, setDesktopMoreOpen] = useState(false)
  const desktopMoreRef = useRef<HTMLDivElement>(null)

  // Refs let the mobile "..." sheet and desktop dropdown trigger drawers imperatively.
  // All components below are mounted inside the "hidden md:flex" row — invisible on
  // mobile (display:none) but still mounted, so their portal-based drawers work fine.
  const activityRef = useRef<ActivityLogHandle>(null)
  const monitoringRef = useRef<MonitoringButtonHandle>(null)
  const gradingRef = useRef<GradingButtonHandle>(null)
  const completeBoardRef = useRef<CompleteBoardButtonHandle>(null)

  // Close desktop dropdown when clicking outside
  useEffect(() => {
    if (!desktopMoreOpen) return
    function onOutside(e: MouseEvent) {
      if (desktopMoreRef.current && !desktopMoreRef.current.contains(e.target as Node)) {
        setDesktopMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [desktopMoreOpen])

  function openFromSheet(fn: () => void) {
    setSheetOpen(false)
    setTimeout(fn, 50)
  }

  return (
    <>
      {/*
        ActivityLog is mounted headless (no button) so its portal-based drawer
        can be triggered imperatively from both the desktop dropdown and the
        mobile sheet via activityRef, without a visible button in the header.
      */}
      <ActivityLog ref={activityRef} boardId={boardId} headless />

      {/*
        Desktop action row — hidden on mobile (display:none) but MOUNTED.
        Portal-based drawers still work when opened via refs from the mobile sheet.
      */}
      <div className="hidden md:flex items-center gap-1 lg:gap-2">
        {/* "..." dropdown — secondary actions (History) */}
        <div className="relative" ref={desktopMoreRef}>
          <button
            onClick={() => setDesktopMoreOpen((v) => !v)}
            aria-label={t('moreActions')}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-600 shrink-0"
          >
            <MoreHorizontal size={16} />
          </button>
          {desktopMoreOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-20">
              <button
                onClick={() => { setDesktopMoreOpen(false); setTimeout(() => activityRef.current?.open(), 50) }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors rounded-lg"
              >
                <History size={15} className="text-gray-400 shrink-0" />
                {t('history')}
              </button>
            </div>
          )}
        </div>

        {isOwner && <MonitoringButton ref={monitoringRef} boardId={boardId} />}
        <GradingButton
          ref={gradingRef}
          boardId={boardId}
          currentUserId={currentUserId}
          isOwner={isOwner}
          members={members}
        />
        {isOwner && (
          <CompleteBoardButton
            ref={completeBoardRef}
            boardId={boardId}
            boardTitle={boardTitle}
            initialStatus={initialStatus}
            onStatusChange={setBoardStatus}
          />
        )}
        <MembersButton
          boardId={boardId}
          currentUserId={currentUserId}
          isOwner={isOwner}
          members={members}
          invitations={invitations}
        />
      </div>

      {/*
        Mobile compact row — only Members + "..." to keep the header uncluttered.
        Everything else (History, Grading, Monitoring, Complete) lives in the sheet.
      */}
      <div className="flex md:hidden items-center gap-1">
        <MembersButton
          boardId={boardId}
          currentUserId={currentUserId}
          isOwner={isOwner}
          members={members}
          invitations={invitations}
        />
        <button
          onClick={() => setSheetOpen(true)}
          aria-label={t('moreActions')}
          className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-600 shrink-0"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* Mobile bottom sheet */}
      {sheetOpen && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-overlay-in"
              onClick={() => setSheetOpen(false)}
            />
            <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl shadow-pop">
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <p className="text-sm font-semibold text-gray-900">{t('moreActions')}</p>
                <button
                  onClick={() => setSheetOpen(false)}
                  aria-label={tc('close')}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="px-3 pb-6 space-y-1">
                <SheetItem
                  Icon={History}
                  label={t('history')}
                  onClick={() => openFromSheet(() => activityRef.current?.open())}
                />
                <SheetItem
                  Icon={ClipboardCheck}
                  label={t('grading')}
                  onClick={() => openFromSheet(() => gradingRef.current?.open())}
                />
                {isOwner && (
                  <SheetItem
                    Icon={BarChart3}
                    label={t('monitoring')}
                    onClick={() => openFromSheet(() => monitoringRef.current?.open())}
                  />
                )}
                {isOwner && (
                  <SheetItem
                    Icon={boardStatus === 'completed' ? RotateCcw : CheckCircle2}
                    label={boardStatus === 'completed' ? tb('reopen') : tb('complete')}
                    onClick={() => openFromSheet(() => completeBoardRef.current?.trigger())}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function SheetItem({
  Icon,
  label,
  onClick,
}: {
  Icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3.5 rounded-xl',
        'text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors',
      )}
    >
      <Icon size={20} className="text-gray-500 shrink-0" />
      {label}
    </button>
  )
}
