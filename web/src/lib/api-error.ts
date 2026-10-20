export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public retryAfter?: number,
  ) {
    super(message);
  }
  /** True when waiting and retrying is the right response. */
  get transient() {
    return ["warming_up", "busy", "timeout", "unreachable", "network"].includes(this.code);
  }
}
