import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../lib/adminAuth";
import ProfileSettings from "./ProfileSettings";

export default async function AdminProfilePage() {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return <ProfileSettings user={user} />;
}
