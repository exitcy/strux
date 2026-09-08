/** True when Postgres/PostgREST reports an unknown column (migration not applied). */
export function isMissingColumnError(message: string, code?: string): boolean {
  return /column .* does not exist|42703|PGRST204/i.test(message + ' ' + (code ?? ''));
}
