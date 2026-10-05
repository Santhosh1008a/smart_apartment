import test from 'node:test'
import assert from 'node:assert/strict'
import { createSingleFlight, withExclusiveLock } from '../src/api/singleFlight.mjs'

test('concurrent callers share one refresh operation and receive its result', async () => {
  let calls = 0
  let finishOperation
  const operation = createSingleFlight(() => {
    calls += 1
    return new Promise((resolve) => { finishOperation = resolve })
  })

  const first = operation('first caller')
  const second = operation('second caller')
  await Promise.resolve()

  assert.equal(calls, 1)
  finishOperation({ success: true, accessToken: 'test-token' })
  assert.deepEqual(await Promise.all([first, second]), [
    { success: true, accessToken: 'test-token' },
    { success: true, accessToken: 'test-token' },
  ])
})

test('a failed refresh is shared while in flight and later attempts can retry', async () => {
  let calls = 0
  const operation = createSingleFlight(async () => {
    calls += 1
    if (calls === 1) throw new Error('refresh failed')
    return 'recovered'
  })

  const failedResults = await Promise.allSettled([operation(), operation()])
  assert.equal(calls, 1)
  assert.ok(failedResults.every((result) => result.status === 'rejected'))
  assert.equal(await operation(), 'recovered')
  assert.equal(calls, 2)
})

test('refreshes in separate tabs queue behind the same browser lock when Web Locks are available', async () => {
  let tail = Promise.resolve()
  const lockManager = {
    request: (_name, operation) => {
      const next = tail.then(operation, operation)
      tail = next.catch(() => {})
      return next
    },
  }
  let active = 0
  let maximumActive = 0
  const runRefresh = () => withExclusiveLock(lockManager, 'syncliving-auth-refresh', async () => {
    active += 1
    maximumActive = Math.max(maximumActive, active)
    await new Promise((resolve) => setTimeout(resolve, 1))
    active -= 1
  })

  await Promise.all([runRefresh(), runRefresh()])
  assert.equal(maximumActive, 1)
})
