import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../../lib/adminAuth";
import AdminHeader from "../../AdminHeader";
import styles from "../../admin.module.css";
import EditPostForm from "../EditPostForm";

export default async function NewPostPage() {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return (
    <div className={styles.shell}>
      <AdminHeader active="posts" user={user} />

      <main className={styles.main}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <h1>Create post</h1>
            <p className={styles.muted}>
              Create a new blog post with rich text and hosted media.
            </p>
          </div>
        </div>

        <div className={styles.postWorkspace}>
          <EditPostForm />
        </div>
      </main>
    </div>
  );
}
