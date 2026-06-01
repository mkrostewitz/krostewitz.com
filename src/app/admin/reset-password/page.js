import styles from "../admin.module.css";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = {
  title: "Reset admin password",
  robots: {
    index: false,
    follow: false,
  },
  referrer: "no-referrer",
};

function firstSearchParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminResetPasswordPage({searchParams} = {}) {
  const params = await searchParams;
  const challenge = firstSearchParam(params?.challenge) || "";
  const token = firstSearchParam(params?.token) || "";

  return (
    <main className={styles.loginShell}>
      <ResetPasswordForm challenge={challenge} token={token} />
    </main>
  );
}
