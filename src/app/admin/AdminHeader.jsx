"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {useRouter} from "next/navigation";
import {Menu, X} from "lucide-react";
import {useEffect, useRef, useState} from "react";

import ThemeToggle from "../components/theme/ThemeToggle";
import styles from "./admin.module.css";

const DEFAULT_LOGO_URL = "/logo.svg";
const DEFAULT_SITE_TITLE = process.env.NEXT_PUBLIC_SITE_NAME || "Site";
const ADMIN_MENU_ID = "admin-menu-panel";
const ADMIN_NAV_ITEMS = [
  {active: "profile", href: "/admin/profile", label: "Profile"},
  {active: "posts", href: "/admin/posts", label: "Posts"},
  {
    active: "githubPortfolio",
    href: "/admin/github-portfolio",
    label: "GitHub Portfolio",
  },
  {active: "aiSettings", href: "/admin/ai-settings", label: "AI Settings"},
  {active: "leads", href: "/admin/leads", label: "Leads"},
  {active: "cv", href: "/admin/cv", label: "CV"},
  {active: "security", href: "/admin/security", label: "Security"},
];

export default function AdminHeader({active, user}) {
  const router = useRouter();
  const menuRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [siteMetadata, setSiteMetadata] = useState({
    logoUrl: DEFAULT_LOGO_URL,
    title: DEFAULT_SITE_TITLE,
  });

  async function logout() {
    setIsMenuOpen(false);
    await fetch("/api/admin/auth/logout", {method: "POST"});
    router.replace("/admin/login");
    router.refresh();
  }

  function closeMenu() {
    setIsMenuOpen(false);
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

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

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
        <ThemeToggle />

        <div className={styles.adminMenu} ref={menuRef}>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.menuButton}`}
            aria-label={isMenuOpen ? "Close admin menu" : "Open admin menu"}
            aria-controls={ADMIN_MENU_ID}
            aria-expanded={isMenuOpen}
            title={isMenuOpen ? "Close admin menu" : "Open admin menu"}
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            {isMenuOpen ? (
              <X aria-hidden="true" size={20} strokeWidth={2.2} />
            ) : (
              <Menu aria-hidden="true" size={20} strokeWidth={2.2} />
            )}
          </button>

          <div
            id={ADMIN_MENU_ID}
            className={`${styles.adminMenuPanel} ${
              isMenuOpen ? styles.adminMenuPanelOpen : ""
            }`}
          >
            <nav className={styles.adminNav} aria-label="Admin">
              {ADMIN_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  className={`${styles.navLink} ${
                    active === item.active ? styles.navLinkActive : ""
                  }`}
                  href={item.href}
                  onClick={closeMenu}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <button
              type="button"
              className={`${styles.ghostButton} ${styles.menuLogoutButton}`}
              onClick={logout}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
