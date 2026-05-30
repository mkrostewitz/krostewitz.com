"use client";

import Link from "next/link";
import {useEffect} from "react";
import {useTranslation} from "react-i18next";

import "../../../lib/i18n";
import styles from "../../legal.module.css";

function Paragraphs({items}) {
  return items.map((item) => <p key={item}>{item}</p>);
}

function ListItems({items}) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function ImpressumContent({legal}) {
  const {t} = useTranslation();

  useEffect(() => {
    document.title = t("legal.impressum.metaTitle");
  }, [t]);

  return (
    <main className={styles.main}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>{t("legal.impressum.eyebrow")}</p>
        <h1>{t("legal.impressum.title")}</h1>
        <p className={styles.lead}>
          {t("legal.impressum.lead", {siteName: legal.siteName})}
        </p>
      </header>

      <div className={styles.content}>
        <section className={styles.section}>
          <h2>{t("legal.impressum.provider.title")}</h2>
          <address className={styles.address}>
            <strong>{legal.ownerName}</strong>
            <br />
            {legal.legalAddress ? (
              legal.legalAddress
            ) : (
              <span className={styles.muted}>
                {t("legal.impressum.provider.missingAddress")}
              </span>
            )}
          </address>
        </section>

        <section className={styles.section}>
          <h2>{t("legal.impressum.contact.title")}</h2>
          <dl className={styles.metaList}>
            {legal.email && (
              <div>
                <dt>{t("legal.fields.email")}</dt>
                <dd>
                  <a href={`mailto:${legal.email}`}>{legal.email}</a>
                </dd>
              </div>
            )}
            {legal.phone && (
              <div>
                <dt>{t("legal.fields.phone")}</dt>
                <dd>{legal.phone}</dd>
              </div>
            )}
            <div>
              <dt>{t("legal.fields.website")}</dt>
              <dd>
                <Link href={legal.siteUrl}>{legal.siteUrl}</Link>
              </dd>
            </div>
          </dl>
        </section>

        {(legal.vatId || legal.businessRegister) && (
          <section className={styles.section}>
            <h2>{t("legal.impressum.business.title")}</h2>
            <dl className={styles.metaList}>
              {legal.vatId && (
                <div>
                  <dt>{t("legal.fields.vatId")}</dt>
                  <dd>{legal.vatId}</dd>
                </div>
              )}
              {legal.businessRegister && (
                <div>
                  <dt>{t("legal.fields.register")}</dt>
                  <dd>{legal.businessRegister}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        <section className={styles.section}>
          <h2>{t("legal.impressum.editorial.title")}</h2>
          <p>
            {legal.responsiblePerson}
            {legal.legalAddress ? `, ${legal.legalAddress}` : ""}
          </p>
        </section>

        <section className={styles.section}>
          <h2>{t("legal.impressum.dispute.title")}</h2>
          <p>{t("legal.impressum.dispute.body")}</p>
        </section>

        <section className={styles.section}>
          <h2>{t("legal.impressum.liability.title")}</h2>
          <p>{t("legal.impressum.liability.body")}</p>
        </section>
      </div>
    </main>
  );
}

export function PrivacyContent({legal}) {
  const {t} = useTranslation();
  const legalBases = t("legal.privacy.legalBases.items", {returnObjects: true});

  useEffect(() => {
    document.title = t("legal.privacy.metaTitle");
  }, [t]);

  return (
    <main className={styles.main}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>{t("legal.privacy.eyebrow")}</p>
        <h1>{t("legal.privacy.title")}</h1>
        <p className={styles.lead}>
          {t("legal.privacy.lead", {siteName: legal.siteName})}
        </p>
        <p className={styles.muted}>{t("legal.privacy.updated")}</p>
      </header>

      <div className={styles.content}>
        <section className={styles.section}>
          <h2>{t("legal.privacy.controller.title")}</h2>
          <address className={styles.address}>
            <strong>{legal.ownerName}</strong>
            <br />
            {legal.legalAddress || t("legal.privacy.controller.addressPending")}
            <br />
            {legal.email && (
              <>
                {t("legal.fields.email")}:{" "}
                <a href={`mailto:${legal.email}`}>{legal.email}</a>
              </>
            )}
          </address>
        </section>

        <section className={styles.section}>
          <h2>{t("legal.privacy.visit.title")}</h2>
          <Paragraphs
            items={t("legal.privacy.visit.paragraphs", {returnObjects: true})}
          />
        </section>

        <section className={styles.section}>
          <h2>{t("legal.privacy.contact.title")}</h2>
          <Paragraphs
            items={t("legal.privacy.contact.paragraphs", {returnObjects: true})}
          />
        </section>

        <section className={styles.section}>
          <h2>{t("legal.privacy.storage.title")}</h2>
          <p>{t("legal.privacy.storage.body")}</p>
        </section>

        {legal.usesGoogleAnalytics && (
          <section className={styles.section}>
            <h2>{t("legal.privacy.analytics.title")}</h2>
            <Paragraphs
              items={t("legal.privacy.analytics.paragraphs", {
                returnObjects: true,
              })}
            />
          </section>
        )}

        <section className={styles.section}>
          <h2>{t("legal.privacy.external.title")}</h2>
          <Paragraphs
            items={t("legal.privacy.external.paragraphs", {returnObjects: true})}
          />
        </section>

        <section className={styles.section}>
          <h2>{t("legal.privacy.linkedin.title")}</h2>
          <Paragraphs
            items={t("legal.privacy.linkedin.paragraphs", {
              returnObjects: true,
            })}
          />
        </section>

        <section className={styles.section}>
          <h2>{t("legal.privacy.ai.title")}</h2>
          <p>{t("legal.privacy.ai.body")}</p>
        </section>

        <section className={styles.section}>
          <h2>{t("legal.privacy.legalBases.title")}</h2>
          <ListItems items={Array.isArray(legalBases) ? legalBases : []} />
        </section>

        <section className={styles.section}>
          <h2>{t("legal.privacy.rights.title")}</h2>
          <Paragraphs
            items={t("legal.privacy.rights.paragraphs", {returnObjects: true})}
          />
        </section>

        <section className={styles.section}>
          <h2>{t("legal.privacy.updates.title")}</h2>
          <p>{t("legal.privacy.updates.body")}</p>
        </section>
      </div>
    </main>
  );
}
