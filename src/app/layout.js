import {Geist, Geist_Mono} from "next/font/google";

import {
  getDefaultSiteMetadata,
  getSiteMetadata,
  toSiteThemeCss,
  toNextMetadata,
} from "./lib/siteProfile";
import {CookieConsentProvider} from "./components/consent/CookieConsent";
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

async function getSiteThemeStyle() {
  try {
    return toSiteThemeCss(await getSiteMetadata());
  } catch (error) {
    console.warn("Unable to load site theme", error);
    return toSiteThemeCss(getDefaultSiteMetadata());
  }
}

export default async function RootLayout({children}) {
  const siteThemeStyle = await getSiteThemeStyle();

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
        <CookieConsentProvider gaMeasurementId={gaMeasurementId}>
          <PublicSettingsProvider>
            <SnackbarProvider>{children}</SnackbarProvider>
          </PublicSettingsProvider>
        </CookieConsentProvider>
      </body>
    </html>
  );
}
