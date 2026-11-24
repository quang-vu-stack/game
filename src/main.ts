import { addReport, canAct, contract, loadCompany, materialQuote, newCompany, runAction,
  saveCompany, shareCapital, shareholders, siteSnapshot, stageName, suppliers, workName } from './simulation/company'
import type { CompanyAction } from './simulation/company'
import type { MountSite, SiteScene } from './simulation/contracts'
import './style.css'

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
const money = (amount: number) => currency.format(amount)
const siteModules = import.meta.glob<{ mountSite: MountSite }>('./site/index.ts')
const siteLoader = siteModules['./site/index.ts']

let storage: Storage | undefined
try { storage = window.localStorage } catch { /* Storage can be blocked by the browser. */ }
let state = storage ? loadCompany(storage) : newCompany()
let activeScene: 'office' | 'site' = 'office'
let disposeOffice: (() => void) | undefined
let site: SiteScene | undefined
let sceneRequest = 0

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <header class="top">
    <div class="brand"><span class="mark" aria-hidden="true">MV</span><span><strong>Móng Việt 3D</strong><small>Công ty cổ phần xây dựng</small></span></div>
    <div class="top-stats"><span id="day"></span><span id="cash"></span></div>
  </header>
  <main>
    <section class="intro"><h1>Điều hành dự án</h1><p>Hợp đồng MV-001 · Nhà phố hai tầng</p></section>
    <div class="layout">
      <section class="card world">
        <nav aria-label="Chọn khu vực">
          <button id="office" type="button" aria-pressed="true">Văn phòng</button>
          <button id="site" type="button" aria-pressed="false">Công trường</button>
        </nav>
        <div id="viewport"></div>
        <div class="scene-footer" id="scene-footer"></div>
      </section>
      <aside class="card project" aria-label="Điều hành hợp đồng">
        <div class="project-title"><h2>Nhà phố hai tầng</h2><span class="pill" id="project-status"></span></div>
        <div class="progress-label"><span id="stage"></span><strong id="percent"></strong></div>
        <progress id="progress" max="100"></progress>
        <dl>
          <div><dt>Giá trị hợp đồng</dt><dd>${money(contract.fee)}</dd></div>
          <div><dt>Dự toán</dt><dd>${money(contract.estimatedCost)}</dd></div>
          <div><dt>Chi phí thực tế</dt><dd id="spending"></dd></div>
          <div><dt>Vật tư trong kho</dt><dd id="materials"></dd></div>
          <div id="profit-row" hidden><dt>Kết quả dự án</dt><dd id="profit"></dd></div>
        </dl>
        <section id="in-transit" hidden aria-label="Lịch giao vật tư">
          <h3>Đang giao</h3><ul id="deliveries"></ul>
        </section>
        <div id="actions"></div>
        <p id="feedback" role="status"></p>
      </aside>
    </div>
    <div class="lower">
      <section class="card detail"><h2>Cổ đông</h2><p>Vốn góp ${money(shareCapital)}</p>
        <ul class="shares">${shareholders.map(person => `<li><span>${person.name}</span><strong>${person.capital / shareCapital * 100}%</strong></li>`).join('')}</ul>
      </section>
      <section class="card detail"><h2>Báo cáo từ công trường</h2><ul id="reports"></ul></section>
    </div>
  </main>`

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

const actions: { id: CompanyAction; label: string; result: string }[] = [
  { id: 'accept', label: 'Nhận hợp đồng', result: 'Đã tiếp nhận hợp đồng MV-001.' },
  { id: 'approve', label: 'Duyệt dự toán', result: 'Đã duyệt dự toán công trình.' },
  { id: 'buy', label: '', result: 'Đã đặt vật tư. Xem ngày đến ở mục Đang giao.' },
  { id: 'buy-express', label: '', result: 'Vật tư giao nhanh đã nhập kho.' },
  { id: 'assign', label: 'Giao việc đội thi công', result: 'Đã giao việc cho chỉ huy công trường.' },
  { id: 'next-day', label: 'Qua ngày', result: 'Đã cập nhật tiến độ trong ngày.' },
  { id: 'deliver', label: 'Nghiệm thu và nhận thanh toán', result: 'Chủ đầu tư đã thanh toán hợp đồng.' },
]
const projectStatus = {
  offered: 'Chờ tiếp nhận', accepted: 'Đang lập dự toán', approved: 'Đã duyệt',
  assigned: 'Đã giao cho tổ đội', delivered: 'Đã bàn giao',
}
const actionsPanel = element('actions')
for (const action of actions) {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = `action-${action.id}`
  button.textContent = action.label
  button.addEventListener('click', () => {
    const next = runAction(state, action.id)
    if (next !== state) {
      const result = action.id === 'next-day' && next.workDays === state.workDays
        ? next.reports[0].message : action.result
      commit(next, result)
      if (button.hidden) actionsPanel.querySelector<HTMLButtonElement>('button:not([hidden])')?.focus()
    }
  })
  actionsPanel.append(button)
}

function commit(next: typeof state, message: string) {
  state = next
  const saved = storage && saveCompany(storage, state)
  element('feedback').textContent = saved ? message : `${message} Trình duyệt không lưu được tiến độ.`
  render()
}

function sendReport(message: string) {
  if (!siteSnapshot(state).projectId || !message.trim()) return
  commit(addReport(state, message), 'Đã gửi báo cáo về văn phòng.')
}

function render() {
  const snapshot = siteSnapshot(state)
  element('day').textContent = `Ngày ${state.day}`
  element('cash').textContent = money(state.cash)
  element('project-status').textContent = projectStatus[state.project]
  element('stage').textContent = snapshot.projectId ? stageName[snapshot.stage] : 'Tiến độ thi công'
  element('percent').textContent = `${snapshot.progressPercent}%`
  element<HTMLProgressElement>('progress').value = snapshot.progressPercent
  element('spending').textContent = money(state.spending)
  element('materials').textContent = `${state.materialLots} lô`
  element('profit-row').hidden = state.project !== 'delivered'
  element('profit').textContent = money(state.revenue - state.spending)

  for (const action of actions) {
    const button = element<HTMLButtonElement>(`action-${action.id}`)
    button.hidden = !canAct(state, action.id)
    if (action.id === 'buy' || action.id === 'buy-express') {
      const { lots, cost, day } = materialQuote(state, action.id)
      const arrival = day === state.day ? 'nhận ngay' : `ngày ${day}`
      button.textContent = `${suppliers[action.id].label} ${lots} lô · ${money(cost)} · ${arrival}`
    }
  }
  element('in-transit').hidden = state.deliveries.length === 0
  const deliveries = element('deliveries')
  deliveries.replaceChildren()
  for (const delivery of state.deliveries) {
    const item = document.createElement('li')
    item.textContent = `Ngày ${delivery.day} · ${delivery.lots} lô vật tư`
    deliveries.append(item)
  }
  const reports = element('reports')
  reports.replaceChildren()
  for (const report of state.reports) {
    const item = document.createElement('li')
    item.textContent = `Ngày ${report.day} · ${report.message}`
    reports.append(item)
  }
  if (!reports.childElementCount) {
    const item = document.createElement('li')
    item.textContent = 'Chưa có báo cáo.'
    reports.append(item)
  }
  site?.update(snapshot)
  if (activeScene === 'site' && !siteLoader) element('site-status').textContent = workName[snapshot.workStatus]
  if (activeScene === 'site' && !siteLoader) element<HTMLButtonElement>('send-site-report').disabled = !snapshot.projectId
}

async function openScene(scene: typeof activeScene) {
  const request = ++sceneRequest
  activeScene = scene
  disposeOffice?.()
  disposeOffice = undefined
  site?.dispose()
  site = undefined
  const viewport = element('viewport')
  viewport.replaceChildren()
  element('office').setAttribute('aria-pressed', String(scene === 'office'))
  element('site').setAttribute('aria-pressed', String(scene === 'site'))
  const footer = element('scene-footer')
  if (scene === 'office') {
    footer.textContent = 'Kỹ sư dự toán · Nhân viên mua hàng · Kế toán'
    viewport.textContent = 'Đang tải văn phòng…'
    try {
      const { mountOffice } = await import('./office/scene')
      if (request !== sceneRequest) return
      viewport.replaceChildren()
      disposeOffice = mountOffice(viewport)
    } catch {
      if (request !== sceneRequest) return
      viewport.textContent = 'Trình duyệt không mở được cảnh 3D. Bạn vẫn có thể điều hành dự án ở bảng bên cạnh.'
    }
  } else if (siteLoader) {
    footer.textContent = 'Chỉ huy trưởng · Hai công nhân · Vận hành máy'
    viewport.textContent = 'Đang tải công trường…'
    try {
      const { mountSite } = await siteLoader()
      if (request !== sceneRequest) return
      viewport.replaceChildren()
      site = mountSite({ container: viewport, onReport: sendReport })
    } catch {
      if (request !== sceneRequest) return
      viewport.textContent = 'Chưa tải được cảnh công trường.'
    }
  } else {
    footer.textContent = 'Bảng theo dõi công trường'
    viewport.innerHTML = '<div class="site-summary"><h2>Tổ thi công</h2><p id="site-status"></p><button id="send-site-report" type="button">Gửi tình trạng về văn phòng</button></div>'
    element('send-site-report').addEventListener('click', () => {
      const snapshot = siteSnapshot(state)
      sendReport(`${workName[snapshot.workStatus]} · Tiến độ ${snapshot.progressPercent}% · Còn ${snapshot.materialLots} lô vật tư.`)
    })
  }
  render()
}

element('office').addEventListener('click', () => { if (activeScene !== 'office') void openScene('office') })
element('site').addEventListener('click', () => { if (activeScene !== 'site') void openScene('site') })
render()
void openScene('office')
