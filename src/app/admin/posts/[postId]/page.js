import {notFound, redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../../lib/adminAuth";
import {getAdminPostById, PostValidationError} from "../../../lib/posts";
import AdminHeader from "../../AdminHeader";
import styles from "../../admin.module.css";
import EditPostForm from "../EditPostForm";

export default async function EditPostPage({params}) {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  const {postId} = await params;
  let post = null;

  try {
    post = await getAdminPostById(postId);
  } catch (error) {
    if (error instanceof PostValidationError) {
      notFound();
    }

    throw error;
  }

  if (!post) {
    notFound();
  }

  return (
    <div className={styles.shell}>
      <AdminHeader active="posts" user={user} />

      <main className={styles.main}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <h1>Edit post</h1>
            <p className={styles.muted}>{post.title}</p>
          </div>
        </div>

        <div className={styles.postWorkspace}>
          <EditPostForm post={post} />
        </div>
      </main>
    </div>
  );
}
