import Image from "next/image";
import Link from "next/link";
import {useEffect, useState} from "react";
import {Trans, useTranslation} from "react-i18next";

import pageStyles from "../../page.module.css";
import styles from "./fold-section.module.css";
import "../../buttons.css";

const FoldSection = () => {
  const [bookingUrl, setBookingUrl] = useState("");
  const [profileName, setProfileName] = useState("");
  const {t} = useTranslation(undefined, {
    keyPrefix: "offer",
  });
  const {t: transButtons} = useTranslation(null, {
    keyPrefix: "buttons",
  });
  const points = t("points", {returnObjects: true});

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfileSettings() {
      try {
        const response = await fetch("/api/content/profile", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error("Unable to load booking settings.");
        }

        const profile = data.profile || {};
        const koalendar = profile.koalendar;
        setProfileName(profile.name?.fullName || "");
        setBookingUrl(
          koalendar?.enabled && koalendar?.bookingUrl
            ? koalendar.bookingUrl
            : ""
        );
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.warn("Unable to load profile settings", error);
          setProfileName("");
          setBookingUrl("");
        }
      }
    }

    void loadProfileSettings();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <header className={styles.hero}>
      <div className={styles.copy}>
        <p className={pageStyles.eyebrow}>{t("eyebrow")}</p>
        <h2 dangerouslySetInnerHTML={{__html: t("title")}} />

        <p className={styles.lead}>
          <Trans i18nKey="offer.subtitle" components={{br: <br />}}>
            {t("subtitle")}
          </Trans>
        </p>

        <ul className={styles.points}>
          {points.map((point, index) => (
            <li key={point}>
              <Trans
                i18nKey={`offer.points.${index}`}
                components={{br: <br />, strong: <strong />}}
              >
                {point}
              </Trans>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          {bookingUrl && (
            <Link
              href={bookingUrl}
              className="primary"
              target="_blank"
              rel="noreferrer"
            >
              {transButtons("booking")}
            </Link>
          )}
          <Link
            href="https://www.linkedin.com/in/mkrostewitz"
            className="secondary"
            target="_blank"
            rel="noreferrer"
          >
            {transButtons("linkedin")}
          </Link>
        </div>
      </div>
      <div className={styles.portraitShell}>
        <Image
          src="/mk.png"
          alt={profileName ? t("alt", {profileName}) : t("altFallback")}
          fill
          sizes="(max-width: 960px) 100vw, 38vw"
          className={styles.portrait}
          priority
        />
      </div>
    </header>
  );
};

export default FoldSection;
