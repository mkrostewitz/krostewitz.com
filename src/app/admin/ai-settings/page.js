import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../lib/adminAuth";
import AiSettingsManager from "./AiSettingsManager";

export default async function AdminAiSettingsPage() {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return <AiSettingsManager user={user} />;
}
