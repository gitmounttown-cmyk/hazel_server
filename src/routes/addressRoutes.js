const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/authMiddleware");
const {
  createAddress,
  getAllAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getDefaultAddress,
} = require("../controllers/addressController");

router.post("/create", verifyToken, createAddress);
router.get("/all", verifyToken, getAllAddresses);
router.get("/default", verifyToken, getDefaultAddress);
router.put("/default/:addressId", verifyToken, setDefaultAddress);
router.put("/update/:addressId", verifyToken, updateAddress);
router.delete("/delete/:addressId", verifyToken, deleteAddress);
router.get("/:addressId", verifyToken, getAddressById);

module.exports = router;