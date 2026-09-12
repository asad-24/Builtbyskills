import { vi } from "vitest"

vi.mock("@mux/mux-player-react", () => ({
  __esModule: true,
  default: ({ playbackId, tokens, title, ...props }: { [key: string]: unknown }) => {
    return (
      <div
        data-testid="mux-player"
        data-playback-id={playbackId}
        data-tokens={tokens ? JSON.stringify(tokens) : undefined}
        data-title={title}
        {...props}
      />
    )
  },
}))
