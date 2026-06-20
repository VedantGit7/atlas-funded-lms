import type { z } from "zod";
import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { AutomationRulesAdmin } from "../../../features/automation/components/AutomationRulesAdmin";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { automationRuleListResponseSchema } from "../../../server/automation/automation.dto";

type AutomationRuleListResponse = z.infer<typeof automationRuleListResponseSchema>;

export default async function AdminAutomationPage() {
  try {
    const rules = await serverApi.get<AutomationRuleListResponse>("/api/v1/automation-rules");

    return (
      <PageGate state="ready" title="Automation Rules">
        <main className="space-y-6">
          <PageHeader
            title="Automation Rules"
            description="Configure approved IF/THEN automation rules for canonical platform events."
          />
          <AutomationRulesAdmin initialRules={rules.data} canManage />
        </main>
      </PageGate>
    );
  } catch (error: unknown) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Automation Rules"
          deniedMessage="You do not have permission to manage automation rules."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Automation Rules"
          errorMessage={`Failed to load automation rules. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
