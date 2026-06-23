'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Users } from 'lucide-react'
import { MembersDialog } from './MembersDialog'
import type { MemberWithProfile, BoardInvitation } from '@/lib/types'

interface MembersButtonProps {
  boardId: string
  currentUserId: string
  isOwner: boolean
  members: MemberWithProfile[]
  invitations?: BoardInvitation[]
}

export function MembersButton({ boardId, currentUserId, isOwner, members, invitations = [] }: MembersButtonProps) {
  const t = useTranslations('board')
  const [open, setOpen] = useState(false)

  const visibleAvatars = members.slice(0, 3)
  const extraCount = members.length - visibleAvatars.length

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-9 px-2 sm:px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm text-gray-600 shrink-0"
      >
        {/* Stacked avatars — hidden on mobile to keep the header compact */}
        <div className="hidden sm:flex -space-x-1.5">
          {visibleAvatars.map((m) => {
            const name = m.full_name || m.email
            return (
              <div
                key={m.user_id}
                title={name}
                className="w-6 h-6 rounded-full bg-brand-100 border-2 border-white flex items-center justify-center text-brand-700 text-[10px] font-semibold select-none"
              >
                {name.charAt(0).toUpperCase()}
              </div>
            )
          })}
          {extraCount > 0 && (
            <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 text-[10px] font-semibold select-none">
              +{extraCount}
            </div>
          )}
        </div>

        <Users size={16} className="shrink-0" />
        <span className="hidden sm:inline">{t('members')}</span>
      </button>

      <MembersDialog
        open={open}
        onClose={() => setOpen(false)}
        boardId={boardId}
        currentUserId={currentUserId}
        isOwner={isOwner}
        members={members}
        invitations={invitations}
      />
    </>
  )
}
