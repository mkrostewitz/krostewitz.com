import Image from "next/image";
import Link from "next/link";
import {useState} from "react";
import {useTranslation} from "react-i18next";

import AddressMap from "../address-map/AddressMap";
import {usePublicSettings} from "../public-settings/PublicSettingsProvider";
import {useSnackbar} from "../snackbar/SnackbarProvider";
import pageStyles from "../../page.module.css";
import "../../buttons.css";
import LeadCaptureModal from "./LeadCaptureModal";
import styles from "./contact-section.module.css";

const CONTACT_EMAIL = String(process.env.NEXT_PUBLIC_CONTACT_EMAIL || "").trim();

const ContactSection = () => {
  const {i18n, t} = useTranslation();
  const {closeSnackbar} = useSnackbar();
  const {bookingUrl, profile, profileName} = usePublicSettings();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const address = profile.address?.label ? profile.address : null;
  const contactPortraitAlt = profileName || "Mathias Krostewitz";
  const addressLabelDefault = i18n.language?.toLowerCase().startsWith("de")
    ? "Adresse"
    : "Address";
  const addressMapLabelDefault = i18n.language?.toLowerCase().startsWith("de")
    ? "Karte der Adresse"
    : "Address map";

  function openContactModal() {
    closeSnackbar();
    setIsModalOpen(true);
  }

  return (
    <section id="contact" className={`${pageStyles.section} ${styles.section}`}>
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("contact.eyebrow")}</p>
        <h2>{t("contact.title")}</h2>
        <p className={pageStyles.lead}>{t("contact.intro")}</p>
      </div>

      <div className={styles.contactGrid}>
        <aside className={styles.contactCard}>
          <div className={styles.cardIntro}>
            <h3>{t("contact.directTitle")}</h3>
            <p>{t("contact.directNote")}</p>
          </div>

          <div className={styles.contactPortrait}>
            <Image
              src="/mk.png"
              alt={contactPortraitAlt}
              className={styles.contactPortraitImage}
              fill
              sizes="(max-width: 960px) 120px, 180px"
            />
          </div>

          <div className={styles.contactStack}>
            <div className={styles.contactDetails}>
              <a className={styles.contactLink} href="tel:+16505615752">
                <span>{t("contact.phoneLabel")}</span>
                <strong>{t("contact.phoneNumber")}</strong>
              </a>
              {CONTACT_EMAIL && (
                <a
                  className={styles.contactLink}
                  href={`mailto:${CONTACT_EMAIL}`}
                >
                  <span>{t("contact.emailLabel")}</span>
                  <strong>{CONTACT_EMAIL}</strong>
                </a>
              )}
              {address && (
                <address className={styles.contactAddress}>
                  <span>
                    {t("contact.addressLabel", {
                      defaultValue: addressLabelDefault,
                    })}
                  </span>
                  <strong>{address.label}</strong>
                </address>
              )}
            </div>
          </div>

          <div className={styles.contactActions}>
            {bookingUrl && (
              <Link
                className={`primary ${styles.actionButton}`}
                href={bookingUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t("buttons.booking")}
              </Link>
            )}
            <button
              type="button"
              className={`secondary ${styles.actionButton}`}
              onClick={openContactModal}
            >
              {t("contact.form.submit")}
            </button>
            <Link
              aria-label={t("buttons.linkedin")}
              className={styles.linkedinIcon}
              href="https://www.linkedin.com/in/mkrostewitz"
              target="_blank"
              rel="noreferrer"
              title={t("buttons.linkedin")}
            >
              in
            </Link>
          </div>
        </aside>

        {address && (
          <AddressMap
            address={address}
            className={styles.contactMap}
            label={t("contact.addressMapLabel", {
              defaultValue: addressMapLabelDefault,
            })}
            markerScale={0.72}
            zoom={12.9}
          />
        )}
      </div>

      <LeadCaptureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sourceType="contact_form"
      />
    </section>
  );
};

export default ContactSection;
