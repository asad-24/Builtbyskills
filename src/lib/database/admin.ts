import "server-only"
import { DatabaseClient } from "./client"
export function createDatabaseAdminClient() { return new DatabaseClient({ service: true }) }
