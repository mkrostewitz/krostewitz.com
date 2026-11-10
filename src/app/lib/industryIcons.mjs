// Shared by storage validation and the public/admin icon renderers.
export const INDUSTRY_ICON_OPTIONS = {
  factory: 'Factory',
  automation: 'Automation',
  infrastructure: 'Transportation',
  automotive: 'Automotive',
  electronics: 'Electronics',
  intralogistics: 'Warehouse',
  advertisement: 'Advertising',
  mobility: 'Mobility',
  process: 'Process automation',
  attractions: 'Rides & attractions',
  telecommunications: 'Telecommunications',
};
export const INDUSTRY_ICONS = Object.keys(INDUSTRY_ICON_OPTIONS);

export function resolveIndustryIcon(industry = {}) {
  if (INDUSTRY_ICONS.includes(industry.icon)) return industry.icon;
  // Prefer the stable English title so automatic icons agree across languages.
  const label = industry.translations?.en?.label || industry.label || '';
  const rules = [
    ['automotive', /automotiv|automobil/i],
    ['electronics', /electronic|elektronik/i],
    ['advertisement', /advertis|werbung|marketing/i],
    ['intralogistics', /warehouse|warehous|intralogisti|lager/i],
    ['attractions', /rides|attraction|attraktion|freizeit/i],
    ['telecommunications', /telecom|telekom/i],
    ['mobility', /mobility|mobilität/i],
    ['process', /process|prozess/i],
    ['infrastructure', /traffic|transport|transit|verkehr|infrastr/i],
    ['automation', /automat|controls|steuerung/i],
  ];
  return rules.find(([, pattern]) => pattern.test(label))?.[0] || 'factory';
}
