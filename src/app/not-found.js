import {ArrowLeft, FileQuestion, Home, Mail, Search} from "lucide-react";
import Link from "next/link";

import PublicFooter from "./components/footer/PublicFooter";
import NavBar from "./components/nav/nav";
import "./buttons.css";
import styles from "./not-found.module.css";

export const metadata = {
  title: "Page not found",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className={styles.page}>
      <NavBar />

      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="not-found-title">
          <div className={styles.copy}>
            <p className={styles.eyebrow}>404 / Not found</p>
            <h1 id="not-found-title">This page is not available.</h1>
            <p className={styles.lead}>
              The address may have changed, the post may be unpublished, or the
              link may contain a typo. Start from the homepage or jump to the
              most useful sections below.
            </p>

            <div className={styles.actions} aria-label="404 page navigation">
              <Link className={`primary ${styles.primaryAction}`} href="/">
                <Home aria-hidden="true" size={18} strokeWidth={2.4} />
                Home
              </Link>
              <Link className={`secondary ${styles.secondaryAction}`} href="/#blog">
                <Search aria-hidden="true" size={18} strokeWidth={2.4} />
                Blog
              </Link>
              <Link className={styles.textAction} href="/#contact">
                <Mail aria-hidden="true" size={18} strokeWidth={2.4} />
                Contact
              </Link>
            </div>
          </div>

          <div className={styles.visual} aria-hidden="true">
            <div className={styles.statusCard}>
              <div className={styles.statusTop}>
                <span />
                <span />
                <span />
              </div>
              <div className={styles.statusBody}>
                <FileQuestion size={46} strokeWidth={1.7} />
                <div>
                  <span className={styles.code}>404</span>
                  <p>Route missing</p>
                </div>
              </div>
              <div className={styles.trace}>
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className={styles.routeLine}>
              <ArrowLeft size={22} strokeWidth={2.2} />
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
