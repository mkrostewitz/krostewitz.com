import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import {initReactI18next} from "react-i18next";

export const resources = {
  en: {
    translation: {
      buttons: {
        booking: "Schedule a call",
        linkedin: "LinkedIn",
      },
      nav: {
        about: "About",
        timeline: "Experience",
        executiveSummary: "Summary",
        map: "Countries",
        cv: "CV",
        impact: "Impact",
        contact: "Contact",
      },
      offer: {
        eyebrow: "How I help",
        title: "I build and run growth engines for industrial tech.",
        subtitle:
          "CEO with a track record of building and scaling industrial-tech businesses and turning around performance when needed through execution and systems.",
        points: [
          "Design sustainable GTM playbooks and partner routes that fit your market",
          "Turnaround your operations and build efficient teams",
          "Stabilize cash, supply, and delivery with pragmatic ops changes",
        ],
        cta: "Schedule a Call",
        alt: "Portrait of Mathias Krostewitz",
      },

      executiveSummary: {
        eyebrow: "Executive Summary",
        title: "At a glance",
        languages: {
          title: "Languages",
          list: [
            {code: "EN", name: "English", level: "Fluent"},
            {code: "DE", name: "German", level: "Fluent"},
            {code: "ZH", name: "Chinese", level: "Basic"},
          ],
        },
        stats: {
          yearsLeadership: "Years leading global teams",
          revenuePerHead: "Revenue generated",
          markets: "Markets established",
        },
      },

      about: {
        headline:
          "Building industrial technology businesses, from strategy to execution.",
        body: "My career has been shaped by building businesses under real-world conditions: new markets, limited resources, and high complexity.<br/><br/>Over the past 15+ years, I have built, scaled, and stabilized industrial companies across Europe, North America, and Asia — often in situations without a blueprint, where execution mattered more than theory.<br/><br/>I work hands-on at the intersection of market, organization, and technology: from go-to-market strategy and sales & supply-chain structures to operational systems such as CRM, ERP, and reporting. For me, strategy does not end with a concept — it ends with measurable results.<br/><br/>Outside of work, I find balance in sailing and hiking. Both strongly influence how I work: setting a clear course, planning ahead, navigating uncertainty, and making decisions as conditions change.",
        highlights: [
          "Built international industrial businesses from the ground up, including in the U.S., China, and APAC",
          "Scaled revenue from $0.8M to $13.5M while achieving >15% EBITDA",
          "Established customer-centric go-to-market models (NPS >60, NRR ~126%)",
          "Designed and implemented custom CRM, ERP, and accounting systems for real operational workflows",
          "Developed partner and distribution networks across North America, APAC, and MENA",
        ],
      },
      skills: {
        title: "Impact areas",
        headline: "Where I create value",
        description:
          "I combine commercial leadership with hands-on systems thinking-so companies grow faster, execute cleaner, and scale without chaos.",
        industriesTitle: "Industry focus",
        industriesSubtitle:
          "Where I’ve driven outcomes across GTM, operations, and systems delivery.",
        industries: [
          {
            icon: "\ud83c\udfed",
            title: "Industrial Manufacturing",
            detail: "Factory / discrete manufacturing environments",
          },
          {
            icon: "\u2699\ufe0f",
            title: "Automation & Controls",
            detail: "Industrial components and systems suppliers",
          },
          {
            icon: "\ud83d\udce6",
            title: "Wholesale / Distribution",
            detail: "B2B technical and industrial distribution",
          },
          {
            icon: "\ud83d\ude89",
            title: "Transportation & Infrastructure",
            detail: "Traffic / transit tech and related systems",
          },
          {
            icon: "\ud83d\ude97",
            title: "Automotive",
            detail: "OEMs and Tier suppliers, China market experience",
          },
          {
            icon: "\ud83d\udd0c",
            title: "Electronics Manufacturing",
            detail: "Industrial electronics / EMS contexts",
          },
          {
            icon: "\ud83d\udce6",
            title: "Intralogistics / Warehousing",
            detail: "Supply-chain execution and logistics automation",
          },
        ],
        salesLabel: "Sales",
        salesDetail: "Enterprise growth, channels, key accounts",
        marketingLabel: "Marketing",
        marketingDetail: "Positioning + performance marketing for pipeline",
        opsLabel: "Operations (Supply Chain / Execution)",
        opsDetail: "OTIF, localization, scalable execution cadence",
        financeLabel: "Administration & Finance",
        financeDetail: "Forecasting, cash flow, KPI discipline",
        productLabel: "Engineering / Product",
        productDetail: "Market-to-product translation, roadmap clarity",
        productionLabel: "Production / Manufacturing",
        productionDetail: "Throughput and quality aligned to demand",
        levels: {
          support: "Support",
          lead: "Lead",
          own: "Own",
        },
        map: {
          eyebrow: "International Impact",
          title: "Global Operating Experience",
          subtitle:
            "Countries where I have lived, led teams, and built markets across three continents.",
          lived: "Lived & led teams",
          worked: "Built markets",
          partner: "Partner networks",
          missingToken: "Add NEXT_PUBLIC_MAPBOX_TOKEN to show the map.",
        },
      },

      timeline: [
        {
          period: "Aug 2023 — Present",
          title: "Founder & CEO, INTUTEC LLC",
          location: "Palo Alto, USA",
          detail:
            "Founded and built an industrial marketplace for automation components. Responsible for vision, product definition, data model, UI architecture, go-to-market, and manufacturer onboarding.",
        },
        {
          period: "Jul 2022 — Present",
          title: "President, Schlegel USA Inc.",
          location: "New York, USA",
          detail:
            "Leading the U.S. organization of an HMI components manufacturer. Responsibility for strategy, business planning, cash flow management, forecasting, and partner development.",
        },
        {
          period: "Mar 2018 — Jun 2022",
          title: "CEO & President, CAPTRON North America LP",
          location: "New York, USA",
          detail:
            "Turned around and scaled the business. Increased revenue from $0.8M (2017) to $13.5M (2021) while achieving >15% EBITDA. Localized the supply chain, improving OTIF from 56% to 88%. Designed and implemented a custom CRM, ERP, and accounting system.",
        },
        {
          period: "Jun 2014 — Apr 2018",
          title: "Head of Business Development, CAPTRON Electronic GmbH",
          location: "Munich, Germany",
          detail:
            "Built the NAFTA distribution network and grew revenue from $4k (2014) to $800k (2017). Developed new industry segments and product portfolios, generating more than $10M in additional global revenue.",
        },
        {
          period: "Feb 2012 — May 2014",
          title: "Regional Manager Asia, SATECO Asia Limited",
          location: "Hong Kong & Suzhou, China",
          detail:
            "Led market entry into the Chinese automotive sector. Incorporated a FICE in Suzhou with a €600k investment budget and managed €4.5M in revenue across China, India, and Korea.",
        },
        {
          period: "2003 — 2012",
          title: "GM & Commercial Roles (Mentor, MBG, Eisbär)",
          location: "Munich & China",
          detail:
            "Held interim general management and commercial roles. Led purchasing, built supplier networks, and developed project pipelines across consumer and industrial electronics.",
        },
      ],

      cv: {
        title: "Download my CV",
        subtitle: "Grab the latest PDF with roles, outcomes, and highlights.",
        download: "Download CV",
      },

      contact: {
        title: "Let’s build something efficient",
        subtitle:
          "Reach out directly or share a note—strategy, market entry, or process automation. I usually reply within one business day.",
        directTitle: "Direct contact",
        directNote: "Prefer a quick call or email? I’m reachable right away.",
        phoneLabel: "Phone",
        emailLabel: "Email",
        name: "Name",
        email: "Email",
        message: "What can I help with?",
        placeholderName: "Jane Doe",
        placeholderEmail: "you@email.com",
        placeholderMessage: "Tell me about the challenge...",
        submit: "Send message",
        sending: "Sending...",
        success: "Thanks! I’ll reply shortly.",
        verifyPrompt:
          "We sent a 6-digit code to {{email}}. Enter it below to confirm your email.",
        verifyCodeLabel: "Verification code",
        verifyCodePlaceholder: "123456",
        verifySubmit: "Confirm email",
        verifyEdit: "Edit details",
        verifySent: "Check your email for a 6-digit code to confirm.",
        verifySuccess: "Email confirmed. We received your message.",
        sendAnother: "Send another",
        alreadyExists: "You are already in touch with us.",
        missingFields: "Please fill in all required fields.",
        invalidCode: "Invalid verification code.",
        notFound: "No pending verification found for this email.",
        sendFailed:
          "Verification succeeded but sending failed. Please try again.",
        mailNotConfigured: "Email transport is not configured.",
        errorGeneric: "Something went wrong. Please try again.",
        validation: {
          name: "Name is required",
          email: "Enter a valid email",
          message: "Add a bit more detail",
          code: "Enter the 6-digit code",
          codeRequired: "Verification code is required",
        },
      },
    },
  },
  de: {
    translation: {
      buttons: {
        booking: "Gespräch vereinbaren",
        linkedin: "LinkedIn",
      },

      nav: {
        about: "Über mich",
        timeline: "Erfahrung",
        executiveSummary: "Auf einen Blick",
        map: "Ländererfahrung",
        cv: "Lebenslauf",
        impact: "Wirkung",
        contact: "Kontakt",
      },

      offer: {
        eyebrow: "So helfe ich",
        title:
          "Ich baue stabile Strukturen auf und mache Wachstum wieder planbar.",
        subtitle:
          "CEO mit über 15 Jahren Erfahrung im Aufbau, der Skalierung, und wo notwendig der Stabilisierung von Industrie- und Technologieunternehmen.<br/><br/>Mein Fokus: nachhaltiges Wachstum, klare Strukturen und messbare Ergebnisse.",
        points: [
          "<strong>Markteintritts</strong> - und Go-to-Market-Strategien entwickeln und umsetzen, inklusive Partner- und Distributionsmodellen",
          "<strong>Vertrieb, Operations und Organisationen</strong> auf klare Ziele, Verbindlichkeit und Ergebnisverantwortung ausrichten",
          "<strong>Cashflow, Lieferfähigkeit und operative Performance</strong> durch pragmatische Maßnahmen stabilisieren",
        ],
        cta: "Gespräch vereinbaren",
        alt: "Portrait von Mathias Krostewitz",
      },

      executiveSummary: {
        eyebrow: "Kurzprofil",
        title: "Auf einen Blick",
        languages: {
          title: "Sprachen",
          list: [
            {code: "EN", name: "Englisch", level: "Verhandlungssicher"},
            {code: "DE", name: "Deutsch", level: "Muttersprache"},
            {code: "ZH", name: "Chinesisch", level: "Grundkenntnisse"},
          ],
        },
        stats: {
          yearsLeadership: "Jahre internationale Führungserfahrung",
          revenuePerHead: "Verantworteter Umsatz",
          markets: "Aufgebaute internationale Märkte",
        },
      },

      about: {
        headline:
          "Unternehmensaufbau in Industrietechnik, von Strategie bis Umsetzung.",
        body: "Mein beruflicher Weg ist geprägt von Aufbauarbeit unter realen Bedingungen: neue Märkte, begrenzte Ressourcen, hohe Komplexität.<br/><br/>In den letzten 15+ Jahren habe ich Industrieunternehmen in Europa, Nordamerika und Asien aufgebaut, skaliert und in kritischen Phasen stabilisiert, oft dort, wo es keine Blaupause gab und Execution entscheidend war.<br /><br/>Ich arbeite hands-on an der Schnittstelle von Markt, Organisation und Technologie: vom Go-to-Market über Vertriebs- und Supply-Chain-Strukturen bis hin zu operativen Systemen wie CRM, ERP und Reporting. Strategie endet für mich nicht im Konzept, sondern in messbaren Ergebnissen.<br/><br/>Außerhalb des Büros finde ich Ausgleich im Segeln und Wandern. Beides prägt auch meine Arbeitsweise: Kurs halten, vorausschauend planen, mit Unsicherheit umgehen und Entscheidungen treffen, wenn sich die Bedingungen ändern.",
        highlights: [
          "Internationale Industriegeschäfte von Grund auf aufgebaut, u. a. in den USA, China und APAC",
          "Umsatz von 0,8 Mio. US$ auf 13,5 Mio. US$ skaliert bei >15 % EBITDA",
          "Kundenzentrierte Go-to-Market-Modelle etabliert (NPS >60, NRR ~126 %)",
          "Eigene CRM-/ERP- und Accounting-Systeme für reale, operative Prozesse entwickelt",
          "Distributions- und Partnernetzwerke in Nordamerika, APAC und MENA aufgebaut",
        ],
      },

      skills: {
        title: "Wirkungsfelder",
        headline: "Wo ich Verantwortung übernehme",
        description:
          "Ich verbinde unternehmerische Führung mit pragmatischer Umsetzung, um Wachstum voranzubringen, Komplexität zu reduzieren und nachhaltige Profitabilität zu sichern.",

        industriesTitle: "Branchenfokus",
        industriesSubtitle:
          "Branchen, in denen ich Unternehmen aufgebaut, skaliert und operativ verantwortet habe.",
        industries: [
          {
            icon: "🏭",
            title: "Industrielle Fertigung",
            detail: "Fabrik- / diskrete Fertigungsumgebungen",
          },
          {
            icon: "⚙️",
            title: "Automation & Steuerung",
            detail: "Industriekomponenten- und Systemlieferanten",
          },
          {
            icon: "📦",
            title: "Großhandel / Distribution",
            detail: "B2B-Technik- und Industriedistribution",
          },
          {
            icon: "🚉",
            title: "Transport & Infrastruktur",
            detail: "Verkehrs- / ÖPNV-Technik und verwandte Systeme",
          },
          {
            icon: "🚗",
            title: "Automotive",
            detail: "OEMs und Tier-Zulieferer, China-Erfahrung",
          },
          {
            icon: "🔌",
            title: "Elektronikfertigung",
            detail: "Industrielle Elektronik- / EMS-Umfelder",
          },
          {
            icon: "📦",
            title: "Intralogistik / Lager",
            detail: "Supply-Chain-Execution und Logistikautomation",
          },
        ],

        salesLabel: "Vertrieb",
        salesDetail:
          "Markteinführung, Vertriebskanäle und strategische Schlüsselkunden",

        marketingLabel: "Marketing",
        marketingDetail:
          "Positionierung, Marktbearbeitung und vertriebsunterstützendes Marketing",

        opsLabel: "Operations & Lieferkette",
        opsDetail:
          "Lieferfähigkeit (OTIF), Lokalisierung und verlässliche operative Umsetzung",

        financeLabel: "Finanzen & Administration",
        financeDetail:
          "Liquiditätsplanung, Forecasting und Führung über Kennzahlen",

        productLabel: "Produkt & Entwicklung",
        productDetail:
          "Übersetzung von Marktanforderungen in klare Produkt- und Entwicklungsplanung",

        productionLabel: "Produktion & Fertigung",
        productionDetail:
          "Durchsatz, Qualität und Kapazitätssteuerung im Einklang mit der Nachfrage",

        levels: {
          support: "Mitwirkung",
          lead: "Federführende Verantwortung",
          own: "Gesamtverantwortung",
        },

        map: {
          eyebrow: "Internationale Wirkung",
          title: "Internationale Führungs- und Markterfahrung",
          subtitle:
            "Länder, in denen ich gelebt, Teams geführt und Märkte aufgebaut habe – über drei Kontinente hinweg.",
          lived: "Gelebt & Teams geführt",
          worked: "Märkte aufgebaut",
          partner: "Partnernetzwerke",
          missingToken:
            "Bitte NEXT_PUBLIC_MAPBOX_TOKEN setzen, um die Karte anzuzeigen.",
        },
      },

      timeline: [
        {
          period: "Aug 2023 — heute",
          title: "Gründer & CEO, INTUTEC LLC",
          location: "Palo Alto, USA",
          detail:
            "Aufbau eines industriellen Marktplatzes für Automatisierungskomponenten. Verantwortung für Vision, Produkt, Datenmodell, UI sowie Go-to-Market und Hersteller-Onboarding.",
        },
        {
          period: "Jul 2022 — heute",
          title: "President, Schlegel USA Inc.",
          location: "New York, USA",
          detail:
            "Strategische Weiterentwicklung eines HMI-Herstellers. Business Planning, Liquiditätssteuerung, Forecasting sowie Aufbau von Partner- und Vertriebsstrukturen.",
        },
        {
          period: "Mär 2018 — Jun 2022",
          title: "CEO & President, CAPTRON North America LP",
          location: "New York, USA",
          detail:
            "Unternehmen erfolgreich gedreht und skaliert: Umsatz von 0,8 Mio. USD (2017) auf 13,5 Mio. USD (2021) gesteigert bei >15 % EBITDA. Lieferkette lokalisiert und OTIF von 56 % auf 88 % verbessert. Eigenes CRM-/ERP-/FiBu-System entwickelt.",
        },
        {
          period: "Jun 2014 — Apr 2018",
          title: "Leiter Business Development, CAPTRON Electronic GmbH",
          location: "München, Deutschland",
          detail:
            "NAFTA-Distributionsnetz aufgebaut und Umsatz von 4 Tsd. USD (2014) auf 800 Tsd. USD (2017) skaliert. Neues Branchen- und Produktportfolio entwickelt mit >10 Mio. USD zusätzlichem globalem Umsatzbeitrag.",
        },
        {
          period: "Feb 2012 — Mai 2014",
          title: "Regional Manager Asien, SATECO Asia Limited",
          location: "Hongkong & Suzhou, China",
          detail:
            "Markteintritt in den chinesischen Automobilmarkt umgesetzt. FICE in Suzhou gegründet (Investitionsbudget 600 Tsd. €) und Umsatz von 4,5 Mio. € in China, Indien und Korea verantwortet.",
        },
        {
          period: "2003 — 2012",
          title: "Geschäftsführer- & Commercial-Rollen (Mentor, MBG, Eisbär)",
          location: "München & China",
          detail:
            "Interims-Geschäftsführung, Einkauf und kommerzielle Verantwortung. Aufbau von Lieferantenbeziehungen, Projektpipelines und internationalen Beschaffungsstrukturen.",
        },
      ],

      cv: {
        title: "Lebenslauf",
        subtitle:
          "Aktuelle PDF-Version mit Rollen, Ergebnissen und ausgewählten Highlights.",
        download: "Lebenslauf herunterladen",
      },

      contact: {
        title: "Lassen Sie uns ins Gespräch kommen",
        subtitle:
          "Kontaktieren Sie mich direkt oder per Formular – für Strategie, Markteintritt und operative Verbesserungen. In der Regel antworte ich innerhalb eines Werktags.",
        directTitle: "Direkter Kontakt",
        directNote:
          "Am liebsten kurz per Telefon oder E-Mail – ich bin direkt erreichbar.",
        phoneLabel: "Telefon",
        emailLabel: "E-Mail",
        name: "Name",
        email: "E-Mail",
        message: "Wobei kann ich unterstützen?",
        placeholderName: "Max Mustermann",
        placeholderEmail: "du@email.de",
        placeholderMessage: "Worum geht es konkret…",
        submit: "Nachricht senden",
        sending: "Wird gesendet…",
        success: "Danke! Ich melde mich zeitnah.",

        verifyPrompt:
          "Ich habe Ihnen einen 6-stelligen Code an {{email}} gesendet. Bitte geben Sie ihn ein, um Ihre E-Mail zu bestätigen.",
        verifyCodeLabel: "Bestätigungscode",
        verifyCodePlaceholder: "123456",
        verifySubmit: "E-Mail bestätigen",
        verifyEdit: "Angaben bearbeiten",
        verifySent:
          "Bitte prüfen Sie Ihre E-Mails und geben Sie den 6-stelligen Code ein.",
        verifySuccess: "E-Mail bestätigt. Ich habe Ihre Nachricht erhalten.",
        sendAnother: "Weitere Nachricht senden",
        alreadyExists: "Wir stehen bereits in Kontakt.",
        missingFields: "Bitte füllen Sie alle Pflichtfelder aus.",
        invalidCode: "Ungültiger Bestätigungscode.",
        notFound: "Keine ausstehende Bestätigung für diese E-Mail gefunden.",
        sendFailed:
          "Bestätigung erfolgreich, aber Versand fehlgeschlagen. Bitte versuchen Sie es erneut.",
        mailNotConfigured: "E-Mail-Versand ist nicht konfiguriert.",
        errorGeneric:
          "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",

        validation: {
          name: "Bitte geben Sie Ihren Namen ein.",
          email: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
          message: "Bitte fügen Sie etwas mehr Details hinzu.",
          code: "Bitte geben Sie den 6-stelligen Code ein den Sie per Email erhalten haben.",
          codeRequired: "Bestätigungscode ist erforderlich",
        },
      },
    },
  },
};

const isBrowser = typeof window !== "undefined";

if (!i18n.isInitialized) {
  const detector = isBrowser ? LanguageDetector : null;

  if (detector) {
    i18n.use(detector);
  }

  i18n.use(initReactI18next).init({
    resources,
    lng: "en",
    fallbackLng: "en",
    supportedLngs: ["en", "de"],
    nonExplicitSupportedLngs: true,
    detection: {
      order: ["querystring", "localStorage", "cookie", "navigator"],
      caches: ["localStorage", "cookie"],
    },
    interpolation: {escapeValue: false},
  });
}

// If we initialized on the server without the detector, attach it on the client
// and re-run detection to pick up user language preference.
if (
  isBrowser &&
  !i18n.services?.languageDetector &&
  typeof i18n.use === "function"
) {
  i18n.use(LanguageDetector);
  i18n.services.languageDetector.init({
    order: ["querystring", "localStorage", "cookie", "navigator"],
    caches: ["localStorage", "cookie"],
  });
  const detected = i18n.services.languageDetector.detect();
  if (detected && detected !== i18n.language) {
    i18n.changeLanguage(detected);
  }
}

export default i18n;
