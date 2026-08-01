/**
 * Tire reference data for vehicles common on Israeli roads.
 *
 * This is the fallback used when data.gov.il refuses to answer — a rate limit,
 * an IP block, or a model row that simply has no tire cell filled in. It is a
 * reference table, not a registry: it is keyed by make/model/year, because that
 * is the only key that can be known without the government API.
 *
 * IMPORTANT — what this file may and may not be used for.
 *
 * A plate cannot be resolved to a vehicle without step 1 of the aggregation. If
 * step 1 fails we do not know what car we are looking at, and inventing one
 * would put a customer on tires that do not fit their vehicle. Fitment is a
 * safety property: an under-rated tire fails under load, and a wrong rolling
 * diameter breaks ABS and speedometer calibration. So this table only ever
 * answers "which tires does a 2021 Corolla take", never "whose car is this",
 * and anything served from here is flagged `verified: false` so the UI can say
 * where the number came from.
 *
 * Sizes are OEM fitments; `alternates` are other sizes the manufacturer
 * approves for the same model generation.
 */

/**
 * @typedef {object} ReferenceEntry
 * @property {string} make Canonical English make.
 * @property {string[]} makeAliases Hebrew and registry spellings.
 * @property {string} model Canonical English model.
 * @property {string[]} modelAliases Hebrew and commercial spellings.
 * @property {[number, number]} years Inclusive production range this row covers.
 * @property {string} front OEM front size.
 * @property {string} [rear] OEM rear size when the car is staggered.
 * @property {string[]} [alternates] Other approved sizes.
 * @property {'passenger'|'suv'|'commercial'|'performance'} [vehicleClass]
 */

