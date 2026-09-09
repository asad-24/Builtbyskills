export class MissingEnvironmentError extends Error {
  constructor(readonly keys: string[]) {
    super(`Missing required environment variables: ${keys.join(", ")}`)
    this.name = "MissingEnvironmentError"
  }
}

export class AppAuthError extends Error {
  constructor(message = "You must be signed in to continue.") {
    super(message)
    this.name = "AppAuthError"
  }
}

export class AppForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message)
    this.name = "AppForbiddenError"
  }
}
