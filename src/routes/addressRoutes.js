const express = require("express");

const router =
  express.Router();

const {
  createAddress,
  getAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} = require(
  "../controllers/addressController"
);

const {
  verifyToken,
} = require(
  "../middleware/authMiddleware"
);

// ==========================================================
// CREATE ADDRESS
// POST /api/addresses
// ==========================================================

router.post(
  "/create",
  verifyToken,
  createAddress
);

// ==========================================================
// GET ALL ADDRESSES
// GET /api/addresses
// ==========================================================

router.get(
  "/all",
  verifyToken,
  getAddresses
);

// ==========================================================
// GET ADDRESS BY ID
// GET /api/addresses/:id
// ==========================================================

router.get(
  "/:id",
  verifyToken,
  getAddressById
);

// ==========================================================
// UPDATE ADDRESS
// PUT /api/addresses/:id
// ==========================================================

router.put(
  "/update/:id",
  verifyToken,
  updateAddress
);

// ==========================================================
// DELETE ADDRESS
// DELETE /api/addresses/:id
// ==========================================================

router.delete(
  "/delete/:id",
  verifyToken,
  deleteAddress
);


router.patch(
  "/:id/default",
  verifyToken,
  setDefaultAddress
);

module.exports = router;