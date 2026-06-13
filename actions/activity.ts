'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActivityLogEntry } from '@/lib/types'

/**
 * Записывает действие в лог активности доски.
 * Намеренно «тихая»: любые ошибки логирования не должны ломать
 * основное действие (создание карточки и т.п.), поэтому вызывающий
 * код не обязан проверять результат.
 */
export async function logActivity(
  boardId: string,
  action: string,
  details?: Record<string, unknown>,
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('activity_log').insert({
      board_id: boardId,
      user_id: user.id,
      action,
      details: details ?? null,
    })
  } catch {
    // лог не критичен — молча игнорируем сбой
  }
}

export async function getActivityLog(
  boardId: string,
  limit = 50,
): Promise<{ data?: ActivityLogEntry[]; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .rpc('get_activity_log', { bid: boardId, lmt: limit })

  if (error) return { error: error.message }

  return { data: (data ?? []) as ActivityLogEntry[] }
}
