import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../lib/adminAuth";
import {isLinkedInSignInAvailable} from "../../lib/linkedinAuth";
import styles from "../admin.module.css";
import LoginForm from "./LoginForm";

function firstSearchParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminLoginPage({searchParams} = {}) {
  const user = await getCurrentAdminUser();

  if (user) {
    redirect("/admin/posts");
  }

  const params = await searchParams;
  const code = firstSearchParam(params?.code);
  const state = firstSearchParam(params?.state);

  if (code && state) {
    const callbackParams = new URLSearchParams({
      code: String(code),
      state: String(state),
    });

    redirect(`/api/admin/auth/linkedin/callback?${callbackParams.toString()}`);
  }

  return (
    <main className={styles.loginShell}>
      <LoginForm linkedInSignInEnabled={isLinkedInSignInAvailable()} />
    </main>
  );
}