/** @type {ReferenceEntry[]} */
export const TIRE_REFERENCE = [
  // ---------------------------------------------------------------- Toyota
  {
    make: 'Toyota',
    makeAliases: ['טויוטה'],
    model: 'Corolla',
    modelAliases: ['קורולה'],
    years: [2019, 2026],
    front: '205/55R16',
    alternates: ['225/45R17'],
  },
  {
    make: 'Toyota',
    makeAliases: ['טויוטה'],
    model: 'C-HR',
    modelAliases: ['סי-אייצ\'-אר'],
    years: [2017, 2026],
    front: '215/60R17',
    alternates: ['225/50R18'],
    vehicleClass: 'suv',
  },
  {
    make: 'Toyota',
    makeAliases: ['טויוטה'],
    model: 'RAV4',
    modelAliases: ['ראב 4', 'ראב4'],
    years: [2019, 2026],
    front: '225/65R17',
    alternates: ['235/55R19'],
    vehicleClass: 'suv',
  },
  {
    make: 'Toyota',
    makeAliases: ['טויוטה'],
    model: 'Yaris',
    modelAliases: ['יאריס'],
    years: [2015, 2026],
    front: '185/60R15',
    alternates: ['195/50R16'],
  },

  // --------------------------------------------------------------- Hyundai
  {
    make: 'Hyundai',
    makeAliases: ['יונדאי', 'הyundai'],
    model: 'i10',
    modelAliases: ['אי 10'],
    years: [2014, 2026],
    front: '155/80R13',
    alternates: ['175/60R15'],
  },
  {
    make: 'Hyundai',
    makeAliases: ['יונדאי'],
    model: 'i20',
    modelAliases: ['אי 20'],
    years: [2015, 2026],
    front: '185/65R15',
    alternates: ['195/55R16'],
  },
  {
    make: 'Hyundai',
    makeAliases: ['יונדאי'],
    model: 'Tucson',
    modelAliases: ['טוסון'],
    years: [2016, 2026],
    front: '225/60R17',
    alternates: ['235/60R18', '235/55R19'],
    vehicleClass: 'suv',
  },
  {
    make: 'Hyundai',
    makeAliases: ['יונדאי'],
    model: 'Ioniq 5',
    modelAliases: ['איוניק 5', 'איוניק'],
    years: [2021, 2026],
    front: '235/55R19',
    alternates: ['255/45R20'],
    vehicleClass: 'suv',
  },

  // ------------------------------------------------------------------- Kia
  {
    make: 'Kia',
    makeAliases: ['קיה'],
    model: 'Picanto',
    modelAliases: ['פיקנטו'],
    years: [2017, 2026],
    front: '175/65R14',
    alternates: ['195/45R16'],
  },
  {
    make: 'Kia',
    makeAliases: ['קיה'],
    model: 'Sportage',
    modelAliases: ['ספורטאז\'', 'ספורטג'],
    years: [2016, 2026],
    front: '225/60R17',
    alternates: ['235/65R17', '235/55R19'],
    vehicleClass: 'suv',
  },
  {
    make: 'Kia',
    makeAliases: ['קיה'],
    model: 'Niro',
    modelAliases: ['נירו'],
    years: [2017, 2026],
    front: '205/60R16',
    alternates: ['225/45R18'],
    vehicleClass: 'suv',
  },

  // ----------------------------------------------------------------- Mazda
  {
    make: 'Mazda',
    makeAliases: ['מאזדה'],
    model: '3',
    modelAliases: ['מאזדה 3', 'מזדה 3'],
    years: [2014, 2026],
    front: '205/60R16',
    alternates: ['215/45R18'],
  },
  {
    make: 'Mazda',
    makeAliases: ['מאזדה'],
    model: 'CX-5',
    modelAliases: ['סי אקס 5'],
    years: [2017, 2026],
    front: '225/65R17',
    alternates: ['225/55R19'],
    vehicleClass: 'suv',
  },

  // -------------------------------------------------------- VW / Škoda / Seat
  {
    make: 'Volkswagen',
    makeAliases: ['פולקסווגן', 'פולקסוואגן'],
    model: 'Golf',
    modelAliases: ['גולף'],
    years: [2013, 2026],
    front: '205/55R16',
    alternates: ['225/45R17', '225/40R18'],
  },
  {
    make: 'Volkswagen',
    makeAliases: ['פולקסווגן'],
    model: 'Tiguan',
    modelAliases: ['טיגואן'],
    years: [2016, 2026],
    front: '215/65R17',
    alternates: ['235/55R18'],
    vehicleClass: 'suv',
  },
  {
    make: 'Škoda',
    makeAliases: ['סקודה', 'שקודה'],
    model: 'Octavia',
    modelAliases: ['אוקטביה'],
    years: [2013, 2026],
    front: '205/55R16',
    alternates: ['225/45R17'],
  },
  {
    make: 'Seat',
    makeAliases: ['סיאט'],
    model: 'Ibiza',
    modelAliases: ['איביזה'],
    years: [2017, 2026],
    front: '185/65R15',
    alternates: ['215/45R17'],
  },

  // ------------------------------------------------------- Other volume cars
  {
    make: 'Nissan',
    makeAliases: ['ניסאן'],
    model: 'Qashqai',
    modelAliases: ['קשקאי'],
    years: [2014, 2026],
    front: '215/65R17',
    alternates: ['215/60R17', '235/50R19'],
    vehicleClass: 'suv',
  },
  {
    make: 'Suzuki',
    makeAliases: ['סוזוקי'],
    model: 'Swift',
    modelAliases: ['סוויפט'],
    years: [2017, 2026],
    front: '185/55R16',
  },
  {
    make: 'Suzuki',
    makeAliases: ['סוזוקי'],
    model: 'Vitara',
    modelAliases: ['ויטרה'],
    years: [2015, 2026],
    front: '215/60R16',
    alternates: ['215/55R17'],
    vehicleClass: 'suv',
  },
  {
    make: 'Renault',
    makeAliases: ['רנו'],
    model: 'Clio',
    modelAliases: ['קליאו'],
    years: [2013, 2026],
    front: '185/65R15',
    alternates: ['195/55R16', '205/45R17'],
  },
  {
    make: 'Peugeot',
    makeAliases: ['פיג\'ו', 'פיגו'],
    model: '208',
    modelAliases: ['208'],
    years: [2015, 2026],
    front: '185/65R15',
    alternates: ['205/45R17'],
  },
  {
    make: 'Mitsubishi',
    makeAliases: ['מיצובישי'],
    model: 'Outlander',
    modelAliases: ['אאוטלנדר'],
    years: [2016, 2026],
    front: '225/55R18',
    alternates: ['255/45R20'],
    vehicleClass: 'suv',
  },
  {
    make: 'Honda',
    makeAliases: ['הונדה'],
    model: 'Civic',
    modelAliases: ['סיוויק'],
    years: [2016, 2026],
    front: '215/55R16',
    alternates: ['235/40R18'],
  },
  {
    make: 'Ford',
    makeAliases: ['פורד'],
    model: 'Focus',
    modelAliases: ['פוקוס'],
    years: [2015, 2026],
    front: '205/60R16',
    alternates: ['215/50R17'],
  },

  // ------------------------------------------------------------- Staggered
  {
    make: 'Tesla',
    makeAliases: ['טסלה'],
    model: 'Model 3',
    modelAliases: ['מודל 3'],
    years: [2019, 2026],
    front: '235/45R18',
    alternates: ['235/40R19'],
  },
  {
    make: 'BMW',
    makeAliases: ['ב.מ.וו', 'במוו'],
    model: '3 Series',
    modelAliases: ['סדרה 3'],
    years: [2019, 2026],
    front: '225/45R18',
    rear: '255/40R18',
    vehicleClass: 'performance',
  },
  {
    make: 'Porsche',
    makeAliases: ['פורשה'],
    model: '911 Carrera',
    modelAliases: ['911', 'קררה'],
    years: [2019, 2026],
    front: '235/40R19',
    rear: '295/35R20',
    vehicleClass: 'performance',
  },
]

