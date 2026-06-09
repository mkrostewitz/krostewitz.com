"use client";

import {createContext, useContext, useEffect, useMemo, useState} from "react";

const DEFAULT_PROFILE = {
  address: null,
  aiChat: {enabled: false, scriptTag: ""},
  blogEnabled: null,
  koalendar: {enabled: false, bookingUrl: ""},
  metadata: {logoUrl: "/logo.svg", title: ""},
  name: {fullName: ""},
  skillsEnabled: null,
};

const PublicSettingsContext = createContext({
  bookingUrl: "",
  blogEnabled: null,
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

    async function loadPublicSettings() {
      try {
        const response = await fetch("/api/content/profile", {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error("Unable to load public settings.");
        }

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

    void loadPublicSettings();

    return () => {
      controller.abort();
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
