import {Geist, Geist_Mono} from "next/font/google";

import {
  getDefaultSiteMetadata,
  getSiteMetadata,
  toSiteThemeCss,
  toNextMetadata,
} from "./lib/siteProfile";
import {SnackbarProvider} from "./components/snackbar/SnackbarProvider";
import "./globals.css";

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

const googleAnalyticsScript = gaMeasurementId
  ? `
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag("js", new Date());
gtag("config", ${JSON.stringify(gaMeasurementId)});
`
  : "";

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

export const dynamic = "force-dynamic";

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
        {gaMeasurementId ? (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
            />
            <script dangerouslySetInnerHTML={{__html: googleAnalyticsScript}} />
          </>
        ) : null}
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable}`}
      >
        <SnackbarProvider>{children}</SnackbarProvider>
      </body>
    </html>
  );
}
