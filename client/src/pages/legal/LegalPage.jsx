import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Loader2, Send } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { createPrivacyRequest, getMyPrivacyRequests } from '../../api/privacy'

const DRAFT_DATE = '4 October 2026'

const policyContent = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'This draft describes the personal information SyncLiving may handle when apartment communities use the service. The actual service provider, contact details, retention schedule, and community responsibilities must be confirmed before publication.',
    sections: [
      ['Who is responsible', 'Service provider: [Service Provider Legal Name]. Registered or business address: [Registered Address]. Privacy and grievance contact: [Privacy Contact Email]. Apartment communities may determine purposes for their own resident, visitor, and security records; their roles and contact details must be agreed and shown to users before launch.'],
      ['Information handled', 'Depending on the features used: account name, email, phone number, password hash, apartment/community and unit assignment, profile image, emergency contact, visitor name and phone, visit purpose and time, QR pass and scan events, vehicle details, invoices and payment status, service requests, security alerts, notifications, and technical request/session data. Do not enter sensitive information into optional text fields unless it is necessary.'],
      ['Why it is handled', 'Account access, apartment administration, visitor authorization, security operations, invoice and payment workflows, service requests, support, fraud prevention, and service reliability. The service provider and each apartment community must identify and document the applicable legal ground and provide any required notice before collection. This draft does not itself establish a legal ground.'],
      ['Sharing and service providers', 'Information may be visible to authorized apartment administrators and security staff for their community, and may be processed by hosting/database providers, payment providers when configured, and the AI provider when the assistant is enabled. No provider, region, or transfer arrangement should be treated as approved until recorded in the production configuration and vendor review.'],
      ['Storage, security, and retention', 'The current code uses a PostgreSQL database, Supabase Storage for profile images, an HttpOnly refresh cookie, and browser memory for access tokens. The avatar bucket is currently public, so uploaded profile image URLs may be accessible to anyone with the URL. A precise retention and deletion schedule, backup lifecycle, and incident-response contact have not been supplied; those items must be completed before launch.'],
      ['Your requests', 'You may submit an authenticated request for access, correction, deletion, consent withdrawal, or another privacy concern using the form below. The request is routed to SyncLiving super administrators for review; it does not automatically delete account, visitor, invoice, or security records. Requests may need to be coordinated with your apartment community and records that must be retained by law or contract.'],
      ['Children and guardians', 'The service is designed for apartment-community administration, not for children to create their own accounts. Communities must establish an appropriate guardian and notice process before entering personal information about a child. The applicable child-data requirements should be confirmed with counsel before launch.'],
      ['Cookies and analytics', 'The application uses a first-party HttpOnly refresh-session cookie and browser storage for cached display profile/context information. Access tokens are held in page memory. No non-essential analytics cookie has been identified in the code reviewed for this draft. The cookie page should be updated if analytics, advertising, or additional integrations are enabled.'],
      ['Law and changes', 'India’s Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025 have phased commencement dates. The service provider must check the provisions and rules in force on the actual launch date and obtain legal review. This draft makes no claim of certification or completed compliance.'],
    ],
  },
  terms: {
    title: 'Terms and Conditions',
    intro: 'Draft terms for review by the actual service provider and apartment communities. These are not approved contractual terms.',
    sections: [
      ['Provider and acceptance', 'The contracting provider is [Service Provider Legal Name], at [Registered Address]. These draft terms should be replaced with reviewed terms identifying the provider, effective date, support contact, and governing law before accounts are accepted.'],
      ['Accounts and roles', 'You must provide accurate account information and protect your sign-in credentials. Access depends on the role and apartment-community assignment approved for your account. Do not share QR passes, access links, or another person’s account.'],
      ['Community data and conduct', 'Use visitor, emergency, security, and resident features only for legitimate community operations. Apartment administrators are responsible for assigning staff access and ensuring their notices, permissions, and instructions are appropriate. Do not submit false visitor, payment, or emergency information.'],
      ['Availability and emergency services', 'The service may be unavailable during maintenance or provider outages. SyncLiving community alerts do not contact police, fire, or ambulance services. In India, call 112 for emergency response.'],
      ['Payments', 'Apartment maintenance invoices and payments are administered for the relevant community. Platform software subscription terms, cancellation, and refunds must be documented in a separate reviewed commercial agreement. Displayed analytics reflect recorded platform payment transactions and are not a promise of future revenue.'],
      ['Suspension and contact', 'Accounts may be restricted to protect users, communities, or the service, with an appropriate review process to be defined by the provider. Contact [Support Email] for service issues. These terms require review for consumer, housing, payment, and jurisdiction-specific requirements.'],
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    intro: 'Draft inventory based on the current application code. Update this page before adding any analytics, marketing, or third-party session integrations.',
    sections: [
      ['Required session cookie', 'The API sets a refreshToken cookie marked HttpOnly and scoped to the authentication API. In production it is configured Secure and SameSite=None so a separately hosted frontend can send it with credentialed requests. The browser JavaScript cannot read its value.'],
      ['Browser storage', 'The app caches limited profile and apartment-context display data in local storage. Access tokens are held in memory. Clearing site storage signs you out or removes cached display values.'],
      ['Optional tracking', 'No non-essential tracking cookie is identified in the code reviewed for this draft. If a future provider adds analytics or advertising, update this notice and implement any required consent controls before enabling it.'],
    ],
  },
  contact: {
    title: 'Contact and Support',
    intro: 'Support details are not configured in this project. The placeholders below must be replaced by the actual provider before launch.',
    sections: [
      ['Service provider', '[Service Provider Legal Name] · [Registered Address]'],
      ['Technical support', '[Support Email — configure before launch]'],
      ['Privacy and grievance contact', '[Privacy Contact Email — configure before launch]'],
      ['Apartment-specific questions', 'For resident access, invoices, visitor records, or security operations, contact your apartment community administrator. For immediate emergencies in India, call 112; SyncLiving does not dispatch emergency services.'],
    ],
  },
  billing: {
    title: 'Payment, Subscription, Cancellation, and Refund Policy',
    intro: 'Draft payment information. The actual provider must publish reviewed commercial terms and community-specific payment rules before accepting real payments.',
    sections: [
      ['Apartment community charges', 'Maintenance invoices and resident payments belong to the relevant apartment community. Contact that community administrator about the amount due, payment allocation, cancellation, or refund. SyncLiving does not promise a refund decision for a community.'],
      ['SyncLiving subscriptions', 'Platform subscriptions are currently administered and recorded by platform administrators. The public code does not provide an end-user self-service subscription checkout or cancellation flow. Plan, renewal, taxes, cancellation, and refund terms must be agreed with the actual service provider before any subscription is sold.'],
      ['Payment records', 'A payment is reported as platform revenue only when a verified transaction record is captured. Trial values, recurring run-rate estimates, and projected values are labeled separately in analytics and are not cash received.'],
      ['Support', 'For a payment question, contact your apartment community for resident invoices or [Support Email — configure before launch] for a platform subscription. Never send full card numbers, CVV, passwords, or one-time codes in a support request.'],
    ],
  },
}

