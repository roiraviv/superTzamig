import { VehicleTireSpecs } from '../models.js'

/**
 * Persistent cache adapter for `getVehicleTireSpecs`.
 *
 * Implements the `{ read, write }` shape the service expects. Keeping it in its
 * own module is what lets `vehicleService` be imported and tested without a
 * database — and what would let this be swapped for Redis without the
 * aggregation logic noticing.
 */
export const vehicleSpecsStore = {
  /**
   * Documents expire via the collection's TTL index, but MongoDB's reaper only
   * runs about once a minute, so an expired document can still be returned.
   * The explicit date filter closes that window.
   */
  async read(licensePlate) {
    const doc = await VehicleTireSpecs.findOne({
      licensePlate,
      ttlExpiresAt: { $gt: new Date() },
    }).lean()

    if (!doc) return null

    return {
      licensePlate: doc.licensePlate,
      vehicle: doc.vehicle,
      approvedSizes: doc.approvedSizes,
      source: doc.source,
      fetchedAt: doc.fetchedAt?.toISOString() ?? new Date().toISOString(),
    }
  },

  /** Upsert: this collection holds one row per vehicle, refreshed in place. */
  async write({ licensePlate, vehicle, approvedSizes, source, ttlExpiresAt }) {
    await VehicleTireSpecs.updateOne(
      { licensePlate },
      {
        $set: {
          vehicle,
          approvedSizes,
          source,
          fetchedAt: new Date(),
          ttlExpiresAt,
        },
      },
      { upsert: true },
    )
  },
}
