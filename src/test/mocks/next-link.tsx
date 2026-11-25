import { vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ children, href, prefetch, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => {
    void prefetch
    return <a href={href} {...props}>{children}</a>
  },
}))
