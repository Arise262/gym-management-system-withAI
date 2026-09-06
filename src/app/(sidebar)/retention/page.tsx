import { getRetentionOverview } from "@/action/retention.action";
import { RetentionDashboard } from "@/components/retention-dashboard";

export const metadata = {
  title: "Member retention",
};

/**
 * Staff-facing retention dashboard.
 *
 * The role guard lives in getRetentionOverview (requireRole("ADMIN"), matching
 * what middleware.ts allows here) rather than in this component, so a direct POST
 * to the action is refused the same way a page visit is.
 */
export default async function RetentionPage() {
  const overview = await getRetentionOverview();
  return <RetentionDashboard overview={overview} />;
}
