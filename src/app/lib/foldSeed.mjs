// Initial editorial copy and disaster-recovery fallback; never imported by the client.
export const foldSeed = {
  showEyebrow: false,
  translations: {
    en: {
      eyebrow: 'Offer · USP · Execution',
      headline: [
        {text: 'Building industrial businesses.', style: 'primary', breakBefore: false},
        {text: ' From ideas to execution.', style: 'accent', breakBefore: false},
      ],
      subheadline: "For more than 15 years, I've built, led, and scaled industrial businesses across international markets. What drives me is a passion for technology, entrepreneurial thinking, and the challenge of turning opportunities into sustainable businesses.",
      statement: 'I believe in taking responsibility, challenging established thinking, and standing by my commitments. Especially when things get difficult.',
      cards: [
        {title: 'International Growth & Market Development', description: 'Building new markets, developing international sales organizations, and creating sustainable growth opportunities.'},
        {title: 'Commercial Strategy & Digital Transformation', description: 'Connecting commercial strategy with technology, digital sales processes, and scalable business models.'},
        {title: 'Operational Excellence & Scaling', description: 'Building efficient organizations, improving processes, and creating the operational foundations for sustainable growth.'},
      ],
      ctaLabels: {booking: 'Book a meeting', linkedin: 'LinkedIn'},
    },
    de: {
      eyebrow: 'Angebot · USP · Umsetzung',
      headline: [
        {text: 'Industrieunternehmen entwickeln.', style: 'primary', breakBefore: false},
        {text: ' Ideen in die Tat umsetzen.', style: 'accent', breakBefore: false},
      ],
      subheadline: 'Seit über 15 Jahren baue ich internationale Industrieunternehmen auf, führe und entwickle sie weiter. Was mich antreibt, sind meine Begeisterung für Technologie, unternehmerisches Denken und die Herausforderung, aus neuen Möglichkeiten erfolgreiche Unternehmen zu entwickeln.',
      statement: 'Ich übernehme Verantwortung, hinterfrage bestehende Denkweisen und stehe zu meinen Zusagen. Gerade dann, wenn es schwierig wird.',
      cards: [
        {title: 'Internationales Wachstum & Marktentwicklung', description: 'Neue Märkte erschließen, internationale Vertriebsorganisationen entwickeln und nachhaltige Wachstumsmöglichkeiten schaffen.'},
        {title: 'Vertriebsstrategie & Digitale Transformation', description: 'Vertriebsstrategien mit Technologie, digitalen Prozessen und skalierbaren Geschäftsmodellen verbinden.'},
        {title: 'Operative Exzellenz & Skalierung', description: 'Effiziente Organisationen aufbauen, Prozesse verbessern und die operativen Grundlagen für nachhaltiges Wachstum schaffen.'},
      ],
      ctaLabels: {booking: 'Termin buchen', linkedin: 'LinkedIn'},
    },
  },
};
export const foldDestinations = {booking: {source: 'profile.koalendar'}, linkedin: {url: 'https://www.linkedin.com/in/mkrostewitz'}};
