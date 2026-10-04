import { useState } from 'react'

export default function UserAvatar({ user, src, className = '' }) {
  const [failedSource, setFailedSource] = useState(null)
  const name = user?.full_name?.trim() || 'User'
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  const sharedClass = `inline-flex shrink-0 items-center justify-center overflow-hidden bg-secondary text-sm font-semibold text-primary ${className}`
  if (src && failedSource !== src) {
    return <img src={src} alt={`${name} avatar`} className={`${sharedClass} object-cover`} onError={() => setFailedSource(src)} />
  }
  return <div role="img" aria-label={`${name} avatar`} className={sharedClass}>{initials || 'U'}</div>
}
