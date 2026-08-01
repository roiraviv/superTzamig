import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { mergeApprovedSizes, parseTireSizes, toApprovedSizes } from '../lib/tireSize.js'
import { __resetBreaker } from '../lib/govApiClient.js'
import { fallbackFitmentForVehicle, shouldFallBack } from '../services/fallbackService.js'
import {
  __clearCaches,
  buildFitment,
  getVehicleTireSpecs,
  normalizePlate,
  plateFingerprint,
} from '../services/vehicleService.js'

describe('parseTireSizes', () => {
  it('parses the canonical form', () => {
    assert.deepEqual(parseTireSizes('205/55R16'), [
      { size: '205/55R16', width: 205, aspectRatio: 55, rimDiameter: 16 },
    ])
  })

  it('captures load index and speed rating', () => {
    assert.deepEqual(parseTireSizes('225/45R17 94Y'), [
      { size: '225/45R17', width: 225, aspectRatio: 45, rimDiameter: 17, loadIndex: 94, speedRating: 'Y' },
    ])
  })

  it('drops the legacy Z marker from the canonical form', () => {
    assert.equal(parseTireSizes('225/45ZR17')[0].size, '225/45R17')
  })

  it('tolerates stray whitespace', () => {
    assert.equal(parseTireSizes('195 / 65 R 15')[0].size, '195/65R15')
  })

  it('reads the R-less slashed form', () => {
    assert.equal(parseTireSizes('195/65/15')[0].size, '195/65R15')
  })

  it('handles half-inch rims', () => {
    assert.equal(parseTireSizes('215/75R16.5')[0].rimDiameter, 16.5)
  })

  it('returns every size listed in one cell', () => {
    assert.deepEqual(
      parseTireSizes('205/55R16, 225/45R17').map((entry) => entry.size),
      ['205/55R16', '225/45R17'],
    )
  })

  it('does not double-read a canonical size as a slashed triple', () => {
    assert.equal(parseTireSizes('205/55R16').length, 1)
  })

  it('treats registry blanks as no data', () => {
    for (const blank of [null, undefined, '', '0', '-', '   ']) {
      assert.deepEqual(parseTireSizes(blank), [], `expected no sizes for ${JSON.stringify(blank)}`)
    }
  })

  it('rejects implausible dimensions rather than guessing', () => {
    assert.deepEqual(parseTireSizes('999/99R99'), [])
    assert.deepEqual(parseTireSizes('205/55R99'), [])
  })

  it('ignores an out-of-range load index but keeps the size', () => {
    const [entry] = parseTireSizes('205/55R16 999')
    assert.equal(entry.size, '205/55R16')
    assert.equal(entry.loadIndex, undefined)
  })
})

describe('toApprovedSizes', () => {
  it('collapses matching axles to a single entry', () => {
    const sizes = toApprovedSizes({ front: '205/55R16', rear: '205/55R16' })
    assert.equal(sizes.length, 1)
    assert.equal(sizes[0].position, 'all')
    assert.equal(sizes[0].isOem, true)
  })

  it('collapses when the rear cell is empty', () => {
    const sizes = toApprovedSizes({ front: '205/55R16', rear: '' })
    assert.equal(sizes.length, 1)
    assert.equal(sizes[0].position, 'all')
  })

  it('keeps a staggered setup split by axle', () => {
    const sizes = toApprovedSizes({ front: '235/35R19', rear: '295/30R19' })
    assert.deepEqual(
      sizes.map((entry) => [entry.position, entry.size]),
      [
        ['front', '235/35R19'],
        ['rear', '295/30R19'],
      ],
    )
  })

  it('marks only the first size of an axle as OEM', () => {
    const sizes = toApprovedSizes({ front: '205/55R16, 225/45R17', rear: '' })
    assert.deepEqual(sizes.map((entry) => entry.isOem), [true, false])
  })

  it('returns nothing when neither axle parses', () => {
    assert.deepEqual(toApprovedSizes({ front: '0', rear: null }), [])
  })
})

