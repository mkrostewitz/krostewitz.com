"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect, useState} from "react";

import ThemeToggle from "../components/theme/ThemeToggle";
import styles from "./admin.module.css";

const DEFAULT_LOGO_URL = "/logo.svg";
const DEFAULT_SITE_TITLE = process.env.NEXT_PUBLIC_SITE_NAME || "Site";

export default function AdminHeader({active, user}) {
  const router = useRouter();
  const [siteMetadata, setSiteMetadata] = useState({
    logoUrl: DEFAULT_LOGO_URL,
    title: DEFAULT_SITE_TITLE,
  });

  async function logout() {
    await fetch("/api/admin/auth/logout", {method: "POST"});
    router.replace("/admin/login");
    router.refresh();
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadSiteMetadata() {
      try {
        const response = await fetch("/api/content/profile", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error("Unable to load site metadata.");
        }

        const metadata = data.profile?.metadata || {};
        setSiteMetadata({
          logoUrl: metadata.logoUrl || DEFAULT_LOGO_URL,
          title: metadata.title || DEFAULT_SITE_TITLE,
        });
      } catch (error) {
        if (error?.name !== "AbortError") {
          setSiteMetadata({
            logoUrl: DEFAULT_LOGO_URL,
            title: DEFAULT_SITE_TITLE,
          });
        }
      }
    }

    void loadSiteMetadata();

    return () => {
      controller.abort();
    };
  }, []);

  const siteAbbreviation =
    process.env.NEXT_PUBLIC_SITE_ABBREVIATION || siteMetadata.title;

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <Link href="/admin" className={styles.brandLogoLink}>
          <img
            src={siteMetadata.logoUrl}
            alt={`${siteMetadata.title} logo`}
            width="44"
            height="44"
            className={styles.brandLogo}
          />
        </Link>
        <div className={styles.brandText}>
          <strong>{siteAbbreviation}</strong>
          <span className={styles.muted}>{user?.email}</span>
        </div>
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
