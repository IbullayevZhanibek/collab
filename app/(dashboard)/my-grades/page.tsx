import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getMyGrades, type MyGradeEntry } from '@/actions/grading'
import { Star } from 'lucide-react'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('myGradesPage')
  return { title: t('title') }
}

export default async function MyGradesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('user_id', user.id)
    .single()

  if (profile?.global_role === 'teacher') redirect('/dashboard')

  const [t, { data: entries }] = await Promise.all([
    getTranslations('myGradesPage'),
    getMyGrades(),
  ])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-1">
            <Star size={22} className="text-brand-600 shrink-0" />
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          </div>
          <p className="text-gray-500 text-sm">{t('subtitle')}</p>
        </div>

        {!entries || entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="bg-brand-50 rounded-3xl p-6 mb-5">
              <Star className="text-brand-400 mx-auto" size={48} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('noProjects')}</h2>
            <p className="text-gray-500 text-sm max-w-xs">{t('noProjectsBody')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <ProjectGradeCard key={entry.boardId} entry={entry} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

type Translations = Awaited<ReturnType<typeof getTranslations<'myGradesPage'>>>

function ProjectGradeCard({ entry, t }: { entry: MyGradeEntry; t: Translations }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900 truncate">{entry.boardTitle}</h2>
        {entry.hasFinalGrade && entry.finalScore !== null && (
          <span className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            <Star size={13} />
            {t('outOf', { score: entry.finalScore, max: entry.finalMax })}
          </span>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {!entry.hasAnyGrade ? (
          <p className="text-sm text-gray-400 py-4 text-center">{t('noGrades')}</p>
        ) : (
          <>
            {entry.criteria.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {t('rubricScore')}
                </p>
                <div className="space-y-2">
                  {entry.criteria.map((c) => (
                    <div key={c.id} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm text-gray-700 flex-1">{c.title}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                          {c.score !== null
                            ? t('outOf', { score: c.score, max: c.maxScore })
                            : <span className="text-gray-400 font-normal text-xs">{t('notGraded')}</span>}
                        </span>
                      </div>
                      {c.comment && (
                        <p className="mt-1.5 text-xs text-gray-500 italic">{c.comment}</p>
                      )}
                      {c.score !== null && (
                        <div className="mt-1.5 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-brand-400 transition-all"
                            style={{ width: `${c.maxScore > 0 ? Math.round((c.score / c.maxScore) * 100) : 0}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {entry.criteria.some((c) => c.score !== null) && (
                    <div className="flex items-center justify-between pt-1 px-1">
                      <span className="text-xs font-medium text-gray-500">{t('totalPoints')}</span>
                      <span className="text-sm font-bold text-gray-900">
                        {t('outOf', { score: entry.rubricTotal, max: entry.rubricMax })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {entry.hasFinalGrade && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1.5">
                  {t('finalGrade')}
                </p>
                <p className="text-2xl font-bold text-emerald-700">
                  {entry.finalScore !== null
                    ? t('outOf', { score: entry.finalScore, max: entry.finalMax })
                    : t('notGraded')}
                </p>
                {entry.finalComment && (
                  <p className="mt-2 text-sm text-emerald-800 italic">{entry.finalComment}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
