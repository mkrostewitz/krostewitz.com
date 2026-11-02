import {redirect} from "next/navigation";
import {getCurrentAdminUser} from "../../lib/adminAuth";
import IntegrationsSettings from "./IntegrationsSettings";

export default async function AdminIntegrationsPage() {
  const user = await getCurrentAdminUser();
  if (!user) redirect("/admin/login");
  return <IntegrationsSettings user={user} />;
}