const requestTypes = [
  ['access', 'Access / copy of my information'],
  ['correction', 'Correct my information'],
  ['deletion', 'Delete my account or information'],
  ['withdraw_consent', 'Withdraw consent'],
  ['other', 'Other privacy concern'],
]

function PrivacyRequestForm() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [requestType, setRequestType] = useState('access')
  const [details, setDetails] = useState('')
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(isAuthenticated)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadRequests = async () => {
    const result = await getMyPrivacyRequests()
    setRequests(result.data || [])
  }

  useEffect(() => {
    if (!isAuthenticated) return
    let active = true
    getMyPrivacyRequests()
      .then((result) => { if (active) setRequests(result.data || []) })
      .catch(() => { if (active) setError('Could not load your requests. Please sign in again and retry.') })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [isAuthenticated])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSubmitting(true)
    try {
      await createPrivacyRequest({ request_type: requestType, details: details.trim() || undefined })
      setDetails('')
      setNotice('Your request was submitted to the privacy review queue.')
      await loadRequests()
    } catch (err) {
      setError(err.response?.data?.message || 'Your request could not be submitted. Please retry.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-5 sm:p-7">
      <h2 className="text-xl font-semibold">Submit a privacy request</h2>
      <p className="mt-2 text-sm text-gray-500">Sign in so the request can be associated with your account. Do not include passwords, payment-card details, or other sensitive information.</p>
      {!isAuthenticated ? (
        <p className="mt-4 text-sm">Please <Link className="font-medium text-primary underline" to="/login">sign in</Link> to submit and track a request.</p>
      ) : (
        <>
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <label className="block text-sm font-medium">Request type
              <select className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-sm" value={requestType} onChange={(event) => setRequestType(event.target.value)}>
                {requestTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">Optional details
              <textarea className="mt-1 block min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Describe what you are requesting (maximum 2,000 characters)." />
              <span className="mt-1 block text-right text-xs text-gray-500">{details.length}/2000</span>
            </label>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
            <button disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit request
            </button>
          </form>
          <div className="mt-8 border-t border-border pt-5">
            <h3 className="font-semibold">Your requests</h3>
            {isLoading ? <p className="mt-3 text-sm text-gray-500">Loading requests…</p> : requests.length === 0 ? <p className="mt-3 text-sm text-gray-500">No requests submitted yet.</p> : (
              <ul className="mt-3 divide-y divide-border">
                {requests.map((request) => <li key={request.id} className="py-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2"><span className="font-medium capitalize">{request.request_type.replaceAll('_', ' ')}</span><span className="rounded-full bg-secondary px-2.5 py-1 text-xs capitalize">{request.status.replaceAll('_', ' ')}</span></div>
                  <p className="mt-1 text-xs text-gray-500">Submitted {new Date(request.submitted_at).toLocaleString()}</p>
                  {request.resolution_note && <p className="mt-2">{request.resolution_note}</p>}
                </li>)}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default function LegalPage({ page }) {
  const content = policyContent[page]
  if (!content) return null

  return (
    <main className="min-h-screen bg-secondary/20 px-4 py-8 sm:py-12">
      <article className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-9">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Back to SyncLiving</Link>
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Draft — not approved for production</p><p className="mt-1 text-sm">Prepared {DRAFT_DATE}. Replace every bracketed placeholder and obtain legal review before publication or accepting new registrations.</p></div></div>
        </div>
        <h1 className="mt-7 text-3xl font-bold tracking-tight">{content.title}</h1>
        <p className="mt-3 leading-7 text-gray-600 dark:text-gray-300">{content.intro}</p>
        <div className="mt-7 space-y-6">
          {content.sections.map(([heading, body]) => <section key={heading}>
            <h2 className="text-lg font-semibold">{heading}</h2>
            <p className="mt-2 leading-7 text-gray-600 dark:text-gray-300">{body}</p>
          </section>)}
        </div>
        {page === 'data-requests' && <PrivacyRequestForm />}
        {page === 'privacy' && <p className="mt-8 border-t border-border pt-5 text-sm text-gray-500">Privacy concerns: <Link className="text-primary underline" to="/data-requests">submit a request</Link> or see <Link className="text-primary underline" to="/contact">contact details</Link>.</p>}
      </article>
    </main>
  )
}
