import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../lib/adminAuth";
import LeadManager from "./LeadManager";

export default async function AdminLeadsPage() {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return <LeadManager user={user} />;
}
