import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../lib/adminAuth";

export default async function AdminPage() {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  redirect("/admin/posts");
}
