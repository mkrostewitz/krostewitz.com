"use client";

/* eslint-disable @next/next/no-img-element */

import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";

import {loadRuntimeTranslations} from "../../../lib/i18n";
import AddressMap from "../../components/address-map/AddressMap";
import AdminHeader from "../AdminHeader";
import styles from "../admin.module.css";

const EMPTY_PROFILE = {
  address: null,
  blogEnabled: true,
  metadata: {
    title: "",
    description: "",
    iconUrl: "",
    iconType: "image/svg+xml",
    appIconUrl: "",
    appIconType: "image/svg+xml",
    logoUrl: "",
    logoType: "image/svg+xml",
  },
  updatedAt: null,
  updatedBy: null,
};

function formatDate(value, locale, emptyLabel) {
  if (!value) return emptyLabel;

  return new Intl.DateTimeFormat(locale || "en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getFeatureLabel(feature) {
  return String(feature?.place_name || feature?.text || "").trim();
}

function mapFeatureToAddress(feature) {
  const label = getFeatureLabel(feature);
  const [longitude, latitude] = Array.isArray(feature?.center)
    ? feature.center
    : [null, null];

  return {
    label,
    placeName: label,
    mapboxId: feature?.id || feature?.properties?.mapbox_id || "",
    longitude,
    latitude,
    source: "mapbox",
  };
}

function formatCoordinates(address, unavailableLabel) {
  if (
    typeof address?.latitude !== "number" ||
    typeof address?.longitude !== "number"
  ) {
    return unavailableLabel;
  }

  return `${address.latitude.toFixed(5)}, ${address.longitude.toFixed(5)}`;
}

function normalizeMetadataForm(metadata = {}) {
  const iconEntry = Array.isArray(metadata.icons?.icon)
    ? metadata.icons.icon[0]
    : metadata.icons?.icon;
  const appIconEntry = Array.isArray(metadata.icons?.icon)
    ? metadata.icons.icon[1]
    : null;

  return {
    title: String(metadata.title || ""),
    description: String(metadata.description || ""),
    iconUrl: String(metadata.iconUrl || iconEntry?.url || ""),
    iconType: String(metadata.iconType || iconEntry?.type || "image/svg+xml"),
    appIconUrl: String(metadata.appIconUrl || appIconEntry?.url || ""),
    appIconType: String(
      metadata.appIconType || appIconEntry?.type || "image/svg+xml"
    ),
    logoUrl: String(metadata.logoUrl || ""),
    logoType: String(metadata.logoType || "image/svg+xml"),
  };
}

function getStatusText(status, t) {
  if (!status) return "";

  return status.key ? t(status.key, status.values) : status.text || "";
}

export default function ProfileSettings({user}) {
  const {t, i18n} = useTranslation(undefined, {keyPrefix: "admin.profile"});
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  const locale = i18n.resolvedLanguage || i18n.language || "en";
  const mapboxLanguage = String(locale).split("-")[0] || "en";
  const coordinatesUnavailableLabel = t("status.coordinatesUnavailable");
  const notSavedLabel = t("status.notSaved");
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [address, setAddress] = useState(null);
  const [addressInput, setAddressInput] = useState("");
  const [blogEnabled, setBlogEnabled] = useState(true);
  const [metadataForm, setMetadataForm] = useState(() =>
    normalizeMetadataForm(EMPTY_PROFILE.metadata)
  );
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState({
    type: "message",
    key: "status.loading",
  });
  const [visibilityStatus, setVisibilityStatus] = useState(null);
  const [searchStatus, setSearchStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState(null);

  const canSearch = useMemo(
    () =>
      Boolean(
        mapboxToken &&
          addressInput.trim().length >= 3 &&
          addressInput.trim() !== address?.label
      ),
    [address?.label, addressInput, mapboxToken]
  );

  useEffect(() => {
    void loadRuntimeTranslations();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch("/api/admin/profile", {cache: "no-store"});
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || t("errors.loadProfile"));
        }

        const nextProfile = data.profile || EMPTY_PROFILE;

        if (!cancelled) {
          setProfile(nextProfile);
          setAddress(nextProfile.address || null);
          setAddressInput(nextProfile.address?.label || "");
          setBlogEnabled(nextProfile.blogEnabled !== false);
          setMetadataForm(normalizeMetadataForm(nextProfile.metadata));
          setStatus(null);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({
            type: "error",
            text: error.message || t("errors.loadProfile"),
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!mapboxToken) {
      setSuggestions([]);
      setSearchStatus({
        type: "message",
        key: "status.missingMapboxToken",
      });
      return undefined;
    }

    if (!canSearch) {
      setSuggestions([]);
      setSearchStatus(null);
      return undefined;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearchStatus({type: "message", key: "status.searchingAddresses"});

      try {
        const url = new URL(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            addressInput.trim()
          )}.json`
        );

        url.searchParams.set("access_token", mapboxToken);
        url.searchParams.set("autocomplete", "true");
        url.searchParams.set("types", "address");
        url.searchParams.set("limit", "6");
        url.searchParams.set("language", mapboxLanguage);

        const response = await fetch(url, {signal: controller.signal});
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || t("errors.mapboxSearch"));
        }

        const nextSuggestions = (data.features || [])
          .filter((feature) => getFeatureLabel(feature))
          .map(mapFeatureToAddress);

        setSuggestions(nextSuggestions);
        setSearchStatus(
          nextSuggestions.length
            ? null
            : {type: "message", key: "status.noMatchingAddresses"}
        );
      } catch (error) {
        if (error.name === "AbortError") return;

        setSuggestions([]);
        setSearchStatus({
          type: "error",
          text: error.message || t("errors.mapboxSearch"),
        });
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [addressInput, canSearch, mapboxLanguage, mapboxToken, t]);

  function handleAddressInput(value) {
    setAddressInput(value);
    setStatus(null);

    if (address && value.trim() !== address.label) {
      setAddress(null);
    }
  }

  function selectAddress(nextAddress) {
    setAddress(nextAddress);
    setAddressInput(nextAddress.label);
    setSuggestions([]);
    setSearchStatus(null);
    setStatus(null);
  }

  function clearAddress() {
    setAddress(null);
    setAddressInput("");
    setSuggestions([]);
    setSearchStatus(null);
    setStatus(null);
  }

  function handleMetadataInput(field, value) {
    setMetadataForm((current) => ({...current, [field]: value}));
    setStatus(null);
  }

  async function uploadMetadataAsset(
    event,
    {urlField, typeField, kind, labelKey}
  ) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    const assetLabel = t(labelKey);
    setUploadingAsset(urlField);
    setStatus(null);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("purpose", "site-branding");
      body.append("kind", kind);

      const uploadResponse = await fetch("/api/admin/uploads", {
        method: "POST",
        body,
      });
      const uploadData = await uploadResponse.json().catch(() => ({}));

      if (!uploadResponse.ok) {
        throw new Error(
          uploadData.error || t("errors.uploadAsset", {asset: assetLabel})
        );
      }

      const nextMetadata = {
        ...metadataForm,
        [urlField]: uploadData.asset?.url || "",
        [typeField]:
          uploadData.asset?.mimeType ||
          metadataForm[typeField] ||
          "image/svg+xml",
      };

      setMetadataForm(nextMetadata);

      const saveResponse = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({metadata: nextMetadata}),
      });
      const saveData = await saveResponse.json().catch(() => ({}));

      if (!saveResponse.ok) {
        throw new Error(saveData.error || t("errors.saveProfile"));
      }

      const nextProfile = saveData.profile || EMPTY_PROFILE;

      setProfile(nextProfile);
      setMetadataForm(normalizeMetadataForm(nextProfile.metadata));
      setStatus({
        type: "success",
        key: "status.assetUploaded",
        values: {asset: assetLabel},
      });
    } catch (error) {
      setStatus({
        type: "error",
        text: error.message || t("errors.uploadAsset", {asset: assetLabel}),
      });
    } finally {
      input.value = "";
      setUploadingAsset(null);
    }
  }

  async function saveBlogVisibility(value) {
    const previousValue = blogEnabled;

    setBlogEnabled(value);
    setVisibilityStatus(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({blogEnabled: value}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || t("errors.saveBlogVisibility"));
      }

      const nextProfile = data.profile || EMPTY_PROFILE;

      setProfile(nextProfile);
      setBlogEnabled(nextProfile.blogEnabled !== false);
      setMetadataForm(normalizeMetadataForm(nextProfile.metadata));
      setVisibilityStatus({
        type: "success",
        key:
          nextProfile.blogEnabled === false
            ? "status.blogHidden"
            : "status.blogVisible",
      });
    } catch (error) {
      setBlogEnabled(previousValue);
      setVisibilityStatus({
        type: "error",
        text: error.message || t("errors.saveBlogVisibility"),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (addressInput.trim() && !address) {
      setStatus({
        type: "error",
        key: "errors.chooseAddress",
      });
      return;
    }

    setIsSaving(true);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({address, blogEnabled, metadata: metadataForm}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || t("errors.saveProfile"));
      }

      const nextProfile = data.profile || EMPTY_PROFILE;

      setProfile(nextProfile);
      setAddress(nextProfile.address || null);
      setAddressInput(nextProfile.address?.label || "");
      setBlogEnabled(nextProfile.blogEnabled !== false);
      setMetadataForm(normalizeMetadataForm(nextProfile.metadata));
      setStatus({type: "success", key: "status.profileSaved"});
    } catch (error) {
      setStatus({
        type: "error",
        text: error.message || t("errors.saveProfile"),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.shell}>
      <AdminHeader active="profile" user={user} />

      <main className={styles.main} aria-busy={isLoading}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <h1>{t("title")}</h1>
            <p className={styles.muted}>{t("description")}</p>
          </div>
        </div>

        <form className={styles.profileGrid} onSubmit={saveProfile}>
          <section className={`${styles.profilePanel} ${styles.profilePanelFull}`}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>{t("sections.metadata.title")}</h2>
                <p className={styles.muted}>
                  {t("sections.metadata.description")}
                </p>
              </div>
            </div>

            <div className={styles.metadataGrid}>
              <label className={`${styles.field} ${styles.metadataTitleField}`}>
                {t("fields.browserTitle")}
                <input
                  maxLength={140}
                  placeholder={t("fields.siteTitlePlaceholder")}
                  value={metadataForm.title}
                  onChange={(event) =>
                    handleMetadataInput("title", event.target.value)
                  }
                />
              </label>

              <div className={styles.metadataAssetField}>
                <label className={styles.field}>
                  {t("fields.logoUrl")}
                  <input
                    placeholder="/logo.svg"
                    value={metadataForm.logoUrl}
                    onChange={(event) =>
                      handleMetadataInput("logoUrl", event.target.value)
                    }
                  />
                </label>
                <div className={styles.assetUploadRow}>
                  {metadataForm.logoUrl && (
                    <img
                      alt=""
                      className={styles.assetPreview}
                      src={metadataForm.logoUrl}
                    />
                  )}
                  <label className={styles.uploadButton}>
                    {uploadingAsset === "logoUrl"
                      ? t("actions.uploading")
                      : t("actions.uploadAsset")}
                    <input
                      accept="image/*"
                      disabled={isSaving || Boolean(uploadingAsset)}
                      type="file"
                      onChange={(event) =>
                        uploadMetadataAsset(event, {
                          urlField: "logoUrl",
                          typeField: "logoType",
                          kind: "logo",
                          labelKey: "fields.logoUrl",
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              <div className={styles.metadataAssetField}>
                <label className={styles.field}>
                  {t("fields.iconUrl")}
                  <input
                    placeholder="/icon.svg"
                    value={metadataForm.iconUrl}
                    onChange={(event) =>
                      handleMetadataInput("iconUrl", event.target.value)
                    }
                  />
                </label>
                <div className={styles.assetUploadRow}>
                  {metadataForm.iconUrl && (
                    <img
                      alt=""
                      className={styles.assetPreview}
                      src={metadataForm.iconUrl}
                    />
                  )}
                  <label className={styles.uploadButton}>
                    {uploadingAsset === "iconUrl"
                      ? t("actions.uploading")
                      : t("actions.uploadAsset")}
                    <input
                      accept="image/*"
                      disabled={isSaving || Boolean(uploadingAsset)}
                      type="file"
                      onChange={(event) =>
                        uploadMetadataAsset(event, {
                          urlField: "iconUrl",
                          typeField: "iconType",
                          kind: "favicon",
                          labelKey: "fields.iconUrl",
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              <div className={styles.metadataAssetField}>
                <label className={styles.field}>
                  {t("fields.appIconUrl")}
                  <input
                    placeholder="/icon.svg"
                    value={metadataForm.appIconUrl}
                    onChange={(event) =>
                      handleMetadataInput("appIconUrl", event.target.value)
                    }
                  />
                </label>
                <div className={styles.assetUploadRow}>
                  {metadataForm.appIconUrl && (
                    <img
                      alt=""
                      className={styles.assetPreview}
                      src={metadataForm.appIconUrl}
                    />
                  )}
                  <label className={styles.uploadButton}>
                    {uploadingAsset === "appIconUrl"
                      ? t("actions.uploading")
                      : t("actions.uploadAsset")}
                    <input
                      accept="image/*"
                      disabled={isSaving || Boolean(uploadingAsset)}
                      type="file"
                      onChange={(event) =>
                        uploadMetadataAsset(event, {
                          urlField: "appIconUrl",
                          typeField: "appIconType",
                          kind: "app-icon",
                          labelKey: "fields.appIconUrl",
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              <label className={`${styles.field} ${styles.metadataDescription}`}>
                {t("fields.metaDescription")}
                <textarea
                  maxLength={320}
                  placeholder={t("fields.metaDescriptionPlaceholder")}
                  rows={3}
                  value={metadataForm.description}
                  onChange={(event) =>
                    handleMetadataInput("description", event.target.value)
                  }
                />
              </label>

              <label className={`${styles.field} ${styles.metadataTypeField}`}>
                {t("fields.iconMimeType")}
                <input
                  placeholder="image/svg+xml"
                  value={metadataForm.iconType}
                  onChange={(event) =>
                    handleMetadataInput("iconType", event.target.value)
                  }
                />
              </label>
            </div>

            <div className={styles.editorActions}>
              <p className={styles.muted}>
                {t("fields.lastSaved", {
                  date: formatDate(profile.updatedAt, locale, notSavedLabel),
                })}
              </p>
              <button className={styles.button} disabled={isSaving} type="submit">
                {isSaving ? t("actions.saving") : t("actions.saveMetadata")}
              </button>
            </div>
          </section>

          <section className={`${styles.profilePanel} ${styles.profilePanelFull}`}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>{t("sections.public.title")}</h2>
                <p className={styles.muted}>{t("sections.public.description")}</p>
              </div>
            </div>

            <label className={styles.featureToggle}>
              <input
                checked={blogEnabled}
                disabled={isSaving}
                type="checkbox"
                onChange={(event) => void saveBlogVisibility(event.target.checked)}
              />
              <span className={styles.featureSwitch} aria-hidden="true" />
              <span className={styles.featureText}>
                <strong>{t("blog.title")}</strong>
                <small>
                  {blogEnabled
                    ? t("blog.visibleDescription")
                    : t("blog.hiddenDescription")}
                </small>
              </span>
              <span className={styles.featureStatus}>
                {blogEnabled ? t("blog.visible") : t("blog.hidden")}
              </span>
            </label>
            {visibilityStatus && (
              <p className={styles[visibilityStatus.type]}>
                {getStatusText(visibilityStatus, t)}
              </p>
            )}
          </section>

          <section className={styles.profilePanel}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>{t("sections.address.title")}</h2>
                <p className={styles.muted}>{t("sections.address.description")}</p>
              </div>
            </div>

            <div className={styles.autocompleteField}>
              <label className={styles.field}>
                {t("fields.address")}
                <input
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-controls="profile-address-suggestions"
                  aria-expanded={suggestions.length > 0}
                  placeholder={t("fields.addressPlaceholder")}
                  role="combobox"
                  value={addressInput}
                  onChange={(event) => handleAddressInput(event.target.value)}
                />
              </label>

              {suggestions.length > 0 && (
                <div
                  className={styles.autocompleteList}
                  id="profile-address-suggestions"
                  role="listbox"
                >
                  {suggestions.map((suggestion) => (
                    <button
                      aria-selected="false"
                      className={styles.autocompleteOption}
                      key={`${suggestion.mapboxId}-${suggestion.label}`}
                      role="option"
                      type="button"
                      onClick={() => selectAddress(suggestion)}
                    >
                      <strong>{suggestion.label}</strong>
                      <span>
                        {formatCoordinates(suggestion, coordinatesUnavailableLabel)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {searchStatus && (
              <p className={styles[searchStatus.type]}>
                {getStatusText(searchStatus, t)}
              </p>
            )}

            <div className={styles.editorActions}>
              <p className={styles.muted}>
                {t("fields.lastSaved", {
                  date: formatDate(profile.updatedAt, locale, notSavedLabel),
                })}
              </p>
              <div className={styles.buttonRow}>
                <button
                  className={styles.ghostButton}
                  disabled={isSaving}
                  type="button"
                  onClick={clearAddress}
                >
                  {t("actions.clearAddress")}
                </button>
                <button className={styles.button} disabled={isSaving} type="submit">
                  {isSaving ? t("actions.saving") : t("actions.saveProfile")}
                </button>
              </div>
            </div>

            {status && (
              <p className={styles[status.type]}>{getStatusText(status, t)}</p>
            )}
          </section>

          <section className={styles.profilePanel}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>{t("sections.preview.title")}</h2>
                <p className={styles.muted}>{t("sections.preview.description")}</p>
              </div>
            </div>

            {address ? (
              <div className={styles.addressPreviewStack}>
                <div className={styles.addressPreview}>
                  <span>{t("fields.address")}</span>
                  <strong>{address.label}</strong>
                  <span>{formatCoordinates(address, coordinatesUnavailableLabel)}</span>
                </div>
                <AddressMap
                  address={address}
                  className={styles.profileMap}
                  interactive
                  label={t("preview.mapLabel")}
                  markerScale={1}
                  styleUrl="mapbox://styles/mapbox/streets-v12"
                />
              </div>
            ) : (
              <p className={styles.muted}>{t("preview.empty")}</p>
            )}
          </section>
        </form>
      </main>
    </div>
  );
}