describe('mergeApprovedSizes', () => {
  it('unions sizes across model rows without duplicating', () => {
    const merged = mergeApprovedSizes([
      toApprovedSizes({ front: '205/55R16', rear: '' }),
      toApprovedSizes({ front: '205/55R16', rear: '' , isOem: false }),
      toApprovedSizes({ front: '225/45R17', rear: '', isOem: false }),
    ])
    assert.deepEqual(merged.map((entry) => entry.size), ['205/55R16', '225/45R17'])
  })

  it('keeps the OEM flag if any source row claimed it', () => {
    const merged = mergeApprovedSizes([
      toApprovedSizes({ front: '205/55R16', rear: '', isOem: false }),
      toApprovedSizes({ front: '205/55R16', rear: '', isOem: true }),
    ])
    assert.equal(merged[0].isOem, true)
  })

  it('orders OEM first', () => {
    const merged = mergeApprovedSizes([
      toApprovedSizes({ front: '225/45R17', rear: '', isOem: false }),
      toApprovedSizes({ front: '205/55R16', rear: '', isOem: true }),
    ])
    assert.equal(merged[0].size, '205/55R16')
  })
})

describe('normalizePlate', () => {
  it('strips separators', () => {
    assert.equal(normalizePlate('12-345-67'), '1234567')
    assert.equal(normalizePlate('123 45 678'), '12345678')
  })

  it('rejects anything outside 5-8 digits', () => {
    for (const bad of ['1234', '123456789', 'abcdefg', '', null]) {
      assert.throws(() => normalizePlate(bad), { code: 'invalid_plate', status: 422 })
    }
  })
})

describe('plateFingerprint', () => {
  it('is stable and does not contain the plate', () => {
    const fingerprint = plateFingerprint('1234567')
    assert.equal(fingerprint, plateFingerprint('1234567'))
    assert.ok(!fingerprint.includes('1234567'))
    assert.notEqual(fingerprint, plateFingerprint('7654321'))
  })
})

describe('buildFitment', () => {
  const vehicleRecord = {
    mispar_rechev: 1234567,
    tozeret_nm: 'טויוטה יפן',
    kinuy_mishari: 'COROLLA',
    degem_nm: 'ZRE172L',
    ramat_gimur: 'LUXURY',
    shnat_yitzur: 2021,
    mishkal_kolel: 1800,
    sug_rechev_nm: 'פרטי נוסעים',
  }

  it('strips the country suffix from the manufacturer', () => {
    const fitment = buildFitment({
      plate: '1234567',
      vehicleRecord: { ...vehicleRecord, zmig_kidmi: '205/55R16' },
      modelRecords: [],
    })
    assert.equal(fitment.vehicle.make, 'טויוטה')
  })

  it('prefers the commercial name over the internal model code', () => {
    const fitment = buildFitment({
      plate: '1234567',
      vehicleRecord: { ...vehicleRecord, zmig_kidmi: '205/55R16' },
      modelRecords: [],
    })
    assert.equal(fitment.vehicle.model, 'COROLLA')
  })

  it('falls back to model rows when the vehicle row has no sizes', () => {
    const fitment = buildFitment({
      plate: '1234567',
      vehicleRecord,
      modelRecords: [{ shnat_yitzur: 2021, zmig_kidmi: '205/55R16', zmig_ahori: '205/55R16' }],
    })
    assert.deepEqual(fitment.approvedSizes.map((entry) => entry.size), ['205/55R16'])
    assert.equal(fitment.approvedSizes[0].isOem, true)
  })

  it('unions sizes across trims and marks only the matching year as OEM', () => {
    const fitment = buildFitment({
      plate: '1234567',
      vehicleRecord,
      modelRecords: [
        { shnat_yitzur: 2021, zmig_kidmi: '205/55R16', zmig_ahori: '205/55R16' },
        { shnat_yitzur: 2019, zmig_kidmi: '225/45R17', zmig_ahori: '225/45R17' },
      ],
    })
    assert.deepEqual(fitment.approvedSizes.map((entry) => [entry.size, entry.isOem]), [
      ['205/55R16', true],
      ['225/45R17', false],
    ])
  })

  it('preserves a staggered setup end to end', () => {
    const fitment = buildFitment({
      plate: '1234567',
      vehicleRecord: { ...vehicleRecord, zmig_kidmi: '235/35R19', zmig_ahori: '295/30R19' },
      modelRecords: [],
    })
    assert.deepEqual(fitment.approvedSizes.map((entry) => entry.position), ['front', 'rear'])
  })

  it('classifies a heavy vehicle as an SUV for the alignment upsell', () => {
    const fitment = buildFitment({
      plate: '1234567',
      vehicleRecord: { ...vehicleRecord, mishkal_kolel: 2900, zmig_kidmi: '235/60R18' },
      modelRecords: [],
    })
    assert.equal(fitment.vehicle.vehicleClass, 'suv')
  })

  it('marks a registry-sourced answer as verified', () => {
    const fitment = buildFitment({
      plate: '1234567',
      vehicleRecord: { ...vehicleRecord, zmig_kidmi: '205/55R16' },
      modelRecords: [],
    })
    assert.equal(fitment.source, 'ministry_of_transport')
    assert.equal(fitment.verified, true)
  })

  it('falls back to the reference table when the registry supplies no sizes', () => {
    const fitment = buildFitment({
      plate: '1234567',
      vehicleRecord,
      modelRecords: [],
      fallbackReason: 'registry_blocked',
    })
    assert.equal(fitment.source, 'fallback_reference')
    assert.equal(fitment.verified, false)
    assert.equal(fitment.fallbackReason, 'registry_blocked')
    assert.equal(fitment.matchedModel, 'Toyota Corolla')
    assert.ok(fitment.approvedSizes.length > 0)
  })

  it('raises tire_specs_unavailable when no reference row matches either', () => {
    assert.throws(
      () =>
        buildFitment({
          plate: '1234567',
          vehicleRecord: { ...vehicleRecord, tozeret_nm: 'יצרן דמיוני', kinuy_mishari: 'NOSUCHMODEL' },
          modelRecords: [],
        }),
      { code: 'tire_specs_unavailable', status: 422 },
    )
  })
})

