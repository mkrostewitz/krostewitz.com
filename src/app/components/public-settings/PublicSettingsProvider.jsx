"use client";

import i18n from "../../../lib/i18n";
import {createContext, useContext, useEffect, useMemo, useState} from "react";

const DEFAULT_PROFILE = {
  address: null,
  aiChat: {enabled: false, scriptTag: ""},
  blogEnabled: null,
  labEnabled: null,
  personalEnabled: null,
  referencesEnabled: false,
  references: {mode: "cards", items: []},
  koalendar: {enabled: false, bookingUrl: ""},
  metadata: {logoUrl: "/logo.svg", title: ""},
  name: {fullName: ""},
  skillsEnabled: null,
};

const PublicSettingsContext = createContext({
  bookingUrl: "",
  blogEnabled: null,
  labEnabled: null,
  personalEnabled: null,
  referencesAvailable: false,
  profile: DEFAULT_PROFILE,
  profileName: "",
  skills: null,
  skillsAvailable: false,
  skillsEnabled: null,
  siteMetadata: DEFAULT_PROFILE.metadata,
});

export function PublicSettingsProvider({children}) {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [skills, setSkills] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    let latestRequest = 0;
    async function loadPublicSettings() {
      const requestId = ++latestRequest;
      try {
        const response = await fetch("/api/content/profile", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error("Unable to load public settings.");
        }

        if (controller.signal.aborted || requestId !== latestRequest) return;
        setProfile({
          ...DEFAULT_PROFILE,
          ...(data.profile || {}),
          metadata: {
            ...DEFAULT_PROFILE.metadata,
            ...(data.profile?.metadata || {}),
          },
          name: {
            ...DEFAULT_PROFILE.name,
            ...(data.profile?.name || {}),
          },
        });
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.warn("Unable to load public settings", error);
        }
      }
    }

    const refresh = () => { void loadPublicSettings(); };
    const refreshWhenVisible = () => { if (!document.hidden) refresh(); };
    refresh();
    // Pick up translations saved in Admin without requiring a full page reload.
    i18n.on("languageChanged", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      controller.abort();
      i18n.off("languageChanged", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPublicSkills() {
      try {
        const response = await fetch("/api/content/skills", {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error("Unable to load public skills.");
        }

        setSkills(Array.isArray(data.skills) ? data.skills : []);
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.warn("Unable to load public skills", error);
          setSkills([]);
        }
      }
    }

    void loadPublicSkills();

    return () => {
      controller.abort();
    };
  }, []);

  const value = useMemo(() => {
    const koalendar = profile.koalendar || {};
    const bookingUrl =
      koalendar.enabled && koalendar.bookingUrl ? koalendar.bookingUrl : "";
    const skillsAvailable =
      profile.skillsEnabled === true && Array.isArray(skills) && skills.length > 0;

    return {
      bookingUrl,
      blogEnabled: profile.blogEnabled,
      labEnabled: profile.labEnabled,
      personalEnabled: profile.personalEnabled,
      referencesAvailable: profile.referencesEnabled === true && profile.references?.items?.length > 0,
      profile,
      profileName: profile.name?.fullName || "",
      skills,
      skillsAvailable,
      skillsEnabled: profile.skillsEnabled,
      siteMetadata: profile.metadata || DEFAULT_PROFILE.metadata,
    };
  }, [profile, skills]);

  return (
    <PublicSettingsContext.Provider value={value}>
      {children}
    </PublicSettingsContext.Provider>
  );
}

export function usePublicSettings() {
  return useContext(PublicSettingsContext);
}