/* -------------------------------- Matching -------------------------------- */

/**
 * Strip punctuation, case and Hebrew final-letter variants so registry spelling
 * ("טויוטה יפן", "MAZDA  3") matches the canonical entry.
 */
function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[־\-_.'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesName(candidate, canonical, aliases) {
  const needle = normalizeName(candidate)
  if (!needle) return false

  return [canonical, ...aliases].some((name) => {
    const hay = normalizeName(name)
    return hay.length > 0 && (needle === hay || needle.includes(hay) || hay.includes(needle))
  })
}

/**
 * Find the reference row for a vehicle we have already identified.
 *
 * Requires a make and model — this function deliberately has no way to answer
 * from a plate alone. Year narrows between generations when several rows share
 * a model name; a vehicle outside every range still matches the model so an
 * unusual year degrades to "probably right" rather than to nothing.
 *
 * @param {{ make?: string, model?: string, year?: number }} vehicle
 * @returns {ReferenceEntry|null}
 */
export function findReferenceEntry({ make, model, year } = {}) {
  if (!make && !model) return null

  const candidates = TIRE_REFERENCE.filter((entry) => {
    const makeOk = !make || matchesName(make, entry.make, entry.makeAliases)
    const modelOk = !model || matchesName(model, entry.model, entry.modelAliases)
    return makeOk && modelOk
  })

  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  const inYear = candidates.find(
    (entry) => Number.isFinite(year) && year >= entry.years[0] && year <= entry.years[1],
  )
  return inYear ?? candidates[0]
}

/**
 * Reference row rendered as approved sizes.
 *
 * OEM sizes come first and are flagged; alternates follow unflagged, matching
 * how the registry-sourced path orders them so the UI needs no special case.
 *
 * @returns {Array<{position: string, size: string, isOem: boolean}>}
 */
export function referenceSizes(entry) {
  if (!entry) return []

  if (entry.rear && entry.rear !== entry.front) {
    return [
      { position: 'front', size: entry.front, isOem: true },
      { position: 'rear', size: entry.rear, isOem: true },
    ]
  }

  return [
    { position: 'all', size: entry.front, isOem: true },
    ...(entry.alternates ?? []).map((size) => ({ position: 'all', size, isOem: false })),
  ]
}
