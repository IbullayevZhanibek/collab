'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserMinus, Loader2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { removeMember } from '@/actions/members'
import { sendInvitation } from '@/actions/invitations'
import type { MemberWithProfile, BoardInvitation } from '@/lib/types'

interface MembersDialogProps {
  open: boolean
  onClose: () => void
  boardId: string
  currentUserId: string
  isOwner: boolean
  members: MemberWithProfile[]
  invitations?: BoardInvitation[]
}

export function MembersDialog({
  open,
  onClose,
  boardId,
  currentUserId,
  isOwner,
  members,
  invitations = [],
}: MembersDialogProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [isPendingInvite, startInviteTransition] = useTransition()
  const [isPendingRemove, startRemoveTransition] = useTransition()
  const [, startRefresh] = useTransition()

  const pendingInvitations = invitations.filter((inv) => inv.status === 'pending')

  function handleInvite() {
    const trimmed = email.trim()
    if (!trimmed) {
      setInviteError('Введите email адрес')
      return
    }
    setInviteError(null)
    setInviteSuccess(null)
    startInviteTransition(async () => {
      const result = await sendInvitation(boardId, trimmed)
      if (result?.error) {
        setInviteError(result.error)
      } else {
        setEmail('')
        setInviteSuccess('Приглашение отправлено')
        startRefresh(() => router.refresh())
      }
    })
  }

  function handleRemove(userId: string) {
    setRemovingId(userId)
    startRemoveTransition(async () => {
      const result = await removeMember(boardId, userId)
      setRemovingId(null)
      if (!result?.error) {
        startRefresh(() => router.refresh())
      }
    })
  }

  function handleClose() {
    setEmail('')
    setInviteError(null)
    setInviteSuccess(null)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Участники доски" className="sm:max-w-lg">
      {/* Invite section — only visible to the owner */}
      {isOwner && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Пригласить по email
          </label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setInviteError(null)
                setInviteSuccess(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              autoFocus
            />
            <Button
              onClick={handleInvite}
              disabled={isPendingInvite || !email.trim()}
              className="shrink-0"
            >
              {isPendingInvite ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                'Пригласить'
              )}
            </Button>
          </div>
          {inviteError && (
            <p className="mt-2 text-sm text-red-600">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="mt-2 text-sm text-green-600">{inviteSuccess}</p>
          )}
        </div>
      )}

      {/* Divider */}
      {isOwner && <div className="border-t border-gray-100 mb-4" />}

      {/* Members list */}
      <div>
        <p className="text-sm font-medium text-gray-500 mb-3">
          Участники · {members.length}
        </p>
        <div className="space-y-1">
          {members.map((member) => {
            const displayName = member.full_name || member.email
            const initial = displayName.charAt(0).toUpperCase()
            const isMe = member.user_id === currentUserId
            const canRemove = isOwner && !isMe && member.role !== 'owner'

            return (
              <div
                key={member.user_id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm shrink-0 select-none">
                  {initial}
                </div>

                {/* Name + email */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {displayName}
                    {isMe && (
                      <span className="ml-1 text-gray-400 font-normal">(вы)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{member.email}</p>
                </div>

                {/* Role badge */}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    member.role === 'owner'
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {member.role === 'owner' ? 'Владелец' : 'Участник'}
                </span>

                {/* Remove button */}
                {canRemove && (
                  <button
                    onClick={() => handleRemove(member.user_id)}
                    disabled={isPendingRemove && removingId === member.user_id}
                    title="Удалить участника"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-50"
                  >
                    {isPendingRemove && removingId === member.user_id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <UserMinus size={15} />
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Pending invitations — only visible to the owner */}
      {isOwner && pendingInvitations.length > 0 && (
        <div className="mt-6">
          <div className="border-t border-gray-100 mb-4" />
          <p className="text-sm font-medium text-gray-500 mb-3">
            Приглашения · {pendingInvitations.length}
          </p>
          <div className="space-y-1">
            {pendingInvitations.map((inv) => {
              const displayName = inv.full_name || inv.email
              const initial = displayName.charAt(0).toUpperCase()

              return (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-sm shrink-0 select-none">
                    {initial}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{inv.email}</p>
                  </div>

                  {/* Status badge */}
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-amber-50 text-amber-700">
                    Ожидает
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Dialog>
  )
}
