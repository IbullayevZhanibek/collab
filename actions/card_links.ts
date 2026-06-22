'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CardLinkWithAuthor, LinkType } from '@/lib/types'

function detectLinkType(url: string): LinkType {
  try {
    const { hostname } = new URL(url)
    if (hostname.includes('github.com') || hostname.includes('gitlab.com') || hostname.includes('bitbucket.org')) return 'github'
    if (hostname.includes('figma.com')) return 'figma'
    if (
      hostname.includes('drive.google.com') ||
      hostname.includes('docs.google.com') ||
      hostname.includes('sheets.google.com') ||
      hostname.includes('slides.google.com')
    ) return 'gdrive'
    if (
      hostname.includes('youtube.com') ||
      hostname.includes('youtu.be') ||
      hostname.includes('vimeo.com') ||
      hostname.includes('loom.com')
    ) return 'video'
    return 'other'
  } catch {
    return 'other'
  }
}

function validateUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return 'Р’РІРµРґРёС‚Рµ СЃСЃС‹Р»РєСѓ'
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'РЎСЃС‹Р»РєР° РґРѕР»Р¶РЅР° РЅР°С‡РёРЅР°С‚СЊСЃСЏ СЃ http:// РёР»Рё https://'
    }
    return null
  } catch {
    return 'РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ СЃСЃС‹Р»РєР°'
  }
}

export async function getCardLinks(
  cardId: string,
): Promise<{ data?: CardLinkWithAuthor[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase.rpc('get_card_links', { p_card_id: cardId })
  if (error) return { error: error.message }
  return { data: (data ?? []) as CardLinkWithAuthor[] }
}

export async function addCardLink(
  cardId: string,
  boardId: string,
  url: string,
  title?: string,
): Promise<{ data?: CardLinkWithAuthor; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const trimmedUrl = url.trim()
  const validationError = validateUrl(trimmedUrl)
  if (validationError) return { error: validationError }

  const trimmedTitle = title?.trim() || null
  const linkType = detectLinkType(trimmedUrl)

  const { data, error } = await supabase
    .from('card_links')
    .insert({
      card_id: cardId,
      board_id: boardId,
      user_id: user.id,
      url: trimmedUrl,
      title: trimmedTitle,
      link_type: linkType,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return {
    data: {
      id: (data as { id: string }).id,
      card_id: cardId,
      board_id: boardId,
      user_id: user.id,
      url: trimmedUrl,
      title: trimmedTitle,
      link_type: linkType,
      created_at: new Date().toISOString(),
      full_name: null,
    },
  }
}

export async function deleteCardLink(
  linkId: string,
  boardId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS В«Authors can delete own card linksВ» РіР°СЂР°РЅС‚РёСЂСѓРµС‚ СѓРґР°Р»РµРЅРёРµ С‚РѕР»СЊРєРѕ СЃРІРѕРµР№ СЃСЃС‹Р»РєРё.
  const { error } = await supabase.from('card_links').delete().eq('id', linkId)
  if (error) return { error: error.message }

  return {}
}

// РЎС‡С‘С‚С‡РёРє РґР»СЏ Р±РµР№РґР¶Р° РЅР° РѕРґРЅРѕР№ РєР°СЂС‚РѕС‡РєРµ.
export async function getLinksCount(
  cardId: string,
): Promise<{ count?: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { count, error } = await supabase
    .from('card_links')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', cardId)

  if (error) return { error: error.message }
  return { count: count ?? 0 }
}

// РћРґРёРЅ Р·Р°РїСЂРѕСЃ РґР»СЏ РІСЃРµС… РєР°СЂС‚РѕС‡РµРє РґРѕСЃРєРё.
export async function getBulkLinksCounts(
  cardIds: string[],
): Promise<{ data?: Record<string, number>; error?: string }> {
  if (!cardIds.length) return { data: {} }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('card_links')
    .select('card_id')
    .in('card_id', cardIds)

  if (error) return { error: error.message }

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.card_id] = (counts[row.card_id] ?? 0) + 1
  }
  return { data: counts }
}
