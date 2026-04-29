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
  return data // { success, data: user, complex, building, unit, parking, roleContext }
}

export const getComplexes = async () => {
  const { data } = await api.get('/auth/complexes')
  return data
}

export const updateProfile = async ({ full_name, phone, emergency_contact }) => {
  const { data } = await api.put('/auth/me/profile', { full_name, phone, emergency_contact })
  return data // { success, data: updatedUser }
}

export const changePassword = async ({ current_password, new_password }) => {
  const { data } = await api.put('/auth/me/password', { current_password, new_password })
  return data // { success, message }
}

export const uploadAvatar = async (file) => {
  const formData = new FormData()
  formData.append('avatar', file)
  const { data } = await api.put('/auth/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return data // { success, data: { id, avatar_url } }
}
