/* eslint-disable @typescript-eslint/no-explicit-any -- Compatibility surface while existing LMS callers retain their query/result shapes. */
import "server-only"
import { Query, databaseError } from "./query"
import { type Access } from "./access"
import { type Table } from "./schema"
import { FileStore } from "./storage"
import { provisionAuthUser, generatePasswordLink } from "./auth"
import { runOperation } from "./operations"

export class DatabaseClient {
  readonly storage = new FileStore()
  auth: any
  constructor(readonly access: Access) {
    this.auth = {
      admin: {
        createUser: async (input: Parameters<typeof provisionAuthUser>[0]) => {
          if (!access.service) throw new Error("Forbidden")
          return provisionAuthUser(input)
        },
        generateLink: async (input: { email: string }) => {
          if (!access.service) throw new Error("Forbidden")
          return generatePasswordLink(input.email)
        },
      },
    }
  }
  from(table: string) { return new Query(table as Table, this.access) }
  async rpc(name: string, args: Record<string, any> = {}) {
    try { return { data: await runOperation(name, args, this.access), error: null } }
    catch (error) { return { data: null, error: databaseError(error) } }
  }
}
