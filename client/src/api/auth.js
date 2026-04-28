import api from './axios'

export const loginUser = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password })
  return data // { success, accessToken, refreshToken, user }
}

export const registerUser = async ({ full_name, email, phone, password, complex_id }) => {
  const { data } = await api.post('/auth/register', {
    full_name,
    email,
    phone,
    password,
    complex_id,
  })
  return data // { success, data: { id, email, full_name, role } }
}

export const getMe = async () => {
  const { data } = await api.get('/auth/me')
  return data // { success, data: user }
}

export const getComplexes = async () => {
  const { data } = await api.get('/auth/complexes')
  return data
}
