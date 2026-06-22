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
  is_feedback: boolean
  created_at: string
}

// Комментарий с данными автора (возвращается get_card_comments).
export type CommentWithAuthor = {
  id: string
  card_id: string
  user_id: string
  body: string
  is_feedback: boolean
  created_at: string
  full_name: string | null
  avatar_url: string | null
  global_role: 'teacher' | 'student'
  team_role: string | null
}

export type LinkType = 'github' | 'figma' | 'gdrive' | 'video' | 'other'

// Ссылка на материал, прикреплённая к задаче.
export type CardLink = {
  id: string
  card_id: string
  board_id: string
  user_id: string
  url: string
  title: string | null
  link_type: LinkType
  created_at: string
}

// Ссылка с именем добавившего (возвращается get_card_links).
export type CardLinkWithAuthor = CardLink & {
  full_name: string | null
}

export type ColumnWithCards = Column & { cards: Card[] }

export type Reflection = {
  id: string
  board_id: string
  stage_id: string | null
  student_id: string
  what_done: string | null
  difficulties: string | null
  improvements: string | null
  contribution: string | null
  created_at: string
  updated_at: string
}

// Рефлексия с именем студента и названием этапа (возвращается get_project_reflections).
export type ReflectionWithMeta = Reflection & {
  full_name: string | null
  stage_title: string | null
}

// ── Мониторинг ────────────────────────────────────────────────────────────────

export type ProjectMetrics = {
  totalCards: number
  doneCards: number
  completionRate: number     // 0–100
  cardsWithDeadline: number
  onTimeCards: number
  deadlineCompliance: number // 0–100
  overdueCount: number
  totalStages: number
  doneStages: number
  stageProgress: number      // 0–100
}

export type ActivityLevel = 'active' | 'low' | 'inactive'

export type StudentActivityMetric = {
  userId: string
  fullName: string | null
  email: string
  teamRole: string | null
  assignedCards: number
  doneCards: number
  commentsCount: number
  linksCount: number
  reflectionsCount: number
  activityScore: number
  activityLevel: ActivityLevel
}

export type TaskDistItem = {
  name: string
  assigned: number
  done: number
}

export type TeamCollaborationMetrics = {
  totalComments: number
  totalLinks: number
  activeStudents: number
  totalStudents: number
  taskDistribution: TaskDistItem[]
}

export type MonitoringData = {
  project: ProjectMetrics
  students: StudentActivityMetric[]
  collaboration: TeamCollaborationMetrics
}

// ── Аналитические отчёты ──────────────────────────────────────────────────

export type StudentReportData = {
  userId: string
  fullName: string | null
  email: string
  teamRole: string | null
  assignedCards: number
  doneCards: number
  commentsCount: number
  linksCount: number
  reflectionsCount: number
  activityScore: number
  activityLevel: ActivityLevel
  gradeScore: number | null
  gradeMax: number | null
  gradePercent: number | null
}

export type StudentReflection = {
  studentId: string
  stageTitle: string | null
  whatDone: string | null
  difficulties: string | null
  improvements: string | null
  contribution: string | null
  updatedAt: string
}

export type ProjectReportData = {
  boardId: string
  boardTitle: string
  students: StudentReportData[]
  project: ProjectMetrics
  avgScore: number | null
  avgActivityScore: number
  reflections: StudentReflection[]
}

export type TeacherOverviewItem = {
  boardId: string
  boardTitle: string
  studentCount: number
  completionRate: number
  stageProgress: number
  avgScore: number | null
  isActive: boolean
}

export type StudentDetailReport = StudentReportData & {
  reflections: StudentReflection[]
}

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
  | 'stage_status_changed'

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

// Агрегированные данные учительского дашборда.
export type TeacherProjectSummary = {
  id: string
  title: string
  created_at: string
  studentCount: number
  completionRate: number
  overdueCount: number
}

export type AttentionSignal = {
  boardId: string
  boardTitle: string
  type: 'overdue' | 'low_activity'
  count: number
}

export type TeacherDashboardData = {
  activeProjects: number
  totalStudents: number
  avgProgress: number
  needsAttentionCount: number
  attentionSignals: AttentionSignal[]
  projects: TeacherProjectSummary[]
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

// ── Журнал оценок (этап 3) ──

export type FinalGrade = {
  id: string
  board_id: string
  student_id: string | null
  final_score: number
  max_score: number
  comment: string | null
  graded_by: string | null
  updated_at: string
}

export type GradebookCriterionScore = {
  criterionId: string
  score: number | null
  comment: string | null
}

export type GradebookStudentEntry = {
  studentId: string | null // null = строка «Проект в целом»
  studentName: string | null
  studentEmail: string
  teamRole: string | null
  criteriaScores: GradebookCriterionScore[]
  rubricTotal: number
  rubricMax: number
  rubricPercent: number
  finalScore: number | null    // из final_grades; null если не выставлена
  finalMax: number             // знаменатель итоговой оценки
  finalComment: string | null
  hasFinalGrade: boolean
}

export type ProjectGradebookData = {
  boardId: string
  boardTitle: string
  criteria: RubricCriterion[]
  entries: GradebookStudentEntry[]   // сначала студенты, последний — проект
  avgRubricPercent: number | null
  gradedCount: number
  totalStudents: number
}

// ── Оценивание проекта по рубрике (этап 2) ──

// Критерий оценивания.
export type RubricCriterion = {
  id: string
  board_id: string
  title: string
  max_score: number
  order_index: number
  created_at: string
}

// Выставленная оценка по критерию (для всего проекта или конкретного студента).
export type Grade = {
  id: string
  board_id: string
  criterion_id: string
  student_id: string | null
  score: number
  comment: string | null
  graded_by: string | null
  created_at: string
  updated_at: string
}

// Итоговый балл по проекту/студенту.
export type ProjectScore = {
  total: number   // сумма выставленных баллов
  max: number     // сумма максимумов всех критериев
  percent: number // total / max * 100, округлено
  graded: number  // сколько критериев уже оценено
}
