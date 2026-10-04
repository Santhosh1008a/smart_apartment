import { Link } from 'react-router-dom'

const links = [
  ['Privacy', '/privacy'],
  ['Terms', '/terms'],
  ['Cookies', '/cookies'],
  ['Contact', '/contact'],
  ['Data requests', '/data-requests'],
  ['Payments', '/billing-policy'],
]

export default function LegalFooter() {
  return (
    <footer className="border-t border-border bg-card px-4 py-5 text-sm text-gray-500">
      <nav aria-label="Legal and support links" className="mx-auto flex max-w-7xl flex-wrap justify-center gap-x-5 gap-y-2">
        {links.map(([label, to]) => <Link key={to} to={to} className="hover:text-primary hover:underline">{label}</Link>)}
      </nav>
      <p className="mx-auto mt-3 max-w-7xl text-center text-xs">SyncLiving legal notices are drafts and require service-provider details and legal review before launch.</p>
    </footer>
  )
}
