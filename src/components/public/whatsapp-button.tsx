import { MessageCircle, Phone } from "lucide-react"

export function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/923146495753"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp at +92 314 6495753 (opens in a new tab)"
      title="WhatsApp: +92 314 6495753"
      className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-14 min-w-14 items-center justify-center gap-3 rounded-full bg-[#128C45] px-4 text-white shadow-lg transition-colors hover:bg-[#0D7037] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#128C45] sm:right-6 sm:px-5"
    >
      <span className="relative size-7 shrink-0" aria-hidden="true">
        <MessageCircle className="size-7" strokeWidth={1.8} />
        <Phone className="absolute left-2 top-1.5 size-3" strokeWidth={2} />
      </span>
      <span className="hidden text-sm font-semibold sm:inline">Chat on WhatsApp</span>
    </a>
  )
}
