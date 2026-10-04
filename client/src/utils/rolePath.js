export const getRoleBasedPath = (role) => {
  switch (role) {
    case 'admin': return '/admin'
    case 'super_admin': return '/super-admin'
    case 'security': return '/security'
    case 'vendor': return '/vendor'
    default: return '/'
  }
}
