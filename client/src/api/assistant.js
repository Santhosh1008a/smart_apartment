import api from './axios'

export const askAssistant = async (message, config = {}) => {
  const { data } = await api.post('/assistant/chat', { message }, config)
  return data
}
