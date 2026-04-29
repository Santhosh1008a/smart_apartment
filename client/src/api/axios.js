import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token && config.url !== '/auth/refresh') {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 responses (expired / invalid token)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401, not a retry, and we have a refresh token
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/refresh') {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (refreshToken) {
        try {
           const { data } = await axios.post('/api/v1/auth/refresh', { token: refreshToken });
           
           if (data.success && data.accessToken) {
             localStorage.setItem('accessToken', data.accessToken);
             originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
             
             // Update the zustand store (optional but keeps state in sync)
             return api(originalRequest);
           }
        } catch (refreshError) {
           // Refresh failed
        }
      }
      
      // If we got here, refresh token is missing or failed
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') {
         window.location.href = '/login'
      }
    }
    
    return Promise.reject(error)
  }
)

export default api
