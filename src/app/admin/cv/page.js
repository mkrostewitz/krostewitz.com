import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../lib/adminAuth";
import AdminMuiProvider from "../components/forms/AdminMuiProvider";
import CvManager from "./CvManager";

export default async function AdminCvPage() {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return <AdminMuiProvider><CvManager user={user} /></AdminMuiProvider>;
}
