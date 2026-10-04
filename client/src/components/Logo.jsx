import logoUrl from "../../../public/branding/syncliving-logo.jpeg"

export default function Logo({ className = "" }) {
  return (
    <img
      src={logoUrl}
      alt="SyncLiving"
      width="782"
      height="826"
      className={`block object-contain ${className}`}
      draggable="false"
    />
  )
}
