const express = require("express");

const router =
  express.Router();

// ==========================================================
// CONTROLLER
// ==========================================================

const {
  createNewArrival,
  getAllNewArrivals,
  getNewArrivalById,
  updateNewArrival,
  deleteNewArrival,
} = require("../controllers/newArrivalController");

// ==========================================================
// MULTER
// ==========================================================

const {
  uploadNewArrivalImage,
  handleUploadError,
} = require("../middleware/uploadMiddleware");

// ==========================================================
// CREATE NEW ARRIVAL
// ==========================================================
//
// POST
// /api/new-arrivals/create
//
// Files:
// productImages -> maximum 4
//
// ==========================================================

router.post(
  "/create",

  uploadNewArrivalImage.array(
    "productImages",
    4
  ),

  handleUploadError,

  createNewArrival
);

// ==========================================================
// GET ALL NEW ARRIVALS
// ==========================================================
//
// GET
// /api/new-arrivals
//
// ==========================================================

router.get(
  "/all",
  getAllNewArrivals
);

// ==========================================================
// GET NEW ARRIVAL BY ID
// ==========================================================
//
// GET
// /api/new-arrivals/:id
//
// ==========================================================

router.get(
  "/:id",
  getNewArrivalById
);

// ==========================================================
// UPDATE NEW ARRIVAL
// ==========================================================
//
// PUT
// /api/new-arrivals/:id
//
// Files:
// productImages -> maximum 4
//
// ==========================================================

router.put(
  "/update/:id",

  uploadNewArrivalImage.array(
    "productImages",
    4
  ),

  handleUploadError,

  updateNewArrival
);

// ==========================================================
// DELETE NEW ARRIVAL
// ==========================================================
//
// DELETE
// /api/new-arrivals/:id
//
// ==========================================================

router.delete(
  "/delete/:id",
  deleteNewArrival
);

// ==========================================================
// EXPORT
// ==========================================================

module.exports = router;