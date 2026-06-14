'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'
import { Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { acceptInvitation, declineInvitation } from '@/actions/invitations'
import type { MyInvitation } from '@/lib/types'

export function InvitationCard({ invitation }: { invitation: MyInvitation }) {
  const router = useRouter()
  const posthog = usePostHog()
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<'accept' | 'decline' | null>(null)
  const [isPending, startTransition] = useTransition()
  const [, startRefresh] = useTransition()

  function handle(kind: 'accept' | 'decline') {
    setError(null)
    setAction(kind)
    startTransition(async () => {
      const result =
        kind === 'accept'
          ? await acceptInvitation(invitation.id)
          : await declineInvitation(invitation.id)
      if (result?.error) {
        setError(result.error)
        setAction(null)
      } else {
        if (kind === 'accept') {
          posthog.capture('invitation_accepted', { invitation_id: invitation.id })
        }
        startRefresh(() => router.refresh())
      }
    })
  }

  const initial = invitation.board_title.charAt(0).toUpperCase()

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-soft p-4 sm:p-5">
      <div className="flex items-start gap-3">
        {/* Board avatar */}
        <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700 font-semibold shrink-0 select-none">
          {initial}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{invitation.board_title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Приглашение от <span className="font-medium text-gray-700">{invitation.inviter_name}</span>
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2 mt-4">
        <Button
          onClick={() => handle('accept')}
          disabled={isPending}
          className="flex-1"
        >
          {isPending && action === 'accept' ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <>
              <Check size={15} className="mr-1.5" />
              Принять
            </>
          )}
        </Button>
        <Button
          onClick={() => handle('decline')}
          disabled={isPending}
          variant="outline"
          className="flex-1"
        >
          {isPending && action === 'decline' ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <>
              <X size={15} className="mr-1.5" />
              Отклонить
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
