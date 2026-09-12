
const express = require("express");

const router = express.Router();

// ==========================================================
// AUTH MIDDLEWARE
// ==========================================================

const { verifyToken } = require("../middleware/authMiddleware");

// ==========================================================
// ADDRESS CONTROLLER
// ==========================================================

const {
  createAddress,
  getAllAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getDefaultAddress,
} = require("../controllers/addressController");

// ==========================================================
// CREATE ADDRESS
// POST /api/address/create
// ==========================================================

router.post(
  "/create",
  verifyToken,
  createAddress
);

// ==========================================================
// GET ALL ADDRESSES
// GET /api/address/all
// ==========================================================

router.get(
  "/all",
  verifyToken,
  getAllAddresses
);

// ==========================================================
// GET DEFAULT ADDRESS
// GET /api/address/default
// ==========================================================

router.get(
  "/default",
  verifyToken,
  getDefaultAddress
);

// ==========================================================
// SET DEFAULT ADDRESS
// PUT /api/address/default/:addressId
// ==========================================================

router.put(
  "/default/:addressId",
  verifyToken,
  setDefaultAddress
);

// ==========================================================
// UPDATE ADDRESS
// PUT /api/address/update/:addressId
// ==========================================================

router.put(
  "/update/:addressId",
  verifyToken,
  updateAddress
);

// ==========================================================
// DELETE ADDRESS
// DELETE /api/address/delete/:addressId
// ==========================================================

router.delete(
  "/delete/:addressId",
  verifyToken,
  deleteAddress
);


// ==========================================================
// GET SINGLE ADDRESS
// GET /api/address/:addressId
// ==========================================================


router.get(
  "/:addressId",
  verifyToken,
  getAddressById
);

// ==========================================================
// EXPORT ROUTER
// ==========================================================

module.exports = router;

