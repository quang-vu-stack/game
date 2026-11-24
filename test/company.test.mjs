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
  state = runAction(state, 'next-day')
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

test('đơn thường còn hiệu lực sau tải lại và chỉ nhập kho một lần vào ngày hẹn', () => {
  const entries = new Map()
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) }
  let state = ['accept', 'approve', 'buy', 'assign'].reduce(runAction, newCompany())
  assert.equal(state.materialLots, 0)
  assert.equal(state.spending, 120_000_000)
  assert.deepEqual(state.deliveries, [{ day: 3, lots: 3 }])
  const waiting = runAction(state, 'next-day')
  assert.equal(waiting.workDays, 0)
  assert.equal(saveCompany(storage, waiting), true)
  state = runAction(loadCompany(storage), 'next-day')
  assert.equal(state.day, 3)
  assert.equal(state.workDays, 1)
  assert.equal(state.materialLots, 2)
  assert.equal(state.spending, 175_000_000)
  assert.deepEqual(state.deliveries, [])
  assert.match(state.reports[0].message, /đã nhận 3 lô/)
  assert.equal(runAction(state, 'next-day').materialLots, 1)
})

test('giao nhanh nhập kho ngay với giá cao hơn và đơn đang giao vẫn được tính vào nhu cầu', () => {
  const state = ['accept', 'approve', 'buy', 'buy-express', 'assign'].reduce(runAction, newCompany())
  assert.equal(state.materialLots, 3)
  assert.equal(state.spending, 264_000_000)
  assert.equal(siteSnapshot(state).workStatus, 'ready')
  assert.strictEqual(runAction(state, 'buy-express'), state)
  assert.equal(runAction(state, 'next-day').workDays, 1)
})

test('bản lưu v1 giữ lại vốn, vật tư và tiến độ khi chuyển sang v2', () => {
  const { deliveries, ...initial } = newCompany()
  const old = { ...initial, version: 1, day: 4, project: 'assigned', workDays: 1,
    cash: 825_000_000, materialLots: 2, spending: 175_000_000 }
  const storage = { getItem: () => JSON.stringify(old) }
  const migrated = loadCompany(storage)
  assert.deepEqual(migrated, { ...old, version: 2, deliveries: [] })
  assert.equal(siteSnapshot(migrated).progressPercent, 17)
})
