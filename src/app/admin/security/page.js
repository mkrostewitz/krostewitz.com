import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../lib/adminAuth";
import SecuritySettings from "./SecuritySettings";

export default async function AdminSecurityPage() {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return <SecuritySettings user={user} />;
}
