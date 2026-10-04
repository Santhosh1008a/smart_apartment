import api from './axios'

export const createPrivacyRequest = async (payload) => {
  const { data } = await api.post('/privacy/requests', payload)
  return data
}

export const getMyPrivacyRequests = async () => {
  const { data } = await api.get('/privacy/requests')
  return data
}

export const getPrivacyRequestInbox = async () => {
  const { data } = await api.get('/privacy/requests/admin')
  return data
}

export const updatePrivacyRequest = async (id, payload) => {
  const { data } = await api.patch(`/privacy/requests/admin/${id}`, payload)
  return data
}
