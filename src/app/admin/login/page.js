import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../lib/adminAuth";
import styles from "../admin.module.css";
import LoginForm from "./LoginForm";

export default async function AdminLoginPage() {
  const user = await getCurrentAdminUser();

  if (user) {
    redirect("/admin/posts");
  }

  return (
    <main className={styles.loginShell}>
      <LoginForm />
    </main>
  );
}
