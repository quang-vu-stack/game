import type { ConstructionStage, SiteSnapshot, WorkStatus } from './contracts.ts'

export const contract = { id: 'MV-001', fee: 780_000_000, estimatedCost: 570_000_000 }
export const shareholders = [
  { name: 'Quang Vũ', capital: 500_000_000 },
  { name: 'Ngọc Anh', capital: 300_000_000 },
  { name: 'Minh Đức', capital: 200_000_000 },
]
export const shareCapital = shareholders.reduce((total, person) => total + person.capital, 0)
export const materialPrice = 40_000_000
export const materialOrderSize = 3
const dailyLabor = 55_000_000
const stages = ['foundation', 'structure', 'finishing'] as const

export const stageName: Record<ConstructionStage, string> = {
  foundation: 'Thi công móng',
  structure: 'Dựng khung',
  finishing: 'Hoàn thiện',
  complete: 'Hoàn thành',
}

export const workName: Record<WorkStatus, string> = {
  idle: 'Chưa giao việc',
  ready: 'Sẵn sàng thi công',
  working: 'Đang thi công',
  'waiting-materials': 'Chờ vật tư',
  complete: 'Đã hoàn thành',
}

type ProjectStatus = 'offered' | 'accepted' | 'approved' | 'assigned' | 'delivered'
export type CompanyAction = 'accept' | 'approve' | 'buy' | 'assign' | 'next-day' | 'deliver'

export interface CompanyState {
  version: 1
  day: number
  cash: number
  project: ProjectStatus
  workDays: number
  materialLots: number
  spending: number
  revenue: number
  reports: { day: number; message: string }[]
}

export function newCompany(): CompanyState {
  return {
    version: 1, day: 1, cash: shareCapital, project: 'offered', workDays: 0,
    materialLots: 0, spending: 0, revenue: 0, reports: [],
  }
}

export function siteSnapshot(state: CompanyState): SiteSnapshot {
  const complete = state.workDays === 6
  const assigned = state.project === 'assigned'
  let workStatus: WorkStatus = 'idle'
  if (complete) workStatus = 'complete'
  else if (assigned && state.materialLots === 0) workStatus = 'waiting-materials'
  else if (assigned) workStatus = state.workDays ? 'working' : 'ready'

  return {
    day: state.day,
    projectId: state.project === 'offered' ? null : contract.id,
    stage: complete ? 'complete' : stages[Math.floor(state.workDays / 2)],
    progressPercent: Math.round(state.workDays * 100 / 6),
    materialLots: state.materialLots,
    workStatus,
  }
}

export function canAct(state: CompanyState, action: CompanyAction): boolean {
  switch (action) {
    case 'accept': return state.project === 'offered'
    case 'approve': return state.project === 'accepted'
    case 'buy': return ['approved', 'assigned'].includes(state.project)
      && state.workDays + state.materialLots < 6
      && state.cash >= Math.min(materialOrderSize, 6 - state.workDays - state.materialLots) * materialPrice
    case 'assign': return state.project === 'approved'
    case 'next-day': return state.project === 'assigned' && state.workDays < 6
    case 'deliver': return state.project === 'assigned' && state.workDays === 6
  }
}

export function addReport(state: CompanyState, message: string): CompanyState {
  const clean = message.trim().slice(0, 240)
  if (!clean) return state
  return { ...state, reports: [{ day: state.day, message: clean }, ...state.reports].slice(0, 20) }
}

export function runAction(state: CompanyState, action: CompanyAction): CompanyState {
  if (!canAct(state, action)) return state

  switch (action) {
    case 'accept': return { ...state, project: 'accepted' }
    case 'approve': return { ...state, project: 'approved' }
    case 'buy': {
      const lots = Math.min(materialOrderSize, 6 - state.workDays - state.materialLots)
      const cost = lots * materialPrice
      return { ...state, materialLots: state.materialLots + lots, cash: state.cash - cost, spending: state.spending + cost }
    }
    case 'assign': return { ...state, project: 'assigned' }
    case 'deliver': return { ...state, project: 'delivered', cash: state.cash + contract.fee, revenue: contract.fee }
    case 'next-day': {
      const next = { ...state, day: state.day + 1 }
      if (!state.materialLots) return addReport(next, 'Đội thi công tạm dừng vì thiếu vật tư.')
      if (state.cash < dailyLabor) return addReport(next, 'Đội thi công tạm dừng vì thiếu ngân sách trả công.')
      const updated = {
        ...next, cash: state.cash - dailyLabor, spending: state.spending + dailyLabor,
        materialLots: state.materialLots - 1, workDays: state.workDays + 1,
      }
      return updated.workDays === 6 ? addReport(updated, 'Công trình đã hoàn thành, chờ nghiệm thu.') : updated
    }
  }
}

const saveKey = 'mong-viet-3d.company.v1'

export function loadCompany(storage: Pick<Storage, 'getItem'>): CompanyState {
  try {
    const state = JSON.parse(storage.getItem(saveKey) ?? 'null')
    if (state?.version === 1
      && ['offered', 'accepted', 'approved', 'assigned', 'delivered'].includes(state.project)
      && [state.day, state.cash, state.workDays, state.materialLots, state.spending, state.revenue]
        .every(value => Number.isSafeInteger(value) && value >= 0)
      && state.day >= 1 && state.workDays + state.materialLots <= 6
      && (state.project !== 'delivered' || state.workDays === 6)
      && Array.isArray(state.reports)
      && state.reports.every((report: CompanyState['reports'][number]) =>
        Number.isSafeInteger(report?.day) && typeof report.message === 'string')) {
      return state
    }
  } catch {
    return newCompany()
  }
  return newCompany()
}

export function saveCompany(storage: Pick<Storage, 'setItem'>, state: CompanyState): boolean {
  try {
    storage.setItem(saveKey, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}
