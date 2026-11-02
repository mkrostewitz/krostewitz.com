import {getLeadSettings} from "../../lib/leadSettings";
import LeadRequirementsProvider from "./LeadRequirements";
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

  return <AdminMuiProvider><LeadSnackbarProvider><LeadRequirementsProvider initialSettings={await getLeadSettings()}><LeadManager user={user} /></LeadRequirementsProvider></LeadSnackbarProvider></AdminMuiProvider>;
}
