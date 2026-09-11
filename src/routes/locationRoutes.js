const express = require("express");

const router =
  express.Router();

const {
  saveLocation,
  getCurrentLocation,
  getLocations,
  getLocationById,
  deleteLocation,
} = require(
  "../controllers/locationController"
);

const {
  verifyToken,
} = require(
  "../middleware/authMiddleware"
);

// ==========================================================
// SAVE CURRENT LOCATION
// POST /api/locations
// ==========================================================

router.post(
  "/create",
  verifyToken,
  saveLocation
);

// ==========================================================
// GET CURRENT LOCATION
// GET /api/locations/current
// ==========================================================

router.get(
  "/current",
  verifyToken,
  getCurrentLocation
);

// ==========================================================
// GET ALL LOCATIONS
// GET /api/locations
// ==========================================================

router.get(
  "/all",
  verifyToken,
  getLocations
);

// ==========================================================
// GET LOCATION BY ID
// GET /api/locations/:id
// ==========================================================

router.get(
  "/:id",
  verifyToken,
  getLocationById
);

// ==========================================================
// DELETE LOCATION
// DELETE /api/locations/:id
// ==========================================================

router.delete(
  "/delete/:id",
  verifyToken,
  deleteLocation
);

module.exports = router;