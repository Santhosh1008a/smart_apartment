export const upsertNotice = (notices, notice) => {
  if (!notice?.id) return notices
  const index = notices.findIndex((item) => item.id === notice.id)
  if (index === -1) return [notice, ...notices]
  return notices.map((item) => item.id === notice.id ? { ...item, ...notice } : item)
}

const toLocalDateTimeInput = (value) => {
  if (!value) return ""
  const date = new Date(value)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

export const formFromNotice = (notice) => ({
  title: notice.title,
  message: notice.message,
  category: notice.category,
  priority: notice.priority,
  starts_at: toLocalDateTimeInput(notice.starts_at),
  ends_at: toLocalDateTimeInput(notice.ends_at),
})

export const noticeReviewState = (notice) => ({
  notice,
  form: formFromNotice(notice),
  previewed: true,
  showForm: true,
})
