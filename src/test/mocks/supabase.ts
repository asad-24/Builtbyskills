import { vi, type Mock } from "vitest"

export type SupabaseChainable = {
  select: Mock
  insert: Mock
  update: Mock
  delete: Mock
  upsert: Mock
  eq: Mock
  or: Mock
  not: Mock
  single: Mock
  maybeSingle: Mock
  setResolveWith: (data: unknown, error?: unknown) => void
  then: (...args: unknown[]) => unknown
}

export type SupabaseMock = {
  from: Mock
  auth: {
    signInWithPassword: Mock
    getUser: Mock
    signOut: Mock
    resetPasswordForEmail: Mock
    admin: {
      createUser: Mock
      generateLink: Mock
      listUsers: Mock
      inviteUserByEmail: Mock
    }
  }
}

export type SupabaseMockFactory = {
  mock: SupabaseMock
  tableChains: Map<string, { chain: SupabaseChainable & { setResolveWith: (data: unknown, error?: unknown) => void }; calls: unknown[][] }>
}

export function createSupabaseMock(): SupabaseMockFactory {
  const tableChains = new Map<string, { chain: SupabaseChainable & { setResolveWith: (data: unknown, error?: unknown) => void }; calls: unknown[][] }>()

  const createTableChain = (): { chain: SupabaseChainable & { setResolveWith: (data: unknown, error?: unknown) => void }; calls: unknown[][] } => {
    const calls: unknown[][] = []
    let resolveWith: { data: unknown; error: unknown } = { data: null, error: null }

    const chain: SupabaseChainable = {
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      delete: vi.fn(() => chain),
      upsert: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      or: vi.fn(() => chain),
      not: vi.fn(() => chain),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      setResolveWith: (data: unknown, error: unknown = null) => {
        resolveWith = { data, error }
      },
      then: ((onFulfilled: (value: { data: unknown; error: unknown }) => unknown) => {
        return Promise.resolve(resolveWith).then(onFulfilled)
      }) as any,
    }

    return { chain, calls }
  }

  const mock: SupabaseMock = {
    from: vi.fn((table: string) => {
      if (!tableChains.has(table)) {
        tableChains.set(table, createTableChain())
      }
      return tableChains.get(table)!.chain
    }),
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      admin: {
        createUser: vi.fn().mockResolvedValue({ data: { user: { id: "new-user-1" } }, error: null }),
        generateLink: vi.fn().mockResolvedValue({ data: { properties: { action_link: "" } }, error: null }),
        listUsers: vi.fn().mockResolvedValue({ data: { users: [] as Array<{ id: string; email: string }> }, error: null }),
        inviteUserByEmail: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
    },
  }

  return { mock, tableChains }
}
