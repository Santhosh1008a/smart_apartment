import test from 'node:test'
import assert from 'node:assert/strict'
import { formFromNotice, noticeReviewState, upsertNotice } from '../src/pages/notices/noticeState.mjs'

test('a successful notice save appears immediately and repeated responses do not duplicate it', () => {
  const existing = { id: 'existing', title: 'Existing notice', status: 'sent' }
  const created = { id: 'new', title: 'New notice', status: 'draft' }
  const initial = [existing]

  const afterCreate = upsertNotice(initial, created)
  const afterRepeatedResponse = upsertNotice(afterCreate, { ...created, status: 'sent' })

  assert.deepEqual(afterCreate, [created, existing])
  assert.deepEqual(afterRepeatedResponse, [{ ...created, status: 'sent' }, existing])
  assert.equal(afterRepeatedResponse.filter((notice) => notice.id === 'new').length, 1)
  assert.equal(initial[0], existing)
})

test('updating a saved notice preserves list order and other notice state', () => {
  const first = { id: 'first', title: 'First', is_read: true }
  const second = { id: 'second', title: 'Second', is_read: false }

  const result = upsertNotice([first, second], { id: 'second', title: 'Updated' })

  assert.deepEqual(result, [first, { ...second, title: 'Updated' }])
  assert.equal(result[0], first)
})

test('reviewing a saved draft opens its preview and preserves its editable fields', () => {
  const draft = {
    id: 'draft',
    title: 'Water tank cleaning',
    message: 'Please cooperate',
    category: 'maintenance',
    priority: 'normal',
    starts_at: '2026-10-05T00:00:00.000Z',
    ends_at: null,
    status: 'draft',
  }

  const review = noticeReviewState(draft)

  assert.equal(review.notice, draft)
  assert.equal(review.showForm, true)
  assert.equal(review.previewed, true)
  assert.deepEqual(review.form, formFromNotice(draft))
  assert.equal(review.form.title, draft.title)
  assert.equal(review.form.message, draft.message)
  assert.equal(review.form.category, draft.category)
  assert.equal(review.form.priority, draft.priority)
  assert.notEqual(review.form.starts_at, '')
})
