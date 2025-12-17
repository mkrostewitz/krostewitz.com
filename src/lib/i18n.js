import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import {initReactI18next} from "react-i18next";

export const resources = {
  en: {
    translation: {
      hero: {
        kicker: "Mathias Krostewitz",
        title: "Dynamic, result-driven leader for industrial technology.",
        subtitle:
          "15+ years starting, growing, and turning around businesses across the US, China, and Europe—pairing commercial rigor with hands-on software builds.",
        booking: "Schedule a call",
        contact: "Contact form",
      },
      nav: {
        about: "About",
        timeline: "Experience",
        executiveSummary: "Summary",
        map: "Countries",
        cv: "CV",
        contact: "Contact",
      },
      offer: {
        eyebrow: "How I help",
        title:
          "Stabilize operations, unlock growth, and build the systems to run it.",
        subtitle:
          "Industrial/automation operator who pairs turnaround discipline with hands-on software delivery.",
        points: [
          "Design sustainable GTM playbooks and partner routes that fit your market",
          "Turbaround your operations and build efficient teams",
          "Stabilize cash, supply, and delivery with pragmatic ops changes",
        ],
        cta: "Schedule a Call",
        alt: "Portrait of Mathias Krostewitz",
      },
      stats: {
        yearsLeadership: "Years leading global teams",
        revenuePerHead: "Revenue scaled to",
        markets: "Markets opened",
        product: "Systems & rollouts",
      },
      about: {
        headline: "Growth operator for automation and industrial tech.",
        body: "I challenge the status quo, build efficient teams, and deliver sustainable growth. From New York to China and Germany, I combine strategic leadership with hands-on product and system design—covering strategy, commercial execution, and IT/automation.",
        highlights: [
          "Started and scaled businesses in the US and China with customer-centric playbooks.",
          "Architected and coded CRM, ERP, and accounting systems tailored to unique processes.",
          "Built distribution networks across North America, Asia-Pacific, and the Middle East.",
        ],
      },
      skills: {
        title: "Value I bring",
        leadership: "Business strategy & GTM",
        ops: "General management & change",
        product: "IT & software development",
        data: "Process optimization & automation",
      },
      timeline: [
        {
          period: "Aug 2023 — Present",
          title: "Founder & CEO, INTUTEC LLC",
          location: "Palo Alto, USA",
          detail:
            "Building an AI marketplace for automation components—defining vision, data model, and UI while onboarding manufacturers.",
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
            "Coded a custom system to match unique processes—covering CRM, ERP, and accounting to increase team efficiency and transparency.",
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
        title: "Dynamischer, ergebnisorientierter Leader für Industrietechnik.",
        subtitle:
          "Über 15 Jahre Aufbau, Wachstum und Turnarounds in USA, China und Europa—mit strategischer Führung und hands-on Software-Umsetzung.",
        booking: "Termin buchen",
        contact: "Kontaktformular",
      },
      nav: {
        about: "Über mich",
        timeline: "Erfahrung",
        executiveSummary: "Auf einen Blick",
        map: "Ländererfahrung",
        cv: "Lebenslauf",
        contact: "Kontakt",
      },
      offer: {
        eyebrow: "So helfe ich",
        title: "Nachhaltiger Unternehmensaufbau in den USA und Asien.",
        subtitle:
          "Industrie-/Automations-Operator, der Turnaround-Disziplin mit hands-on Software-Delivery verbindet",
        points: [
          "Entwicklung von Markteintrits-Strategien und Distributionskanälen, die zu ihrem Unternehmen und Produkten passen",
          "Cash, Supply und Delivery mit pragmatischen Ops-Maßnahmen stabilisieren",

          "Schlanke CRM/ERP-Automatisierungen bauen, zugeschnitten auf eure Arbeitsweise.",
        ],
        cta: "Termin vereinbaren",
        alt: "Portrait von Mathias Krostewitz",
      },
      stats: {
        yearsLeadership: "Jahre Führung globaler Teams",
        revenuePerHead: "Umsatzwachstum",
        markets: "Markteintritte",
        product: "Systeme & Rollouts",
      },
      about: {
        headline: "Growth Operator für Automatisierung und Industrietechnik.",
        body: "Ich stelle den Status quo infrage, baue effiziente Teams auf und liefere nachhaltiges Wachstum. Von New York über China bis Deutschland verbinde ich Strategie, Kommerz und IT/Automation—inklusive System- und Produktdesign.",
        highlights: [
          "Unternehmen in den USA und China mit kundenzentrierten Playbooks aufgebaut und skaliert.",
          "CRM-, ERP- und Buchhaltungs-Systeme selbst konzipiert und entwickelt.",
          "Distributionsnetzwerke in Nordamerika, Asien-Pazifik und dem Nahen Osten aufgebaut.",
        ],
      },
      skills: {
        title: "Wertbeitrag",
        leadership: "Business-Strategie & GTM",
        ops: "General Management & Change",
        product: "IT & Softwareentwicklung",
        data: "Prozessoptimierung & Automatisierung",
      },
      timeline: [
        {
          period: "Aug 2023 — Heute",
          title: "Founder & CTO, INTUTEC LLC",
          location: "New York, USA",
          detail:
            "Aufbau eines AI-Marktplatzes für Automatisierungskomponenten—Vision, Datenmodell und UI sowie Hersteller-Onboarding.",
        },
        {
          period: "Jul 2022 — Heute",
          title: "President, Schlegel USA Inc.",
          location: "New York, USA",
          detail:
            "Vision, Business Planning und Cashflow für einen HMI-Hersteller; Partnergewinnung und Forecasting-Alignment.",
        },
        {
          period: "Mär 2018 — Jun 2022",
          title: "CEO & President, CAPTRON North America LP",
          location: "New York, USA",
          detail:
            "Turnaround erreicht: Umsatz von 0,8 Mio. (2017) auf 13,5 Mio. USD (2021) mit EBITDA >15%, Supply Chain lokalisiert und OTIF von 56% auf 88% gesteigert; eigenes CRM/ERP/Buchhaltungssystem entwickelt.",
        },
        {
          period: "Jun 2014 — Apr 2018",
          title: "Head of Business Development, CAPTRON Electronic GmbH",
          location: "München, Deutschland",
          detail:
            "NAFTA-Vertrieb von 4k (2014) auf 800k USD (2017) aufgebaut und ein neues Industrie-/ProduktexecutiveSummary mit >10 Mio. USD Umsatzpotenzial geschaffen.",
        },
        {
          period: "Feb 2012 — Mai 2014",
          title: "Regional Manager Asia, SATECO Asia Limited",
          location: "Hongkong & Suzhou, China",
          detail:
            "Markteintritt in China für Automotive umgesetzt, FICE mit 600k € Budget gegründet und 4,5 Mio. € Umsatz in China, Indien und Korea verantwortet.",
        },
        {
          period: "2003 — 2012",
          title: "GM & Commercial Roles (Mentor, MBG, Eisbär)",
          location: "München & China",
          detail:
            "Interims-GM und Einkaufsmandate geleitet und Lieferantenbeziehungen sowie Projekt-Pipelines aufgebaut.",
        },
      ],
      executiveSummary: [
        {
          title: "CAPTRON North America Turnaround",
          role: "CEO & President",
          impact:
            "Umsatz von 0,8 Mio. auf 13,5 Mio. USD skaliert, EBITDA >15% gehalten und OTIF durch lokalisierte Supply Chain auf 88% gebracht.",
        },
        {
          title: "Eigenes CRM-, ERP- & Buchhaltungssystem",
          role: "Architekt & Builder",
          impact:
            "Ein maßgeschneidertes System entwickelt, das CRM, ERP und Accounting abbildet und die Teameffizienz deutlich erhöht.",
        },
        {
          title: "Globales Distributionsnetzwerk",
          role: "Head of Business Development",
          impact:
            "Distributoren in NAFTA, MENA und APAC aufgebaut, Exportquote gesteigert und neue Umsatzströme erschlossen.",
        },
      ],
      map: {
        title: "Globale Erfahrungs-Landkarte",
        subtitle:
          "Länder, in denen ich gelebt und Teams geführt habe, sowie Märkte, die ich aufgebaut habe—über drei Kontinente hinweg.",
        lived: "Gelebt & Teams geführt",
        worked: "Märkte entwickelt",
        partner: "Partnernetzwerk",
        missingToken:
          "Füge NEXT_PUBLIC_MAPBOX_TOKEN hinzu, um die Karte zu laden.",
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
        body: "Ein gesicherter Admin-Bereich ermöglicht es mir, Lebenslauf und Executive Summary zu pflegen. Authentifizierung und Editing folgen im nächsten Schritt.",
        cta: "Backend-Plan definieren",
      },
      contact: {
        title: "Lass uns effizient bauen",
        subtitle:
          "Melde dich direkt oder per Formular—für Strategie, Markteintritt oder Prozessautomatisierung. Antwort meist innerhalb eines Werktags.",
        directTitle: "Direkter Kontakt",
        directNote:
          "Lieber schnell per Telefon oder E-Mail? Ich bin erreichbar.",
        phoneLabel: "Telefon",
        emailLabel: "E-Mail",
        name: "Name",
        email: "E-Mail",
        message: "Wobei kann ich unterstützen?",
        placeholderName: "Max Mustermann",
        placeholderEmail: "du@email.de",
        placeholderMessage: "Erzähl mir von der Herausforderung...",
        submit: "Nachricht senden",
        sending: "Wird gesendet...",
        success: "Danke! Ich melde mich zeitnah.",
        verifyPrompt:
          "Wir haben einen 6-stelligen Code an {{email}} gesendet. Gib ihn ein, um deine E-Mail zu bestätigen.",
        verifyCodeLabel: "Verifizierungscode",
        verifyCodePlaceholder: "123456",
        verifySubmit: "E-Mail bestätigen",
        verifyEdit: "Angaben bearbeiten",
        verifySent:
          "Bitte prüfe deine E-Mail und gib den 6-stelligen Code ein.",
        verifySuccess: "E-Mail bestätigt. Wir haben deine Nachricht erhalten.",
        sendAnother: "Weitere Nachricht senden",
        alreadyExists: "Wir stehen bereits in Kontakt.",
        missingFields: "Bitte alle Pflichtfelder ausfüllen.",
        invalidCode: "Ungültiger Verifizierungscode.",
        notFound: "Keine ausstehende Verifizierung für diese E-Mail gefunden.",
        sendFailed:
          "Verifizierung erfolgreich, aber Versand fehlgeschlagen. Bitte erneut versuchen.",
        mailNotConfigured: "E-Mail-Versand ist nicht konfiguriert.",
        errorGeneric: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
        validation: {
          name: "Name ist erforderlich",
          email: "Bitte eine gültige E-Mail eingeben",
          message: "Bitte etwas mehr Details hinzufügen",
          code: "Bitte den 6-stelligen Code eingeben",
          codeRequired: "Verifizierungscode ist erforderlich",
        },
      },
      cv: {
        title: "Lebenslauf",
        subtitle:
          "Aktueller Lebenslauf meiner Expertise, Ergebnisse und Highlights.",
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
