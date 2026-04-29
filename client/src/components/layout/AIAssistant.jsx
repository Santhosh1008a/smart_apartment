import { useEffect, useMemo, useRef, useState } from "react"
import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react"
import { askAssistant } from "../../api/assistant"
import { useAuthStore } from "../../store/useAuthStore"
import { cn } from "../../utils/cn"

const QUICK_SUGGESTIONS = {
  resident: ["Do I have unpaid dues?", "Show today's visitors", "What is my parking status?", "Show my notifications"],
  admin: ["Which residents have overdue payments?", "How many parking slots are vacant?", "Show active emergencies", "Give me society analytics"],
  security: ["Show today's visitors", "Show active emergencies", "How many parking slots are vacant?", "Give me security stats"],
  vendor: ["What jobs are assigned to me?", "Show my notifications", "Give me my job summary"],
  super_admin: ["Show platform analytics", "Show society insights", "Show active emergencies", "Show overdue payments"],
}

const roleAccent = {
  resident: "from-primary to-primary-hover",
  admin: "from-violet-600 to-purple-700",
  security: "from-emerald-500 to-teal-600",
  vendor: "from-amber-500 to-orange-600",
  super_admin: "from-indigo-600 to-blue-700",
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [lastDebug, setLastDebug] = useState(null)
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi, I can help summarize your society data.",
    },
  ])
  const user = useAuthStore((state) => state.user)
  const messagesEndRef = useRef(null)
  const messagesScrollRef = useRef(null)
  const inputRef = useRef(null)

  const role = user?.role || "resident"
  const suggestions = useMemo(() => QUICK_SUGGESTIONS[role] || QUICK_SUGGESTIONS.resident, [role])
  const accent = roleAccent[role] || roleAccent.resident

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [isOpen, messages, isLoading])

  const submitPrompt = async (prompt) => {
    const text = prompt.trim()
    if (!text || isLoading) return

    setInput("")
    setMessages((current) => [...current, { role: "user", content: text }])
    setIsLoading(true)

    try {
      const res = await askAssistant(text)
      const assistantResponse = res?.response?.message || res?.ai_response || "I couldn't format a response for that yet."
      setLastDebug(res?.debug ? {
        intent: res.intent || "unknown",
        rows: res.rows ?? 0,
        unitId: res.debug.unitId || null,
        complexId: res.debug.complexId || null,
        apiStatus: res.debug.apiStatus || 200,
        service: res.service || res.debug.service || null,
      } : null)
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: assistantResponse,
        },
      ])
    } catch (err) {
      setLastDebug(null)
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: err?.response?.data?.message || "Assistant API request failed. Check console logs.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    submitPrompt(input)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[80] h-14 w-14 rounded-full bg-gradient-to-br text-white shadow-xl shadow-slate-900/20 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          accent
        )}
        aria-label="Open AI assistant"
      >
        <MessageCircle className="mx-auto h-6 w-6" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[90] pointer-events-none">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px] pointer-events-auto sm:bg-transparent sm:backdrop-blur-0"
            onClick={() => setIsOpen(false)}
          />

          <section className="absolute inset-x-2 bottom-2 pointer-events-auto sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px]">
            <div className="flex h-[min(720px,calc(100dvh-1rem))] min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl sm:h-[min(720px,calc(100dvh-3rem))]">
              <header className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white", accent)}>
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-foreground">Society Assistant</h2>
                    <p className="truncate text-xs capitalize text-gray-500">{role.replace("_", " ")}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md p-2 text-gray-500 transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Close assistant"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div ref={messagesScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 custom-scrollbar">
                <div className="min-h-full space-y-3">
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[82%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm leading-6 shadow-sm",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-background text-foreground"
                        )}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-gray-500 shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Thinking</span>
                        <span className="flex gap-1">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" />
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400 [animation-delay:120ms]" />
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400 [animation-delay:240ms]" />
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="flex-shrink-0 border-t border-border bg-card p-3 sm:p-4">
                {lastDebug && (
                  <div className="mb-3 grid grid-cols-2 gap-2 rounded-md border border-border bg-background p-2 text-[11px] text-gray-500 sm:grid-cols-3">
                    <div className="min-w-0">
                      <span className="block font-semibold text-foreground">Intent</span>
                      <span className="block truncate">{lastDebug.intent}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block font-semibold text-foreground">Rows</span>
                      <span className="block truncate">{lastDebug.rows}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block font-semibold text-foreground">API</span>
                      <span className="block truncate">{lastDebug.apiStatus}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block font-semibold text-foreground">Unit</span>
                      <span className="block truncate">{lastDebug.unitId || "none"}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block font-semibold text-foreground">Complex</span>
                      <span className="block truncate">{lastDebug.complexId || "none"}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block font-semibold text-foreground">Service</span>
                      <span className="block truncate">{lastDebug.service || "none"}</span>
                    </div>
                  </div>
                )}
                <div className="-mx-1 mb-3 flex max-w-full gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => submitPrompt(suggestion)}
                      disabled={isLoading}
                      className="max-w-[78vw] flex-shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50 sm:max-w-[260px]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className="flex items-end gap-2">
                  <div className="relative flex-1">
                    <Sparkles className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault()
                          submitPrompt(input)
                        }
                      }}
                      rows={1}
                      maxLength={500}
                      placeholder="Ask about dues, visitors, parking, jobs..."
                      className="max-h-28 min-h-11 w-full resize-none rounded-md border border-input bg-background py-3 pl-9 pr-3 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className={cn(
                      "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white shadow-sm transition-opacity disabled:opacity-50",
                      accent
                    )}
                    aria-label="Send message"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
