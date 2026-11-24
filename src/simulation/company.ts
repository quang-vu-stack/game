import type { ConstructionStage, SiteSnapshot, WorkStatus } from './contracts.ts'

export const contract = { id: 'MV-001', fee: 780_000_000, estimatedCost: 570_000_000 }
export const shareholders = [
  { name: 'Quang Vũ', capital: 500_000_000 },
  { name: 'Ngọc Anh', capital: 300_000_000 },
  { name: 'Minh Đức', capital: 200_000_000 },
]
export const shareCapital = shareholders.reduce((total, person) => total + person.capital, 0)
const materialOrderSize = 3
export const suppliers = {
  buy: { label: 'Giao thường', pricePerLot: 40_000_000, leadDays: 2 },
  'buy-express': { label: 'Giao nhanh', pricePerLot: 48_000_000, leadDays: 0 },
} as const
type PurchaseAction = keyof typeof suppliers
export interface MaterialDelivery {
  day: number
  lots: number
}
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
export type CompanyAction = 'accept' | 'approve' | PurchaseAction | 'assign' | 'next-day' | 'deliver'

export interface CompanyState {
  version: 2
  day: number
  cash: number
  project: ProjectStatus
  workDays: number
  materialLots: number
  deliveries: MaterialDelivery[]
  spending: number
  revenue: number
  reports: { day: number; message: string }[]
}

export function newCompany(): CompanyState {
  return {
    version: 2, day: 1, cash: shareCapital, project: 'offered', workDays: 0,
    materialLots: 0, deliveries: [], spending: 0, revenue: 0, reports: [],
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

function countLots(deliveries: readonly MaterialDelivery[]): number {
  return deliveries.reduce((lots, delivery) => lots + delivery.lots, 0)
}

export function materialQuote(state: CompanyState, action: PurchaseAction) {
  const supplier = suppliers[action]
  const lots = Math.min(materialOrderSize, 6 - state.workDays - state.materialLots - countLots(state.deliveries))
  return { lots, cost: lots * supplier.pricePerLot, day: state.day + supplier.leadDays }
}

export function canAct(state: CompanyState, action: CompanyAction): boolean {
  switch (action) {
    case 'accept': return state.project === 'offered'
    case 'approve': return state.project === 'accepted'
    case 'buy':
    case 'buy-express': {
      const quote = materialQuote(state, action)
      return ['approved', 'assigned'].includes(state.project) && quote.lots > 0 && state.cash >= quote.cost
    }
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
    case 'buy':
    case 'buy-express': {
      const { lots, cost, day } = materialQuote(state, action)
      const paid = { ...state, cash: state.cash - cost, spending: state.spending + cost }
      if (day === state.day) return { ...paid, materialLots: state.materialLots + lots }
      return { ...paid, deliveries: [...state.deliveries, { day, lots }] }
    }
    case 'assign': return { ...state, project: 'assigned' }
    case 'deliver': return { ...state, project: 'delivered', cash: state.cash + contract.fee, revenue: contract.fee }
    case 'next-day': {
      const day = state.day + 1
      const received = countLots(state.deliveries.filter(delivery => delivery.day <= day))
      const deliveries = state.deliveries.filter(delivery => delivery.day > day)
      let next = { ...state, day, deliveries, materialLots: state.materialLots + received }
      if (received) next = addReport(next, `Công trường đã nhận ${received} lô vật tư giao thường.`)
      if (!next.materialLots) return addReport(next, 'Đội thi công tạm dừng vì thiếu vật tư.')
      if (next.cash < dailyLabor) return addReport(next, 'Đội thi công tạm dừng vì thiếu ngân sách trả công.')
      const updated = {
        ...next, cash: next.cash - dailyLabor, spending: next.spending + dailyLabor,
        materialLots: next.materialLots - 1, workDays: next.workDays + 1,
      }
      return updated.workDays === 6 ? addReport(updated, 'Công trình đã hoàn thành, chờ nghiệm thu.') : updated
    }
  }
}

const saveKey = 'mong-viet-3d.company.v1'

export function loadCompany(storage: Pick<Storage, 'getItem'>): CompanyState {
  try {
    const state = JSON.parse(storage.getItem(saveKey) ?? 'null')
    if ((state?.version === 1 || state?.version === 2)
      && ['offered', 'accepted', 'approved', 'assigned', 'delivered'].includes(state.project)
      && [state.day, state.cash, state.workDays, state.materialLots, state.spending, state.revenue]
        .every(value => Number.isSafeInteger(value) && value >= 0)
      && state.day >= 1 && state.workDays + state.materialLots <= 6
      && (state.project !== 'delivered' || state.workDays === 6)
      && Array.isArray(state.reports)
      && state.reports.every((report: CompanyState['reports'][number]) =>
        Number.isSafeInteger(report?.day) && typeof report.message === 'string')) {
      if (state.version === 1) return { ...state, version: 2, deliveries: [] }
      if (Array.isArray(state.deliveries)
        && state.deliveries.every((delivery: MaterialDelivery) =>
          Number.isSafeInteger(delivery?.day) && delivery.day > state.day
          && Number.isSafeInteger(delivery.lots) && delivery.lots > 0 && delivery.lots <= materialOrderSize)
        && state.workDays + state.materialLots + countLots(state.deliveries) <= 6) {
        return state
      }
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
