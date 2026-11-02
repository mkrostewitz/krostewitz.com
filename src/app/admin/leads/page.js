import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../lib/adminAuth";
import AdminMuiProvider from "../components/forms/AdminMuiProvider";
import LeadSnackbarProvider from "./LeadSnackbar";
import LeadManager from "./LeadManager";

export default async function AdminLeadsPage() {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return <AdminMuiProvider><LeadSnackbarProvider><LeadManager user={user} /></LeadSnackbarProvider></AdminMuiProvider>;
}
