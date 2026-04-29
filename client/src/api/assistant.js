import api from './axios'

export const askAssistant = async (message) => {
  const endpoint = '/assistant/chat'
  const payload = { message }
  if (import.meta.env.DEV) {
    const token = localStorage.getItem('accessToken')
    console.log('[AI Assistant] request endpoint:', '/api/v1/assistant/chat')
    console.log('[AI Assistant] request payload:', payload)
    console.log('[AI Assistant] bearer token included:', token ? 'YES' : 'NO')
  }
  const { data } = await api.post(endpoint, payload)
  if (import.meta.env.DEV) {
    console.log('[AI Assistant] backend response:', data)
  }
  return data
}
