# Frontend ↔ Backend Connection — Walkthrough

## Changes Made

### New Files
- [axios.js](file:///c:/Users/santh/OneDrive/Desktop/tdpcl/client/src/api/axios.js) — Axios instance with base URL `/api/v1`, auth token interceptor, and 401 auto-logout
- [auth.js](file:///c:/Users/santh/OneDrive/Desktop/tdpcl/client/src/api/auth.js) — `loginUser()`, `registerUser()`, `getMe()` API functions

### Modified Files
| File | Change |
|------|--------|
| [useAuthStore.js](file:///c:/Users/santh/OneDrive/Desktop/tdpcl/client/src/store/useAuthStore.js) | Token + user persisted in localStorage; session survives page refresh |
| [Login.jsx](file:///c:/Users/santh/OneDrive/Desktop/tdpcl/client/src/pages/auth/Login.jsx) | Real API call via `loginUser()`, error feedback on failure |
| [Register.jsx](file:///c:/Users/santh/OneDrive/Desktop/tdpcl/client/src/pages/auth/Register.jsx) | Real API call via `registerUser()`, phone field added, success/error messages |
| [vite.config.js](file:///c:/Users/santh/OneDrive/Desktop/tdpcl/client/vite.config.js) | Dev proxy: `/api` → `http://localhost:5000` |
| [Dashboard.jsx](file:///c:/Users/santh/OneDrive/Desktop/tdpcl/client/src/pages/dashboard/Dashboard.jsx) | `user?.name` → `user?.full_name` |
| [MainLayout.jsx](file:///c:/Users/santh/OneDrive/Desktop/tdpcl/client/src/layouts/MainLayout.jsx) | `user?.name` → `user?.full_name` |

## Verification

Tested login with `admin@test.com` / `admin123` in the browser:

![Login flow recording](C:/Users/santh/.gemini/antigravity/brain/8e7b2dec-1d52-4ed4-8bdb-e34e82775b69/login_flow_test_1773897389669.webp)

✅ Login page renders correctly with email + password fields  
✅ API call to backend succeeds, token is stored  
✅ Redirects to Dashboard — shows *"Welcome back, Super!"*  
✅ Sidebar shows **Super Admin** with role **super_admin**
