const express = require("express");

const router = express.Router();

const {
  createCustomer,
  searchCustomers,
  getCustomers,
  getCustomerById,
  getCustomerByPhone,
  updateCustomer,
  deleteCustomer,
} = require("../controllers/customerController");

// =========================================================
// CREATE CUSTOMER
// POST /api/customers
// =========================================================

router.post("/create", createCustomer);

// =========================================================
// SEARCH CUSTOMER
// GET /api/customers/search?search=Arun
// =========================================================

router.get("/search", searchCustomers);

// =========================================================
// GET CUSTOMER BY PHONE
// GET /api/customers/phone/9876543210
// =========================================================

router.get("/phone/:phone", getCustomerByPhone);

// =========================================================
// GET ALL CUSTOMERS
// GET /api/customers
// =========================================================

router.get("/all", getCustomers);

// =========================================================
// GET CUSTOMER BY ID
// GET /api/customers/:id
// =========================================================

router.get("/:id", getCustomerById);

// =========================================================
// UPDATE CUSTOMER
// PUT /api/customers/:id
// =========================================================

router.put("/update/:id", updateCustomer);

// =========================================================
// DEACTIVATE CUSTOMER
// DELETE /api/customers/:id
// =========================================================

router.delete("/delete/:id", deleteCustomer);

module.exports = router;