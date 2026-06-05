import {Geist, Geist_Mono} from "next/font/google";

import {
  getDefaultAiChatIntegration,
  getDefaultSiteMetadata,
  getSiteMetadata,
  getSiteProfile,
  toSiteThemeCss,
  toNextMetadata,
} from "./lib/siteProfile";
import AiChatScriptLoader from "./components/ai-chat/AiChatScriptLoader";
import {CookieConsentProvider} from "./components/consent/CookieConsent";
import {LoadingProvider} from "./components/loading/LoadingProvider";
import {PublicSettingsProvider} from "./components/public-settings/PublicSettingsProvider";
import {SnackbarProvider} from "./components/snackbar/SnackbarProvider";
import "./globals.css";

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

const themeScript = `
(function () {
  try {
    var storageKey = "krostewitz-theme";
    var storedTheme = window.localStorage.getItem(storageKey);
    var systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    var theme =
      storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : systemTheme;

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const revalidate = 300;

export async function generateMetadata() {
  try {
    return toNextMetadata(await getSiteMetadata());
  } catch (error) {
    console.warn("Unable to load site metadata", error);
    return toNextMetadata(getDefaultSiteMetadata());
  }
}

async function getRootSettings() {
  try {
    const profile = await getSiteProfile();

    return {
      aiChat: profile.aiChat || getDefaultAiChatIntegration(),
      siteThemeStyle: toSiteThemeCss(profile.metadata),
    };
  } catch (error) {
    console.warn("Unable to load root site settings", error);
    return {
      aiChat: getDefaultAiChatIntegration(),
      siteThemeStyle: toSiteThemeCss(getDefaultSiteMetadata()),
    };
  }
}

export default async function RootLayout({children}) {
  const {aiChat, siteThemeStyle} = await getRootSettings();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style
          data-site-theme=""
          dangerouslySetInnerHTML={{__html: siteThemeStyle}}
        />
        <script dangerouslySetInnerHTML={{__html: themeScript}} />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable}`}
      >
        <LoadingProvider>
          <CookieConsentProvider gaMeasurementId={gaMeasurementId}>
            <PublicSettingsProvider>
              <SnackbarProvider>{children}</SnackbarProvider>
            </PublicSettingsProvider>
            <AiChatScriptLoader
              enabled={aiChat.enabled}
              scriptTag={aiChat.scriptTag}
            />
          </CookieConsentProvider>
        </LoadingProvider>
      </body>
    </html>
  );
}
