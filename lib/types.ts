// Глобальная роль пользователя, выбирается при регистрации.
export type GlobalRole = 'teacher' | 'student'

// Командная роль студента внутри проекта.
export type TeamRole = 'project_manager' | 'researcher' | 'developer' | 'analyst' | 'presenter'

export const TEAM_ROLES: TeamRole[] = [
  'project_manager',
  'researcher',
  'developer',
  'analyst',
  'presenter',
]

export type Profile = {
  id: string
  user_id: string
  full_name: string | null
  avatar_url: string | null
  global_role: GlobalRole
  created_at: string
}

export type Board = {
  id: string
  title: string
  owner_id: string
  // Учебные поля проекта (добавлены миграцией 011).
  description: string | null
  goal: string | null
  expected_result: string | null
  start_date: string | null
  end_date: string | null
  defense_format: string | null
  created_at: string
}

export type BoardMember = {
  id: string
  board_id: string
  user_id: string
  role: 'owner' | 'member'
  team_role: TeamRole | null
}

export type ProjectStageStatus = 'pending' | 'in_progress' | 'done'

export type ProjectStage = {
  id: string
  board_id: string
  title: string
  description: string | null
  order_index: number
  due_date: string | null
  status: ProjectStageStatus
  created_at: string
}

// Черновик этапа в форме создания проекта (ещё без id/board_id).
export type StageDraft = {
  title: string
  due_date: string | null
}

// Данные для создания учебного проекта.
export type ProjectInput = {
  title: string
  description?: string | null
  goal?: string | null
  expected_result?: string | null
  start_date?: string | null
  end_date?: string | null
  defense_format?: string | null
  stages?: StageDraft[]
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

export type ColumnWithCards = Column & { cards: Card[] }

export type BoardWithMembers = Board & { board_members: BoardMember[] }

export type MemberWithProfile = {
  user_id: string
  role: 'owner' | 'member'
  team_role: TeamRole | null
  full_name: string | null
  email: string
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined'

// Входящее приглашение текущего пользователя (для страницы «Приглашения»).
export type MyInvitation = {
  id: string
  board_id: string
  board_title: string
  inviter_name: string
  created_at: string
}

// Приглашение в контексте доски (для владельца, диалог участников).
export type BoardInvitation = {
  id: string
  invitee_id: string
  full_name: string | null
  email: string
  status: InvitationStatus
  created_at: string
}

export type ActivityAction =
  | 'card_created'
  | 'card_updated'
  | 'card_moved'
  | 'card_deleted'
  | 'column_created'
  | 'column_deleted'
  | 'member_joined'
  | 'member_left'

// Сводка по задачам пользователя для блока статистики на /dashboard.
export type DashboardStats = {
  today: number   // дедлайн сегодня (не выполнено)
  overdue: number // просрочено (не выполнено)
  done: number    // в колонках «Готово»/«Done»
  active: number  // все не выполненные
}

// Срочная/просроченная задача для блока уведомлений.
export type NotificationItem = {
  id: string
  title: string
  due_date: string
  priority: 'low' | 'medium' | 'high' | 'critical' | null
  board_id: string
  board_title: string
  days_until: number // <0 просрочено, 0 сегодня, >0 осталось дней
}

// Задача для календарного вида: карточка с дедлайном + контекст доски/колонки.
export type CalendarTask = {
  id: string
  title: string
  due_date: string
  priority: 'low' | 'medium' | 'high' | 'critical' | null
  board_id: string
  board_title: string
  column_title: string
}

// Запись лога активности доски (с именем автора из get_activity_log).
export type ActivityLogEntry = {
  id: string
  user_id: string | null
  full_name: string | null
  email: string | null
  action: ActivityAction
  details: Record<string, unknown> | null
  created_at: string
}
