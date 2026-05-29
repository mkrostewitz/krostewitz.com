"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";

import ThemeToggle from "../components/theme/ThemeToggle";
import styles from "./admin.module.css";

export default function AdminHeader({active, user}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/auth/logout", {method: "POST"});
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <strong>{process.env.NEXT_PUBLIC_SITE_ABBREVIATION}</strong>
        <span className={styles.muted}>{user?.email}</span>
      </div>

      <div className={styles.headerActions}>
        <nav className={styles.adminNav} aria-label="Admin">
          <Link
            className={`${styles.navLink} ${
              active === "profile" ? styles.navLinkActive : ""
            }`}
            href="/admin/profile"
          >
            Profile
          </Link>
          <Link
            className={`${styles.navLink} ${
              active === "posts" ? styles.navLinkActive : ""
            }`}
            href="/admin/posts"
          >
            Posts
          </Link>
          <Link
            className={`${styles.navLink} ${
              active === "githubPortfolio" ? styles.navLinkActive : ""
            }`}
            href="/admin/github-portfolio"
          >
            GitHub Portfolio
          </Link>
          <Link
            className={`${styles.navLink} ${
              active === "aiSettings" ? styles.navLinkActive : ""
            }`}
            href="/admin/ai-settings"
          >
            AI Settings
          </Link>
          <Link
            className={`${styles.navLink} ${
              active === "cv" ? styles.navLinkActive : ""
            }`}
            href="/admin/cv"
          >
            CV
          </Link>
          <Link
            className={`${styles.navLink} ${
              active === "security" ? styles.navLinkActive : ""
            }`}
            href="/admin/security"
          >
            Security
          </Link>
        </nav>

        <ThemeToggle />

        <button className={styles.ghostButton} onClick={logout}>
          Sign out
        </button>
      </div>
    </header>
  );
}
