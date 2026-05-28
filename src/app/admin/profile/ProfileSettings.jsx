"use client";

import {useEffect, useMemo, useState} from "react";

import AddressMap from "../../components/address-map/AddressMap";
import AdminHeader from "../AdminHeader";
import styles from "../admin.module.css";

const EMPTY_PROFILE = {
  address: null,
  blogEnabled: true,
  updatedAt: null,
  updatedBy: null,
};

function formatDate(value) {
  if (!value) return "Not saved";

  return new Intl.DateTimeFormat("en", {
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

function formatCoordinates(address) {
  if (
    typeof address?.latitude !== "number" ||
    typeof address?.longitude !== "number"
  ) {
    return "Coordinates not available";
  }

  return `${address.latitude.toFixed(5)}, ${address.longitude.toFixed(5)}`;
}

export default function ProfileSettings({user}) {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [address, setAddress] = useState(null);
  const [addressInput, setAddressInput] = useState("");
  const [blogEnabled, setBlogEnabled] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState({
    type: "message",
    text: "Loading profile settings...",
  });
  const [visibilityStatus, setVisibilityStatus] = useState(null);
  const [searchStatus, setSearchStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch("/api/admin/profile", {cache: "no-store"});
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Unable to load profile settings.");
        }

        const nextProfile = data.profile || EMPTY_PROFILE;

        if (!cancelled) {
          setProfile(nextProfile);
          setAddress(nextProfile.address || null);
          setAddressInput(nextProfile.address?.label || "");
          setBlogEnabled(nextProfile.blogEnabled !== false);
          setStatus(null);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({type: "error", text: error.message});
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
  }, []);

  useEffect(() => {
    if (!mapboxToken) {
      setSuggestions([]);
      setSearchStatus({
        type: "message",
        text: "Set NEXT_PUBLIC_MAPBOX_TOKEN to enable Mapbox address autocomplete.",
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
      setSearchStatus({type: "message", text: "Searching addresses..."});

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
        url.searchParams.set("language", "de");

        const response = await fetch(url, {signal: controller.signal});
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || "Mapbox address search failed.");
        }

        const nextSuggestions = (data.features || [])
          .filter((feature) => getFeatureLabel(feature))
          .map(mapFeatureToAddress);

        setSuggestions(nextSuggestions);
        setSearchStatus(
          nextSuggestions.length
            ? null
            : {type: "message", text: "No matching addresses found."}
        );
      } catch (error) {
        if (error.name === "AbortError") return;

        setSuggestions([]);
        setSearchStatus({type: "error", text: error.message});
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [addressInput, canSearch, mapboxToken]);

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
        throw new Error(data.error || "Unable to save blog visibility.");
      }

      const nextProfile = data.profile || EMPTY_PROFILE;

      setProfile(nextProfile);
      setBlogEnabled(nextProfile.blogEnabled !== false);
      setVisibilityStatus({
        type: "success",
        text: nextProfile.blogEnabled === false
          ? "Blog is hidden from the public website."
          : "Blog is visible on the public website.",
      });
    } catch (error) {
      setBlogEnabled(previousValue);
      setVisibilityStatus({type: "error", text: error.message});
    } finally {
      setIsSaving(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (addressInput.trim() && !address) {
      setStatus({
        type: "error",
        text: "Choose an address from the Mapbox results before saving.",
      });
      return;
    }

    setIsSaving(true);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({address, blogEnabled}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to save profile settings.");
      }

      const nextProfile = data.profile || EMPTY_PROFILE;

      setProfile(nextProfile);
      setAddress(nextProfile.address || null);
      setAddressInput(nextProfile.address?.label || "");
      setBlogEnabled(nextProfile.blogEnabled !== false);
      setStatus({type: "success", text: "Profile settings saved."});
    } catch (error) {
      setStatus({type: "error", text: error.message});
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
            <h1>Profile</h1>
            <p className={styles.muted}>
              Manage public contact details and section visibility.
            </p>
          </div>
        </div>

        <form className={styles.profileGrid} onSubmit={saveProfile}>
          <section className={`${styles.profilePanel} ${styles.profilePanelFull}`}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>Public sections</h2>
                <p className={styles.muted}>
                  Temporarily hide unfinished parts of the public website without
                  deleting content.
                </p>
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
                <strong>Blog</strong>
                <small>
                  {blogEnabled
                    ? "Shown in navigation, homepage, and public post pages. Toggle saves immediately."
                    : "Hidden from navigation, homepage, posts API, and public post pages. Toggle saves immediately."}
                </small>
              </span>
              <span className={styles.featureStatus}>
                {blogEnabled ? "Visible" : "Hidden"}
              </span>
            </label>
            {visibilityStatus && (
              <p className={styles[visibilityStatus.type]}>
                {visibilityStatus.text}
              </p>
            )}
          </section>

          <section className={styles.profilePanel}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>Current address</h2>
                <p className={styles.muted}>
                  Search with Mapbox and select a result to publish it in Kontakt.
                </p>
              </div>
            </div>

            <div className={styles.autocompleteField}>
              <label className={styles.field}>
                Address
                <input
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-controls="profile-address-suggestions"
                  aria-expanded={suggestions.length > 0}
                  placeholder="Start typing an address"
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
                      <span>{formatCoordinates(suggestion)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {searchStatus && (
              <p className={styles[searchStatus.type]}>{searchStatus.text}</p>
            )}

            <div className={styles.editorActions}>
              <p className={styles.muted}>
                Last saved: {formatDate(profile.updatedAt)}
              </p>
              <div className={styles.buttonRow}>
                <button
                  className={styles.ghostButton}
                  disabled={isSaving}
                  type="button"
                  onClick={clearAddress}
                >
                  Clear address
                </button>
                <button className={styles.button} disabled={isSaving} type="submit">
                  {isSaving ? "Saving..." : "Save profile"}
                </button>
              </div>
            </div>

            {status && <p className={styles[status.type]}>{status.text}</p>}
          </section>

          <section className={styles.profilePanel}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>Kontakt preview</h2>
                <p className={styles.muted}>
                  The public section stays unchanged until this form is saved.
                </p>
              </div>
            </div>

            {address ? (
              <div className={styles.addressPreviewStack}>
                <div className={styles.addressPreview}>
                  <span>Address</span>
                  <strong>{address.label}</strong>
                  <span>{formatCoordinates(address)}</span>
                </div>
                <AddressMap
                  address={address}
                  className={styles.profileMap}
                  interactive
                  label="Selected address map"
                  markerScale={1}
                  styleUrl="mapbox://styles/mapbox/streets-v12"
                />
              </div>
            ) : (
              <p className={styles.muted}>
                No address is selected, so the public Kontakt section will hide it.
              </p>
            )}
          </section>
        </form>
      </main>
    </div>
  );
}
