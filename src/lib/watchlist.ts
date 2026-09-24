// Curated keyword watchlist used by the auto-sweep, in addition to the Al Bukhary
// entity names/aliases pulled live from the `entities` table. Keep this list short
// and high-signal — it's meant to catch macro/sector triggers that aren't tied to a
// named Al Bukhary entity but still matter for the brief's beat (Global, Asia Pacific,
// Malaysia Macro, Ports/Infra/Logistics, Automotive, Agriculture/Food Security,
// Energy/Power/Sustainability, Digital Economy/Data Centres, Property, Aviation,
// Banking/Financial Services). Edit freely as the client's priorities shift.

export interface WatchTerm {
  term: string
  sector: string
  priority: 'high' | 'normal'
}

export const CURATED_KEYWORDS: WatchTerm[] = [
  // Malaysia Macro
  { term: 'Bank Negara', sector: 'Malaysia Macro', priority: 'high' },
  { term: 'OPR', sector: 'Malaysia Macro', priority: 'high' },
  { term: 'ringgit', sector: 'Malaysia Macro', priority: 'normal' },
  { term: 'Budget 2027', sector: 'Malaysia Macro', priority: 'high' },
  { term: 'GDP', sector: 'Malaysia Macro', priority: 'normal' },
  { term: 'inflation', sector: 'Malaysia Macro', priority: 'normal' },
  { term: 'subsidy', sector: 'Malaysia Macro', priority: 'normal' },
  { term: 'Bursa Malaysia', sector: 'Malaysia Macro', priority: 'normal' },

  // Asia Pacific / Global
  { term: 'Federal Reserve', sector: 'Global', priority: 'normal' },
  { term: 'tariff', sector: 'Global', priority: 'high' },
  { term: 'ASEAN', sector: 'Asia Pacific', priority: 'normal' },
  { term: 'China economy', sector: 'Asia Pacific', priority: 'normal' },

  // Ports / Infrastructure / Logistics
  { term: 'port', sector: 'Ports/Infrastructure/Logistics', priority: 'normal' },
  { term: 'container throughput', sector: 'Ports/Infrastructure/Logistics', priority: 'normal' },
  { term: 'logistics', sector: 'Ports/Infrastructure/Logistics', priority: 'normal' },

  // Automotive / Services
  { term: 'automotive', sector: 'Automotive/Services', priority: 'normal' },
  { term: 'EV incentive', sector: 'Automotive/Services', priority: 'normal' },
  { term: 'Proton', sector: 'Automotive/Services', priority: 'high' },
  { term: 'Perodua', sector: 'Automotive/Services', priority: 'normal' },

  // Agriculture / Food Security
  { term: 'palm oil', sector: 'Agriculture/Food Security', priority: 'normal' },
  { term: 'rice supply', sector: 'Agriculture/Food Security', priority: 'high' },
  { term: 'food security', sector: 'Agriculture/Food Security', priority: 'normal' },

  // Energy / Power / Sustainability
  { term: 'Petronas', sector: 'Energy/Power/Sustainability', priority: 'normal' },
  { term: 'LNG', sector: 'Energy/Power/Sustainability', priority: 'normal' },
  { term: 'solar', sector: 'Energy/Power/Sustainability', priority: 'normal' },
  { term: 'TNB', sector: 'Energy/Power/Sustainability', priority: 'normal' },
  { term: 'fuel subsidy', sector: 'Energy/Power/Sustainability', priority: 'high' },

  // Digital Economy / Technology / Data Centres
  { term: 'data centre', sector: 'Digital Economy/Technology/Data Centres', priority: 'high' },
  { term: 'data center', sector: 'Digital Economy/Technology/Data Centres', priority: 'high' },
  { term: 'semiconductor', sector: 'Digital Economy/Technology/Data Centres', priority: 'normal' },
  { term: 'digital economy', sector: 'Digital Economy/Technology/Data Centres', priority: 'normal' },

  // Property
  { term: 'property market', sector: 'Property', priority: 'normal' },
  { term: 'REIT', sector: 'Property', priority: 'normal' },

  // Aviation
  { term: 'MAHB', sector: 'Aviation', priority: 'normal' },
  { term: 'AirAsia', sector: 'Aviation', priority: 'normal' },
  { term: 'airport', sector: 'Aviation', priority: 'normal' },

  // Banking / Financial Services
  { term: 'sukuk', sector: 'Banking/Financial Services', priority: 'normal' },
  { term: 'Islamic finance', sector: 'Banking/Financial Services', priority: 'normal' },
  { term: 'financing rate', sector: 'Banking/Financial Services', priority: 'normal' },
]
