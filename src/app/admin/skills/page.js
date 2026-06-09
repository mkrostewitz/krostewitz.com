import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../lib/adminAuth";
import SkillsSettings from "./SkillsSettings";

export default async function AdminSkillsPage() {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return <SkillsSettings user={user} />;
}
