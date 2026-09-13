import { createSupabaseBrowserClient } from '@/lib/supabase';

type TelemetryEventName =
  | 'document_created'
  | 'branch_created'
  | 'merge_preview_opened'
  | 'merge_completed'
  | 'export_clicked';

function isMissingTableError(message: string, code?: string): boolean {
  return /relation .* does not exist|42P01|PGRST205/i.test(message + ' ' + (code ?? ''));
}

export async function trackEvent(
  name: TelemetryEventName,
  payload: Record<string, unknown> = {}
): Promise<void> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('analytics_events').insert({
      event_name: name,
      payload,
      created_at: new Date().toISOString(),
    });

    if (!error) return;
    if (isMissingTableError(error.message, error.code ?? undefined)) return;

    console.warn('[telemetry] track failed:', error.message);
  } catch (error) {
    console.warn('[telemetry] track failed:', error);
  }
}
