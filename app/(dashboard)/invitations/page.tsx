import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getMyInvitations } from '@/actions/invitations'
import { InvitationCard } from '@/components/invitations/InvitationCard'

export default async function InvitationsPage() {
  const { data: invitations, error } = await getMyInvitations()

  if (error) redirect('/login')

  const t = await getTranslations('invitationsPage')
  const list = invitations ?? []

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-5 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('subtitle')}
          </p>
        </div>

        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">📭</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {t('emptyTitle')}
            </h2>
            <p className="text-gray-500 text-sm max-w-xs">
              {t('emptyBody')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((invitation) => (
              <InvitationCard key={invitation.id} invitation={invitation} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
