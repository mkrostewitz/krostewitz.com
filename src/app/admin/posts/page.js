import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../lib/adminAuth";
import PostManager from "./PostManager";

export default async function AdminPostsPage() {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return <PostManager user={user} />;
}
