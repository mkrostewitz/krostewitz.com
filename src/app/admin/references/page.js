import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../lib/adminAuth";
import AdminMuiProvider from "../components/forms/AdminMuiProvider";
import ReferencesSettings from "./ReferencesSettings";

export default async function AdminReferencesPage() {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return <AdminMuiProvider><ReferencesSettings user={user} /></AdminMuiProvider>;
}