describe('fallbackService', () => {
  it('covers block, throttle and outage, but not a missing plate', () => {
    assert.equal(shouldFallBack({ code: 'registry_blocked' }), true)
    assert.equal(shouldFallBack({ code: 'registry_rate_limited' }), true)
    assert.equal(shouldFallBack({ code: 'registry_unavailable' }), true)
    assert.equal(shouldFallBack({ code: 'plate_not_found' }), false)
    assert.equal(shouldFallBack(undefined), false)
  })

  it('resolves a vehicle by Hebrew registry spelling', () => {
    const result = fallbackFitmentForVehicle(
      { make: 'יונדאי קוריאה', model: 'טוסון', year: 2022 },
      { reason: 'registry_blocked' },
    )
    assert.equal(result.matchedModel, 'Hyundai Tucson')
    assert.equal(result.verified, false)
  })

  it('parses reference sizes into the same shape as registry data', () => {
    const result = fallbackFitmentForVehicle({ make: 'Mazda', model: '3', year: 2020 }, { reason: 'x' })
    assert.deepEqual(result.approvedSizes[0], {
      size: '205/60R16',
      width: 205,
      aspectRatio: 60,
      rimDiameter: 16,
      position: 'all',
      isOem: true,
    })
  })

  it('keeps a staggered reference split by axle', () => {
    const result = fallbackFitmentForVehicle({ make: 'Porsche', model: '911' }, { reason: 'x' })
    assert.deepEqual(result.approvedSizes.map((entry) => entry.position), ['front', 'rear'])
  })

  it('returns null rather than guessing for an unknown vehicle', () => {
    assert.equal(fallbackFitmentForVehicle({ make: 'Nonexistent', model: 'Nothing' }, { reason: 'x' }), null)
  })

  it('refuses to answer without a make or model', () => {
    assert.equal(fallbackFitmentForVehicle({ year: 2020 }, { reason: 'x' }), null)
  })
})

