import assert from 'node:assert/strict'
import test from 'node:test'
import { loadCompany, newCompany, runAction, saveCompany, siteSnapshot } from '../src/simulation/company.ts'

test('thiếu vật tư dừng tiến độ, gửi báo cáo và không trừ chi phí', () => {
  const assigned = ['accept', 'approve', 'assign'].reduce(runAction, newCompany())
  const waiting = runAction(assigned, 'next-day')
  assert.equal(waiting.cash, assigned.cash)
  assert.equal(siteSnapshot(waiting).progressPercent, 0)
  assert.equal(siteSnapshot(waiting).workStatus, 'waiting-materials')
  assert.match(waiting.reports[0].message, /thiếu vật tư/)
})

test('hoàn thành đủ ba giai đoạn và chỉ nhận thanh toán một lần sau tải lại', () => {
  const storage = new Map()
  const save = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  let state = ['accept', 'approve', 'buy', 'buy', 'assign'].reduce(runAction, newCompany())
  assert.equal(siteSnapshot(state).stage, 'foundation')
  for (const stage of ['structure', 'finishing', 'complete']) {
    state = runAction(runAction(state, 'next-day'), 'next-day')
    assert.equal(siteSnapshot(state).stage, stage)
  }
  assert.equal(state.spending, 570_000_000)
  assert.equal(state.materialLots, 0)
  state = runAction(state, 'deliver')
  assert.equal(state.cash, 1_210_000_000)
  assert.equal(saveCompany(save, state), true)
  const reloaded = loadCompany(save)
  assert.deepEqual(reloaded, state)
  assert.strictEqual(runAction(reloaded, 'deliver'), reloaded)
})
