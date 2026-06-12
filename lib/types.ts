export type Profile = {
  id: string
  user_id: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

export type Board = {
  id: string
  title: string
  owner_id: string
  created_at: string
}

export type BoardMember = {
  id: string
  board_id: string
  user_id: string
  role: 'owner' | 'member'
}

export type Column = {
  id: string
  board_id: string
  title: string
  position: number
}

export type Card = {
  id: string
  column_id: string
  title: string
  description: string | null
  assignee_id: string | null
  due_date: string | null
  priority: 'low' | 'medium' | 'high' | 'critical' | null
  position: number
  created_at: string
}

export type Comment = {
  id: string
  card_id: string
  user_id: string
  body: string
  created_at: string
}

export type Attachment = {
  id: string
  card_id: string
  user_id: string
  file_name: string
  file_size: number | null
  file_type: string | null
  storage_path: string
  created_at: string
}

export type ColumnWithCards = Column & { cards: Card[] }

export type BoardWithMembers = Board & { board_members: BoardMember[] }
