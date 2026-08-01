import { config } from '../config.js'

/**
 * Persistent cache adapter for `getVehicleTireSpecs`.
 *
 * Implements the `{ read, write }` shape the service expects. Keeping it in its
 * own module is what lets `vehicleService` be imported and tested without a
 * database — and what would let this be swapped for Redis without the
 * aggregation logic noticing.
 *
 * The Mongoose model is pulled in through a dynamic import rather than a
 * top-level one. `mongoose` is not currently a dependency of this service, and
 * a static import would make merely *loading* this module — which the router
 * does on every boot — crash the process on a deployment that never asked for a
 * database. Off by default, and a failure to load degrades to "no persistent
 * layer" instead of to an outage.
 */

let modelPromise = null

async function getModel() {
  if (!config.persistence.enabled) return null

  modelPromise ??= import('../models.js')
    .then((module) => module.VehicleTireSpecs)
    .catch((error) => {
      process.stderr.write(
        `${JSON.stringify({
          event: 'store.unavailable',
          message: 'ENABLE_MONGO_CACHE is set but the model could not be loaded',
          error: error.message,
        })}\n`,
      )
      return null
    })

  return modelPromise
}

export const vehicleSpecsStore = {
  /**
   * Documents expire via the collection's TTL index, but MongoDB's reaper only
   * runs about once a minute, so an expired document can still be returned.
   * The explicit date filter closes that window.
   */
  async read(licensePlate) {
    const VehicleTireSpecs = await getModel()
    if (!VehicleTireSpecs) return null

    const doc = await VehicleTireSpecs.findOne({
      licensePlate,
      ttlExpiresAt: { $gt: new Date() },
    }).lean()

    if (!doc) return null

    return {
      licensePlate: doc.licensePlate,
      vehicle: doc.vehicle,
      approvedSizes: doc.approvedSizes,
      /**
       * Carried through explicitly. This object is rebuilt field by field
       * rather than spread, so anything added to the payload and forgotten here
       * silently disappears the moment a lookup is served from cache — which is
       * most of them, and only after the feature already looked like it worked.
       */
      tirePressure: doc.tirePressure ?? null,
      verified: doc.verified ?? true,
      source: doc.source,
      fetchedAt: doc.fetchedAt?.toISOString() ?? new Date().toISOString(),
    }
  },

  /** Upsert: this collection holds one row per vehicle, refreshed in place. */
  async write({ licensePlate, vehicle, approvedSizes, tirePressure, verified, source, ttlExpiresAt }) {
    const VehicleTireSpecs = await getModel()
    if (!VehicleTireSpecs) return

    await VehicleTireSpecs.updateOne(
      { licensePlate },
      {
        $set: {
          vehicle,
          approvedSizes,
          tirePressure,
          verified,
          source,
          fetchedAt: new Date(),
          ttlExpiresAt,
        },
      },
      { upsert: true },
    )
  },
}
