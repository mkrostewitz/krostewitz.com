import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../lib/adminAuth";
import ProfileSettings from "./ProfileSettings";
import AdminMuiProvider from "../components/forms/AdminMuiProvider";

export default async function AdminProfilePage() {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return <AdminMuiProvider><ProfileSettings user={user} /></AdminMuiProvider>;
}
