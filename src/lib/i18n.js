import i18n from "i18next";
import {initReactI18next} from "react-i18next";

export const resources = {
  en: {
    translation: {
      hero: {
        kicker: "Mathias Krostewitz",
        title: "Scaling companies with lean, data-driven leadership.",
        subtitle:
          "Former CEO and President building profitable teams across Asia and the US. Now pairing operational rigor with full-stack and AI expertise.",
        booking: "Schedule a call",
        contact: "Contact form",
      },
      nav: {
        about: "About",
        timeline: "Timeline",
        portfolio: "Portfolio",
        map: "Map",
        contact: "Contact",
      },
      stats: {
        yearsLeadership: "Years leading global teams",
        revenuePerHead: "Revenue per head",
        markets: "Markets launched",
        product: "Products shipped",
      },
      about: {
        headline: "Operator, builder, lifelong learner.",
        body: "I thrive on turning limited resources into repeatable systems. Over the past decade I have led teams across the US, China, Singapore, and Europe—scaling sales, marketing, and operations while keeping efficiency first. Alongside executive roles, I completed MIT's Full Stack program (MERN) and am continuing at MIT in Data Science and AI.",
        highlights: [
          "Bootstrapped companies to profitability with lean playbooks.",
          "Built ERP, accounting, and B2B marketplace platforms.",
          "Hands-on across go-to-market, operations, and product delivery.",
        ],
      },
      skills: {
        title: "Execution strengths",
        leadership: "Leadership & culture",
        ops: "Operational excellence",
        product: "Product & architecture",
        data: "Data & automation",
      },
      timeline: [
        {
          period: "2022 — Present",
          title: "President, Global Operations",
          location: "Singapore, Remote-first",
          detail:
            "Scaled cross-border teams, restructured operations with lean KPIs, and uplifted profitability per head beyond $1.5M.",
        },
        {
          period: "2018 — 2022",
          title: "CEO & Founder",
          location: "Shanghai & Los Angeles",
          detail:
            "Built a B2B industrial marketplace from zero, delivering sales, marketing, and service delivery motions across two continents.",
        },
        {
          period: "2015 — 2018",
          title: "Managing Director",
          location: "Hong Kong & Shenzhen",
          detail:
            "Opened and scaled new country P&Ls, negotiated key supplier partnerships, and launched multi-language sales teams.",
        },
        {
          period: "2012 — 2015",
          title: "Regional Commercial Lead",
          location: "Germany & Greater China",
          detail:
            "Introduced process automation, improved forecasting accuracy, and coached teams on consultative selling.",
        },
      ],
      portfolio: [
        {
          title: "Industrial B2B Marketplace",
          role: "Founder & Product Lead",
          impact:
            "Launched supply discovery, quote workflows, and onboarding for 1K+ vendors with integrated payments.",
        },
        {
          title: "Custom ERP & Accounting",
          role: "Architect & Builder",
          impact:
            "Delivered a FileMaker-based ERP covering inventory, invoicing, and financial reporting with granular permissions.",
        },
        {
          title: "Global Expansion Playbook",
          role: "CEO",
          impact:
            "Designed a repeatable GTM kit (ICP, messaging, enablement) to open five markets with lean headcount.",
        },
      ],
      map: {
        title: "Where I've operated",
        lived: "Lived & led teams",
        worked: "Built operations",
        missingToken: "Add NEXT_PUBLIC_MAPBOX_TOKEN to show the map.",
      },
      backend: {
        title: "Private backend",
        body: "A secure admin area will let me update the resume, add portfolio entries, and adjust availability. Authentication and content editing are staged for the next iteration.",
        cta: "Plan backend scope",
      },
      contact: {
        title: "Let’s build something efficient",
        subtitle:
          "Tell me about your challenge—operations, product, or data. I usually reply within one business day.",
        name: "Name",
        email: "Email",
        message: "What can I help with?",
        submit: "Send message",
        success: "Thanks! I’ll reply shortly.",
        verifyPrompt:
          "We sent a 6-digit code to {{email}}. Enter it below to confirm your email.",
        verifyCodeLabel: "Verification code",
        verifyCodePlaceholder: "123456",
        verifySubmit: "Confirm email",
        verifyEdit: "Edit details",
        verifySent: "Check your email for a 6-digit code to confirm.",
        verifySuccess: "Email confirmed. We received your message.",
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
      meeting: "Book time on my Calendar",
      linkedin: "LinkedIn",
    },
  },
  de: {
    translation: {
      hero: {
        kicker: "Mathias Krostewitz",
        title: "Unternehmen skalieren mit schlanker, datengetriebener Führung.",
        subtitle:
          "Ehemaliger CEO und President in Asien und den USA. Ich verbinde operative Exzellenz mit Full-Stack- und AI-Know-how.",
        booking: "Termin buchen",
        contact: "Kontaktformular",
      },
      nav: {
        about: "Über mich",
        timeline: "Werdegang",
        portfolio: "Portfolio",
        map: "Karte",
        contact: "Kontakt",
      },
      stats: {
        yearsLeadership: "Jahre Führung globaler Teams",
        revenuePerHead: "Umsatz pro Kopf",
        markets: "Neue Märkte",
        product: "Produktstarts",
      },
      about: {
        headline: "Macher, Builder, stetiger Lerner.",
        body: "Ich liebe es, aus wenig Ressourcen robuste Systeme aufzubauen. In den letzten Jahren habe ich Teams in den USA, China, Singapur und Europa geführt—immer mit Effizienz als Leitstern. Parallel habe ich den MIT Full-Stack-Kurs (MERN) abgeschlossen und erweitere mein Wissen in Data Science & AI am MIT.",
        highlights: [
          "Unternehmen mit schlanken Playbooks in die Profitabilität geführt.",
          "ERP-, Buchhaltungs- und B2B-Marktplatz-Plattformen gebaut.",
          "Hands-on in Go-to-Market, Operations und Produktentwicklung.",
        ],
      },
      skills: {
        title: "Stärken in der Umsetzung",
        leadership: "Leadership & Kultur",
        ops: "Operative Exzellenz",
        product: "Produkt & Architektur",
        data: "Daten & Automatisierung",
      },
      timeline: [
        {
          period: "2022 — Heute",
          title: "President, Global Operations",
          location: "Singapur, Remote-first",
          detail:
            "Grenzüberschreitende Teams skaliert, Lean-KPIs eingeführt und die Profitabilität pro Kopf über 1,5 Mio. USD gehoben.",
        },
        {
          period: "2018 — 2022",
          title: "CEO & Gründer",
          location: "Shanghai & Los Angeles",
          detail:
            "Einen B2B-Industrie-Marktplatz von Null aufgebaut—Sales, Marketing und Delivery über zwei Kontinente orchestriert.",
        },
        {
          period: "2015 — 2018",
          title: "Managing Director",
          location: "Hongkong & Shenzhen",
          detail:
            "Neue Länder-P&Ls eröffnet, Lieferantenpartnerschaften verhandelt und mehrsprachige Vertriebsteams aufgebaut.",
        },
        {
          period: "2012 — 2015",
          title: "Regional Commercial Lead",
          location: "Deutschland & Greater China",
          detail:
            "Prozessautomatisierung eingeführt, Forecasting verbessert und Teams in beratendem Verkauf geschult.",
        },
      ],
      portfolio: [
        {
          title: "Industrieller B2B-Marktplatz",
          role: "Gründer & Produktlead",
          impact:
            "Supply-Discovery, Angebots-Workflows und Onboarding für 1.000+ Anbieter mit integrierten Payments.",
        },
        {
          title: "Custom ERP & Buchhaltung",
          role: "Architekt & Builder",
          impact:
            "FileMaker-ERP für Bestand, Rechnungen und Reporting mit granularen Berechtigungen geliefert.",
        },
        {
          title: "Expansion-Playbook",
          role: "CEO",
          impact:
            "Wiederholbares GTM-Kit (ICP, Messaging, Enablement) entwickelt, um fünf Märkte mit schlankem Team zu eröffnen.",
        },
      ],
      map: {
        title: "Hier habe ich gewirkt",
        lived: "Gelebt & Teams geführt",
        worked: "Operationen aufgebaut",
        partner: "Tiefe Partnerschaften",
        missingToken:
          "Füge NEXT_PUBLIC_MAPBOX_TOKEN hinzu, um die Karte zu laden.",
      },
      backend: {
        title: "Privater Backend-Bereich",
        body: "Ein gesicherter Admin-Bereich ermöglicht es mir, Lebenslauf und Portfolio zu pflegen. Authentifizierung und Editing folgen im nächsten Schritt.",
        cta: "Backend-Plan definieren",
      },
      contact: {
        title: "Lass uns effizient bauen",
        subtitle:
          "Erzähl mir von deiner Herausforderung—Operations, Produkt oder Daten. Ich antworte in der Regel innerhalb eines Werktags.",
        name: "Name",
        email: "E-Mail",
        message: "Wobei kann ich unterstützen?",
        submit: "Nachricht senden",
        success: "Danke! Ich melde mich zeitnah.",
        verifyPrompt:
          "Wir haben einen 6-stelligen Code an {{email}} gesendet. Gib ihn ein, um deine E-Mail zu bestätigen.",
        verifyCodeLabel: "Verifizierungscode",
        verifyCodePlaceholder: "123456",
        verifySubmit: "E-Mail bestätigen",
        verifyEdit: "Angaben bearbeiten",
        verifySent: "Bitte prüfe deine E-Mail und gib den 6-stelligen Code ein.",
        verifySuccess: "E-Mail bestätigt. Wir haben deine Nachricht erhalten.",
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
      meeting: "Termin buchen",
      linkedin: "LinkedIn",
    },
  },
};

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: "en",
    fallbackLng: "en",
    interpolation: {escapeValue: false},
  });
}

export default i18n;