describe('getVehicleTireSpecs (aggregation over a stubbed registry)', () => {
  const realFetch = globalThis.fetch
  let calls = []

  /** Reply per CKAN resource id, so a test can assert which datasets were hit. */
  function stubRegistry(byResource) {
    globalThis.fetch = async (url) => {
      const resourceId = new URL(url).searchParams.get('resource_id')
      const filters = JSON.parse(new URL(url).searchParams.get('filters') ?? '{}')
      calls.push({ resourceId, filters })
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, result: { records: byResource[resourceId] ?? [] } }),
      }
    }
  }

  const VEHICLES = '053cea08-09bc-40ec-8f7a-156f0677aff3'
  const MODELS = '142afde2-6228-49f9-8a29-9b6c3a0cbe40'

  beforeEach(() => {
    calls = []
    __clearCaches()
    __resetBreaker()
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('skips the model lookup when the vehicle row already has sizes', async () => {
    stubRegistry({
      [VEHICLES]: [
        {
          mispar_rechev: 1234567,
          tozeret_nm: 'מאזדה יפן',
          kinuy_mishari: 'MAZDA 3',
          shnat_yitzur: 2020,
          zmig_kidmi: '205/60R16',
          zmig_ahori: '205/60R16',
        },
      ],
    })

    const specs = await getVehicleTireSpecs('12-345-67')

    assert.equal(calls.length, 1, 'should not call the models dataset')
    assert.equal(specs.vehicle.model, 'MAZDA 3')
    assert.deepEqual(specs.approvedSizes.map((entry) => entry.size), ['205/60R16'])
  })

  it('strips the country-of-origin suffix from the manufacturer name', async () => {
    // Spellings taken verbatim from live registry rows.
    const cases = [
      ['שברולט ד.קוריא', 'שברולט'],
      ['יונדאי קוריאה', 'יונדאי'],
      ['מאזדה יפן', 'מאזדה'],
      ['סקודה צכיה', 'סקודה'],
      ['קרייזלר', 'קרייזלר'],
    ]

    for (const [raw, expected] of cases) {
      __clearCaches()
      stubRegistry({
        [VEHICLES]: [
          {
            mispar_rechev: 1234567,
            tozeret_nm: raw,
            kinuy_mishari: 'SPARK',
            shnat_yitzur: 2015,
            zmig_kidmi: '165/65R14',
          },
        ],
      })

      const specs = await getVehicleTireSpecs('1234567')
      assert.equal(specs.vehicle.make, expected, `${raw} -> ${expected}`)
    }
  })

  it('keeps the manufacturer name when it is nothing but a country', async () => {
    stubRegistry({
      [VEHICLES]: [
        {
          mispar_rechev: 1234567,
          tozeret_nm: 'יפן',
          kinuy_mishari: 'SOMETHING',
          shnat_yitzur: 2015,
          zmig_kidmi: '165/65R14',
        },
      ],
    })

    const specs = await getVehicleTireSpecs('1234567')
    assert.equal(specs.vehicle.make, 'יפן')
  })

  it('falls through to the model dataset keyed on manufacturer AND model code', async () => {
    stubRegistry({
      [VEHICLES]: [
        {
          mispar_rechev: 1234567,
          tozeret_cd: 297,
          degem_cd: 415,
          tozeret_nm: 'סקודה צכיה',
          kinuy_mishari: 'OCTAVIA',
          shnat_yitzur: 2022,
        },
      ],
      [MODELS]: [{ shnat_yitzur: 2022, zmig_kidmi: '205/55R16', zmig_ahori: '205/55R16' }],
    })

    const specs = await getVehicleTireSpecs('1234567')

    assert.equal(calls.length, 2)
    assert.deepEqual(
      calls[1].filters,
      { tozeret_cd: 297, degem_cd: 415 },
      'model lookup must filter on both codes or it can match another manufacturer',
    )
    assert.deepEqual(specs.approvedSizes.map((entry) => entry.size), ['205/55R16'])
  })

  it('serves the second request for a plate from cache', async () => {
    stubRegistry({
      [VEHICLES]: [
        { mispar_rechev: 1234567, kinuy_mishari: 'YARIS', shnat_yitzur: 2019, zmig_kidmi: '185/60R15' },
      ],
    })

    const first = await getVehicleTireSpecs('1234567')
    const second = await getVehicleTireSpecs('1234567')

    assert.equal(first.cached, false)
    assert.equal(second.cached, true)
    assert.equal(calls.length, 1, 'the registry should be hit once')
  })

  it('coalesces concurrent lookups of the same plate into one call', async () => {
    stubRegistry({
      [VEHICLES]: [
        { mispar_rechev: 1234567, kinuy_mishari: 'CIVIC', shnat_yitzur: 2018, zmig_kidmi: '215/50R17' },
      ],
    })

    const [a, b, c] = await Promise.all([
      getVehicleTireSpecs('1234567'),
      getVehicleTireSpecs('1234567'),
      getVehicleTireSpecs('1234567'),
    ])

    assert.equal(calls.length, 1)
    assert.deepEqual(a.approvedSizes, b.approvedSizes)
    assert.deepEqual(b.approvedSizes, c.approvedSizes)
  })

  it('reads through a persistent store before touching the registry', async () => {
    stubRegistry({ [VEHICLES]: [] })
    const store = {
      read: async () => ({
        licensePlate: '1234567',
        vehicle: { make: 'קיה', model: 'SPORTAGE', year: 2021 },
        approvedSizes: [{ position: 'all', size: '235/60R18', width: 235, aspectRatio: 60, rimDiameter: 18, isOem: true }],
        source: 'ministry_of_transport',
      }),
      write: async () => {},
    }

    const specs = await getVehicleTireSpecs('1234567', { store })

    assert.equal(calls.length, 0)
    assert.equal(specs.cached, true)
    assert.equal(specs.vehicle.model, 'SPORTAGE')
  })

  it('writes a resolved lookup back to the store with a TTL', async () => {
    stubRegistry({
      [VEHICLES]: [
        { mispar_rechev: 1234567, kinuy_mishari: 'PICANTO', shnat_yitzur: 2020, zmig_kidmi: '175/65R14' },
      ],
    })
    const written = []
    const store = { read: async () => null, write: async (doc) => void written.push(doc) }

    await getVehicleTireSpecs('1234567', { store })

    assert.equal(written.length, 1)
    assert.ok(written[0].ttlExpiresAt instanceof Date)
    assert.ok(written[0].ttlExpiresAt > new Date())
  })

  it('still answers when the cache write fails', async () => {
    stubRegistry({
      [VEHICLES]: [
        { mispar_rechev: 1234567, kinuy_mishari: 'IONIQ', shnat_yitzur: 2023, zmig_kidmi: '225/45R17' },
      ],
    })
    const store = {
      read: async () => null,
      write: async () => {
        throw new Error('mongo down')
      },
    }

    const specs = await getVehicleTireSpecs('1234567', { store })
    assert.deepEqual(specs.approvedSizes.map((entry) => entry.size), ['225/45R17'])
  })

  it('reports an unknown plate as 404, not as a server fault', async () => {
    stubRegistry({ [VEHICLES]: [] })
    await assert.rejects(getVehicleTireSpecs('7654321'), {
      code: 'plate_not_found',
      status: 404,
    })
  })

  it('distinguishes a found vehicle with no tire data from an unknown plate', async () => {
    stubRegistry({
      [VEHICLES]: [{ mispar_rechev: 1234567, kinuy_mishari: 'LEAF', shnat_yitzur: 2016 }],
      [MODELS]: [],
    })
    await assert.rejects(getVehicleTireSpecs('1234567'), {
      code: 'tire_specs_unavailable',
      status: 422,
    })
  })

  it('surfaces a registry outage as 503', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 502, json: async () => ({}) })
    await assert.rejects(getVehicleTireSpecs('1234567'), {
      code: 'registry_unavailable',
      status: 503,
    })
  })

  it('treats a CKAN body-level failure as an outage despite HTTP 200', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: false, error: { message: 'Resource not found' } }),
    })
    await assert.rejects(getVehicleTireSpecs('1234567'), {
      code: 'registry_unavailable',
      status: 503,
    })
  })

  it('rejects a malformed plate before any network call', async () => {
    stubRegistry({ [VEHICLES]: [] })
    await assert.rejects(getVehicleTireSpecs('12'), { code: 'invalid_plate', status: 422 })
    assert.equal(calls.length, 0)
  })
})
