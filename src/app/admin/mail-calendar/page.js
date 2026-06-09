import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../lib/adminAuth";
import MailCalendarSettings from "./MailCalendarSettings";

export default async function AdminMailCalendarPage() {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return <MailCalendarSettings user={user} />;
}
