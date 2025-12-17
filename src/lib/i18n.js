import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import {initReactI18next} from "react-i18next";

export const resources = {
  en: {
    translation: {
      hero: {
        kicker: "Mathias Krostewitz",
        title: "Industrial Tech Operator & Builder",
        subtitle:
          "15+ years scaling and turning around industrial-tech businesses across the US, China, and Europe, combining GTM leadership with hands-on system builds (CRM/ERP/data) to drive revenue, delivery performance, and margin.",
        booking: "Schedule a call",
        contact: "Contact form",
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
      stats: {
        yearsLeadership: "Years leading global teams",
        revenuePerHead: "Revenue generated",
        markets: "Markets established",
      },
      about: {
        headline:
          "I build growth engines for industrial technology-strategy to execution.",
        body: "I lead teams through change, design scalable operating systems, and turn complex sales + supply chain realities into predictable performance.",
        highlights: [
          "Scaled and turned around industrial businesses with customer-centric GTM playbooks.",
          "Built and shipped CRM/ERP/accounting workflows tailored to real-world processes.",
          "Developed distribution and partner networks across North America, APAC, and MENA.",
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
      },
      timeline: [
        {
          period: "Aug 2023 — Present",
          title: "Founder & CEO, INTUTEC LLC",
          location: "Palo Alto, USA",
          detail:
            "Building an industrial marketplace for automation components-defining vision, data model, and UI while onboarding manufacturers.",
        },
        {
          period: "Jul 2022 — Present",
          title: "President, Schlegel USA Inc.",
          location: "New York, USA",
          detail:
            "Steering vision, business planning, and cashflow for an HMI components manufacturer; recruiting partners and aligning forecasting.",
        },
        {
          period: "Mar 2018 — Jun 2022",
          title: "CEO & President, CAPTRON North America LP",
          location: "New York, USA",
          detail:
            "Turned around the business: grew revenue from $0.8M (2017) to $13.5M (2021) with EBITDA >15%, localized supply chain to raise OTIF from 56% to 88%, and coded a DIY CRM/ERP/accounting stack.",
        },
        {
          period: "Jun 2014 — Apr 2018",
          title: "Head of Business Development, CAPTRON Electronic GmbH",
          location: "Munich, Germany",
          detail:
            "Built NAFTA distribution from $4k (2014) to $800k (2017) and created a new industry/product executiveSummary adding $10M+ globally.",
        },
        {
          period: "Feb 2012 — May 2014",
          title: "Regional Manager Asia, SATECO Asia Limited",
          location: "Hong Kong & Suzhou, China",
          detail:
            "Opened the Chinese automotive market, incorporated a FICE with a €600k budget, and managed €4.5M revenue across China, India, and Korea.",
        },
        {
          period: "2003 — 2012",
          title: "GM & Commercial Roles (Mentor, MBG, Eisbär)",
          location: "Munich & China",
          detail:
            "Led interim GM and purchasing mandates, building supplier relationships and project pipelines across consumer and electronics sectors.",
        },
      ],
      executiveSummary: [
        {
          title: "CEO & President",
          role: "Market Development",
          impact:
            "Scaled revenue from $0.8M to $13.5M with sustainable EBITDA while localizing supply chain and improving OTIF to 88%.",
        },
        {
          title: "DIY CRM, ERP & Accounting Platform",
          role: "Architect & Builder",
          impact:
            "Coded a custom system to match unique processes, covering CRM, ERP, and accounting to increase team efficiency and transparency.",
        },
        {
          title: "Global Distribution Network for Industrial Commponents",
          role: "Market Development",
          impact:
            "Established distributors across NAFTA, MENA, and APAC, boosting export rates and opening new revenue streams.",
        },
      ],
      map: {
        title: "Global experience footprint",
        subtitle:
          "Countries I've lived in and markets I've developed—spanning leadership roles and partner networks across three continents.",
        lived: "Lived & led teams",
        worked: "Developed markets",
        partner: "Partner network",
        missingToken: "Add NEXT_PUBLIC_MAPBOX_TOKEN to show the map.",
      },
      languages: {
        title: "Languages",
        list: [
          {code: "EN", name: "English", level: "Fluent"},
          {code: "DE", name: "German", level: "Fluent"},
          {code: "ZH", name: "Chinese", level: "Basic"},
        ],
      },
      backend: {
        title: "Private backend",
        body: "A secure admin area will let me update the resume, add executiveSummary entries, and adjust availability. Authentication and content editing are staged for the next iteration.",
        cta: "Plan backend scope",
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
      cv: {
        title: "Download my CV",
        subtitle: "Grab the latest PDF with roles, outcomes, and highlights.",
        download: "Download CV",
      },
      meeting: "Book time on my Calendar",
      linkedin: "LinkedIn",
    },
  },
  de: {
    translation: {
      hero: {
        kicker: "Mathias Krostewitz",
        title: "Industrial Tech Operator & Builder",
        subtitle:
          "Über 15 Jahre Markteintritt, Unternehmensaufbau und Skalierung in den USA, China und Europa – mit Fokus auf Go-to-Market, operative Umsetzung und Profitabilität.",
        booking: "Termin vereinbaren",
        contact: "Kontaktformular",
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
        title: "Ich baue Unternehmen auf – und mache Wachstum wieder planbar.",
        subtitle:
          "CEO mit Erfahrung im Aufbau und Skalieren von Industrieunternehmen – und in ausgewählten Fällen auch in der Stabilisierung und Neuausrichtung von Performance.",
        points: [
          "Markteintritts- und Go-to-Market-Strategien entwickeln – inkl. Partner- und Distributionskanälen",
          "Vertrieb, Operations und Teams auf klare Ziele, Rhythmus und Ergebnisverantwortung ausrichten",
          "Cashflow, Lieferfähigkeit und Liefertreue durch pragmatische Maßnahmen stabilisieren",
        ],
        cta: "Termin vereinbaren",
        alt: "Portrait von Mathias Krostewitz",
      },

      stats: {
        yearsLeadership: "Jahre Führung internationaler Teams",
        revenuePerHead: "Generierter Umsatz",
        markets: "Aufgebaute Märkte",
        product: "Rollouts & Umsetzungen",
      },

      about: {
        headline:
          "Unternehmensaufbau in Industrietechnik – von Strategie bis Umsetzung.",
        body: "Ich führe Teams durch Veränderung, schärfe Go-to-Market und mache komplexe Vertriebs- und Supply-Chain-Themen steuerbar – mit messbaren Ergebnissen in Wachstum, Liefertreue und Marge.",
        highlights: [
          "Industriegeschäft aufgebaut und skaliert – mit kundenzentrierter Go-to-Market-Strategie.",
          "Vertriebs- und Prozessabläufe professionalisiert (CRM/ERP/Reporting) – passend zur realen Arbeitsweise.",
          "Partner- und Distributionsnetzwerke in Nordamerika, APAC und MENA aufgebaut.",
        ],
      },

      skills: {
        title: "Wirkungsfelder",
        headline: "Wo ich Mehrwert schaffe",
        description:
          "Ich verbinde unternehmerische Führung mit pragmatischer Umsetzung – damit Unternehmen schneller wachsen, sauberer liefern und profitabler werden.",
        industriesTitle: "Branchenfokus",
        industriesSubtitle:
          "Branchen, in denen ich Wachstum und Umsetzung verantwortet habe.",

        salesLabel: "Vertrieb",
        salesDetail: "Enterprise-Wachstum, Kanäle, Key Accounts",

        marketingLabel: "Marketing",
        marketingDetail:
          "Positionierung und Performance-Marketing für Pipeline",

        opsLabel: "Operations (Supply Chain / Umsetzung)",
        opsDetail: "OTIF, Lokalisierung, skalierbarer Umsetzungsrhythmus",

        financeLabel: "Administration & Finanzen",
        financeDetail: "Forecasting, Cashflow, KPI-Disziplin",

        productLabel: "Entwicklung & Produkt",
        productDetail: "Übersetzung Markt → Produkt, klare Roadmaps",

        productionLabel: "Produktion / Fertigung",
        productionDetail:
          "Durchsatz und Qualität im Einklang mit der Nachfrage",

        levels: {
          support: "Mitwirkung",
          lead: "Federführend",
          own: "Gesamtverantwortung",
        },
      },

      timeline: [
        {
          period: "Aug 2023 — Heute",
          title: "Gründer & CEO, INTUTEC LLC",
          location: "Palo Alto, USA",
          detail:
            "Aufbau eines industriellen Marktplatzes für Automatisierungskomponenten – Produkt, Go-to-Market und Hersteller-Onboarding.",
        },
        {
          period: "Jul 2022 — Heute",
          title: "President, Schlegel USA Inc.",
          location: "New York, USA",
          detail:
            "Strategie, Business Planning und Cashflow-Steuerung für einen HMI-Hersteller; Partnergewinnung sowie Forecasting- und Vertriebsabstimmung.",
        },
        {
          period: "Mär 2018 — Jun 2022",
          title: "CEO & President, CAPTRON North America LP",
          location: "New York, USA",
          detail:
            "Unternehmen erfolgreich gedreht und skaliert: Umsatz von 0,8 Mio. USD (2017) auf 13,5 Mio. USD (2021) gesteigert (EBITDA >15%); Lieferkette lokalisiert und OTIF von 56% auf 88% verbessert.",
        },
        {
          period: "Jun 2014 — Apr 2018",
          title: "Head of Business Development, CAPTRON Electronic GmbH",
          location: "München, Deutschland",
          detail:
            "NAFTA-Vertrieb von 4 Tsd. USD (2014) auf 800 Tsd. USD (2017) aufgebaut und durch neues Branchen- und Produktportfolio >10 Mio. USD globalen Umsatzbeitrag erschlossen.",
        },
        {
          period: "Feb 2012 — Mai 2014",
          title: "Regional Manager Asia, SATECO Asia Limited",
          location: "Hongkong & Suzhou, China",
          detail:
            "Markteintritt im chinesischen Automotive-Umfeld umgesetzt, FICE gegründet (Budget 600 Tsd. €) und 4,5 Mio. € Umsatz in China, Indien und Korea verantwortet.",
        },
        {
          period: "2003 — 2012",
          title: "GM- & Commercial-Rollen (Mentor, MBG, Eisbär)",
          location: "München & China",
          detail:
            "Interims-GM- und Einkaufsmandate übernommen; Lieferantenbeziehungen aufgebaut und Projektpipelines in Konsumgütern und Elektronik entwickelt.",
        },
      ],

      executiveSummary: [
        {
          title: "Turnaround & Skalierung (CAPTRON North America)",
          role: "CEO & President",
          impact:
            "Umsatz von 0,8 Mio. auf 13,5 Mio. USD skaliert, EBITDA >15% erreicht und OTIF durch lokalisierte Supply Chain auf 88% verbessert.",
        },
        {
          title: "Prozesse & Steuerung professionalisiert",
          role: "Konzeption & Umsetzung",
          impact:
            "Strukturen für Transparenz und Effizienz aufgebaut (z. B. CRM/ERP/Reporting) – passend zur Organisation und den realen Abläufen.",
        },
        {
          title: "Internationales Distributionsnetzwerk",
          role: "Business Development",
          impact:
            "Partner und Distributoren in NAFTA, MENA und APAC aufgebaut, Exportquote gesteigert und neue Umsatzströme erschlossen.",
        },
      ],

      map: {
        title: "Internationale Erfahrung",
        subtitle:
          "Länder, in denen ich gelebt und Teams geführt habe, sowie Märkte, die ich aufgebaut habe – über drei Kontinente hinweg.",
        lived: "Gelebt & Teams geführt",
        worked: "Märkte aufgebaut",
        partner: "Partnernetzwerk",
        missingToken:
          "Füge NEXT_PUBLIC_MAPBOX_TOKEN hinzu, um die Karte anzuzeigen.",
      },

      languages: {
        title: "Sprachen",
        list: [
          {code: "EN", name: "Englisch", level: "Fließend"},
          {code: "DE", name: "Deutsch", level: "Fließend"},
          {code: "ZH", name: "Chinesisch", level: "Grundkenntnisse"},
        ],
      },

      backend: {
        title: "Privater Backend-Bereich",
        body: "Ein gesicherter Admin-Bereich ermöglicht die Pflege von Lebenslauf, Summary-Einträgen und Verfügbarkeit. Authentifizierung und Content-Editing folgen im nächsten Schritt.",
        cta: "Backend-Umfang planen",
      },

      contact: {
        title: "Lassen Sie uns effizient umsetzen",
        subtitle:
          "Kontaktieren Sie mich direkt oder per Formular – für Strategie, Markteintritt oder operative Verbesserung. In der Regel antworte ich innerhalb eines Werktags.",
        directTitle: "Direkter Kontakt",
        directNote:
          "Lieber kurz per Telefon oder E-Mail? Ich bin direkt erreichbar.",
        phoneLabel: "Telefon",
        emailLabel: "E-Mail",
        name: "Name",
        email: "E-Mail",
        message: "Wobei kann ich unterstützen?",
        placeholderName: "Max Mustermann",
        placeholderEmail: "du@email.de",
        placeholderMessage: "Worum geht es genau…",
        submit: "Nachricht senden",
        sending: "Wird gesendet…",
        success: "Danke! Ich melde mich zeitnah.",
        verifyPrompt:
          "Wir haben einen 6-stelligen Code an {{email}} gesendet. Bitte eingeben, um die E-Mail zu bestätigen.",
        verifyCodeLabel: "Bestätigungscode",
        verifyCodePlaceholder: "123456",
        verifySubmit: "E-Mail bestätigen",
        verifyEdit: "Angaben bearbeiten",
        verifySent:
          "Bitte prüfen Sie Ihre E-Mail und geben Sie den 6-stelligen Code ein.",
        verifySuccess: "E-Mail bestätigt. Wir haben Ihre Nachricht erhalten.",
        sendAnother: "Weitere Nachricht senden",
        alreadyExists: "Wir stehen bereits in Kontakt.",
        missingFields: "Bitte alle Pflichtfelder ausfüllen.",
        invalidCode: "Ungültiger Bestätigungscode.",
        notFound: "Keine ausstehende Bestätigung für diese E-Mail gefunden.",
        sendFailed:
          "Bestätigung erfolgreich, aber Versand fehlgeschlagen. Bitte erneut versuchen.",
        mailNotConfigured: "E-Mail-Versand ist nicht konfiguriert.",
        errorGeneric: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
        validation: {
          name: "Name ist erforderlich",
          email: "Bitte eine gültige E-Mail eingeben",
          message: "Bitte etwas mehr Details hinzufügen",
          code: "Bitte den 6-stelligen Code eingeben",
          codeRequired: "Bestätigungscode ist erforderlich",
        },
      },

      cv: {
        title: "Lebenslauf",
        subtitle:
          "Aktuelle PDF-Version mit Rollen, Ergebnissen und Highlights.",
        download: "Lebenslauf herunterladen",
      },

      meeting: "Termin buchen",
      linkedin: "LinkedIn",
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
