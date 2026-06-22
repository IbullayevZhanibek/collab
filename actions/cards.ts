'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/actions/activity'

export async function createCard(
  columnId: string,
  boardId: string,
  data: {
    title: string
    description?: string
    priority?: string
    due_date?: string
    assignee_id?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: existing } = await supabase
    .from('cards')
    .select('position')
    .eq('column_id', columnId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

  // Р•СЃР»Рё assignee_id РЅРµ РїРµСЂРµРґР°РЅ вЂ” РЅР°Р·РЅР°С‡Р°РµРј РЅР° С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.
  const assigneeId =
    data.assignee_id !== undefined ? (data.assignee_id || null) : user.id

  const { data: card, error } = await supabase
    .from('cards')
    .insert({
      column_id: columnId,
      title: data.title.trim(),
      description: data.description || null,
      priority: data.priority || null,
      due_date: data.due_date || null,
      assignee_id: assigneeId,
      position: nextPosition,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  const { data: column } = await supabase
    .from('columns')
    .select('title')
    .eq('id', columnId)
    .single()

  await logActivity(boardId, 'card_created', {
    cardTitle: card.title,
    columnTitle: column?.title ?? '',
  })

  revalidatePath('/tasks')
  return { data: card }
}

export async function updateCard(
  cardId: string,
  boardId: string,
  updates: {
    title?: string
    description?: string | null
    priority?: string | null
    due_date?: string | null
    assignee_id?: string | null
    column_id?: string
    position?: number
  }
) {
  const supabase = await createClient()

  const { data: updated, error } = await supabase
    .from('cards')
    .update(updates)
    .eq('id', cardId)
    .select('title')
    .single()

  if (error) return { error: error.message }

  // Р›РѕРіРёСЂСѓРµРј С‚РѕР»СЊРєРѕ СЃРѕРґРµСЂР¶Р°С‚РµР»СЊРЅРѕРµ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ (РЅР°Р·РІР°РЅРёРµ/РѕРїРёСЃР°РЅРёРµ/РїСЂРёРѕСЂРёС‚РµС‚/
  // РґРµРґР»Р°Р№РЅ), Р° РЅРµ СЃР»СѓР¶РµР±РЅС‹Рµ РѕР±РЅРѕРІР»РµРЅРёСЏ РїРѕР·РёС†РёРё/РєРѕР»РѕРЅРєРё вЂ” РґР»СЏ С‚РµС… РµСЃС‚СЊ card_moved.
  const isContentEdit =
    'title' in updates ||
    'description' in updates ||
    'priority' in updates ||
    'due_date' in updates
  if (isContentEdit) {
    await logActivity(boardId, 'card_updated', { cardTitle: updated?.title ?? '' })
  }

  revalidatePath('/tasks')
  return { success: true }
}

export async function deleteCard(cardId: string, boardId: string) {
  const supabase = await createClient()

  // РќР°Р·РІР°РЅРёРµ РЅСѓР¶РЅРѕ РїСЂРѕС‡РёС‚Р°С‚СЊ РґРѕ СѓРґР°Р»РµРЅРёСЏ, С‡С‚РѕР±С‹ Р·Р°РїРёСЃР°С‚СЊ РІ Р»РѕРі.
  const { data: card } = await supabase
    .from('cards')
    .select('title')
    .eq('id', cardId)
    .single()

  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', cardId)

  if (error) return { error: error.message }

  await logActivity(boardId, 'card_deleted', { cardTitle: card?.title ?? '' })

  revalidatePath('/tasks')
  return { success: true }
}

export async function moveCard(
  cardId: string,
  targetColumnId: string,
  targetPosition: number,
  boardId: string
) {
  const supabase = await createClient()

  // РЎРЅРёРјРѕРє В«РґРѕВ», С‡С‚РѕР±С‹ РїРѕРЅСЏС‚СЊ, СЃРјРµРЅРёР»Р°СЃСЊ Р»Рё РєРѕР»РѕРЅРєР°.
  const { data: before } = await supabase
    .from('cards')
    .select('title, column_id')
    .eq('id', cardId)
    .single()

  const { error } = await supabase
    .from('cards')
    .update({ column_id: targetColumnId, position: targetPosition })
    .eq('id', cardId)

  if (error) return { error: error.message }

  if (before && before.column_id !== targetColumnId) {
    const titles = await columnTitles(supabase, boardId)
    await logActivity(boardId, 'card_moved', {
      cardTitle: before.title,
      fromColumn: titles.get(before.column_id) ?? '',
      toColumn: titles.get(targetColumnId) ?? '',
    })
  }

  revalidatePath('/tasks')
  return { success: true }
}

export async function reorderCards(
  boardId: string,
  cards: { id: string; position: number; column_id: string }[]
) {
  const supabase = await createClient()

  // РЎРЅРёРјРѕРє СЃРѕСЃС‚РѕСЏРЅРёСЏ В«РґРѕВ» вЂ” С‡С‚РѕР±С‹ РїРѕР№РјР°С‚СЊ РєР°СЂС‚РѕС‡РєРё, СЃРјРµРЅРёРІС€РёРµ РєРѕР»РѕРЅРєСѓ.
  const ids = cards.map((c) => c.id)
  const { data: before } = await supabase
    .from('cards')
    .select('id, title, column_id')
    .in('id', ids.length > 0 ? ids : [''])

  const beforeMap = new Map((before ?? []).map((c) => [c.id, c]))

  const updates = cards.map(({ id, position, column_id }) =>
    supabase.from('cards').update({ position, column_id }).eq('id', id)
  )

  await Promise.all(updates)

  // Р›РѕРіРёСЂСѓРµРј С‚РѕР»СЊРєРѕ СЂРµР°Р»СЊРЅС‹Рµ РїРµСЂРµС…РѕРґС‹ РјРµР¶РґСѓ РєРѕР»РѕРЅРєР°РјРё (РЅРµ РїРµСЂРµСѓРїРѕСЂСЏРґРѕС‡РёРІР°РЅРёРµ).
  const moved = cards.filter((c) => {
    const prev = beforeMap.get(c.id)
    return prev && prev.column_id !== c.column_id
  })

  if (moved.length > 0) {
    const titles = await columnTitles(supabase, boardId)
    for (const c of moved) {
      const prev = beforeMap.get(c.id)!
      await logActivity(boardId, 'card_moved', {
        cardTitle: prev.title,
        fromColumn: titles.get(prev.column_id) ?? '',
        toColumn: titles.get(c.column_id) ?? '',
      })
    }
  }

  return { success: true }
}

// РљР°СЂС‚Р° id РєРѕР»РѕРЅРєРё в†’ РЅР°Р·РІР°РЅРёРµ, РґР»СЏ С‡РµР»РѕРІРµРєРѕС‡РёС‚Р°РµРјС‹С… Р·Р°РїРёСЃРµР№ Р»РѕРіР°.
async function columnTitles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  boardId: string,
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('columns')
    .select('id, title')
    .eq('board_id', boardId)
  return new Map((data ?? []).map((c) => [c.id, c.title]))
}
