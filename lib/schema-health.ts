import { createSupabaseBrowserClient } from '@/lib/supabase';

export type SchemaHealth = {
  ok: boolean;
  missingYjs: boolean;
  missingDashboardColumns: boolean;
  message?: string;
};

export async function checkSchemaHealth(): Promise<SchemaHealth> {
  const supabase = createSupabaseBrowserClient();

  const { error: yjsError } = await supabase
    .from('documents')
    .select('yjs_state')
    .limit(1);

  const missingYjs = !!yjsError && /column .* does not exist|42703|PGRST204/i.test(yjsError.message);

  const { error: dashError } = await supabase
    .from('documents')
    .select('project_name, parent_id, doc_status')
    .limit(1);

  const missingDashboardColumns =
    !!dashError && /column .* does not exist|42703|PGRST204/i.test(dashError.message);

  if (missingYjs || missingDashboardColumns) {
    const parts: string[] = [];
    if (missingYjs) parts.push('20260423180000_yjs_state.sql');
    if (missingDashboardColumns) parts.push('20260514120000_dashboard_projects_branches.sql');
    return {
      ok: false,
      missingYjs,
      missingDashboardColumns,
      message: `Apply Supabase migrations: ${parts.join(', ')}`,
    };
  }

  return { ok: true, missingYjs: false, missingDashboardColumns: false };
}
