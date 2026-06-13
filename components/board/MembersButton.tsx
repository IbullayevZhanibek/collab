'use client'

import { useState } from 'react'
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
  const [open, setOpen] = useState(false)

  const visibleAvatars = members.slice(0, 3)
  const extraCount = members.length - visibleAvatars.length

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-600 shrink-0"
      >
        {/* Stacked avatars */}
        <div className="flex -space-x-1.5">
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

        <Users size={14} className="shrink-0" />
        <span className="hidden sm:inline">Участники</span>
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
