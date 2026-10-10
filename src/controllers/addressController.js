const mongoose = require("mongoose");
const Address = require("../models/addressModel");
const User = require("../models/userModel");

// ============================================================
// HELPERS
// ============================================================

const getUserId = (req) => {
  return req.user?.id || req.user?._id || req.user?.userId;
};

// ============================================================
// CREATE ADDRESS
// ============================================================

// const createAddress = async (req, res) => {
//   try {
//     const userId = getUserId(req);

//     if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid or missing user ID.",
//       });
//     }

//     // Map properties with fallbacks for both frontend key standards
//     const fullNameInput =
//       req.body.fullName || req.body.name || req.body.nameCustomer;
//     const mobileNumberInput =
//       req.body.mobileNumber || req.body.phone || req.body.phoneNumber;
//     const houseNoInput =
//       req.body.houseNo ||
//       req.body.addressLine1 ||
//       req.body.address ||
//       req.body.street;
//     const streetInput = req.body.street || req.body.addressLine2 || "";
//     const cityInput = req.body.city;
//     const stateInput = req.body.state;
//     const pincodeInput =
//       req.body.pincode || req.body.zipCode || req.body.postalCode;

//     // Fallback to logged-in user details if name/mobile are missing
//     const user = await User.findById(userId);
//     const finalFullName = fullNameInput || user?.name || "Customer";
//     const finalMobile = mobileNumberInput || user?.mobileNumber;

//     // Validate required fields
//     if (
//       !finalFullName ||
//       !finalMobile ||
//       !houseNoInput ||
//       !cityInput ||
//       !stateInput ||
//       !pincodeInput
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "fullName, mobileNumber, houseNo (or addressLine1), city, state, and pincode are required.",
//       });
//     }

//     const existingAddresses = await Address.find({
//       user: userId,
//       isActive: true,
//     });
//     let makeDefault = Boolean(req.body.isDefault);

//     if (existingAddresses.length === 0) {
//       makeDefault = true;
//     }

//     if (makeDefault) {
//       await Address.updateMany(
//         { user: userId },
//         { $set: { isDefault: false } }
//       );
//     }

//     const address = await Address.create({
//       user: userId,
//       addressType: req.body.addressType || "Home",
//       fullName: finalFullName,
//       mobileNumber: finalMobile,
//       alternateMobileNumber: req.body.alternateMobileNumber || "",
//       houseNo: houseNoInput,
//       street: streetInput,
//       area: req.body.area || "",
//       landmark: req.body.landmark || "",
//       city: cityInput,
//       district: req.body.district || cityInput || "",
//       state: stateInput,
//       country: req.body.country || "India",
//       pincode: pincodeInput,
//       latitude: req.body.latitude ? Number(req.body.latitude) : null,
//       longitude: req.body.longitude ? Number(req.body.longitude) : null,
//       placeId: req.body.placeId || "",
//       isDefault: makeDefault,
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Address created successfully.",
//       address,
//     });
//   } catch (error) {
//     console.error("CREATE ADDRESS ERROR:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to create address.",
//       error: error.message,
//     });
//   }
// };

const createAddress = async (req, res) => {
  try {
    // ==========================================
    // IDENTIFY USER OR GUEST
    // ==========================================
    const userId = getUserId(req);
    const guestId = !userId
      ? String(req.body.guestId || "").trim()
      : null;

    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (!userId && !guestId) {
      return res.status(400).json({
        success: false,
        message: "Guest ID is required for guest checkout.",
      });
    }

    // ==========================================
    // MAP FRONTEND FIELDS
    // ==========================================
    const fullNameInput =
      req.body.fullName ||
      req.body.name ||
      req.body.nameCustomer;

    const mobileNumberInput =
      req.body.mobileNumber ||
      req.body.phone ||
      req.body.phoneNumber;

    const houseNoInput =
      req.body.houseNo ||
      req.body.addressLine1 ||
      req.body.address ||
      req.body.street;

    const streetInput =
      req.body.addressLine2 ||
      req.body.street ||
      "";

    const cityInput = req.body.city;
    const stateInput = req.body.state;

    const pincodeInput =
      req.body.pincode ||
      req.body.zipCode ||
      req.body.postalCode;

    // ==========================================
    // USER DETAILS (LOGGED-IN USERS ONLY)
    // ==========================================
    let user = null;

    if (userId) {
      user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }
    }

    const finalFullName =
      fullNameInput || user?.name || "Customer";

    const finalMobile =
      mobileNumberInput || user?.mobileNumber;

    // ==========================================
    // VALIDATE REQUIRED FIELDS
    // ==========================================
    if (
      !finalFullName ||
      !finalMobile ||
      !houseNoInput ||
      !cityInput ||
      !stateInput ||
      !pincodeInput
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Full name, mobile number, house number, city, state, and pincode are required.",
      });
    }

    // ==========================================
    // ADDRESS OWNER FILTER
    // ==========================================
    const ownerFilter = userId
      ? { user: userId }
      : { guestId };

    const existingAddresses = await Address.find({
      ...ownerFilter,
      isActive: true,
    });

    let makeDefault = req.body.isDefault === true ||
      req.body.isDefault === "true";

    // First active address becomes default
    if (existingAddresses.length === 0) {
      makeDefault = true;
    }

    // ==========================================
    // UPDATE DEFAULT ADDRESS
    // Only affect this user's or guest's addresses
    // ==========================================
    if (makeDefault) {
      await Address.updateMany(
        ownerFilter,
        { $set: { isDefault: false } }
      );
    }

    // ==========================================
    // CREATE ADDRESS IN MONGODB
    // ==========================================
    const address = await Address.create({
      user: userId || null,
      guestId: userId ? null : guestId,

      addressType: req.body.addressType || "Home",
      fullName: finalFullName,
      mobileNumber: finalMobile,
      alternateMobileNumber:
        req.body.alternateMobileNumber || "",

      houseNo: houseNoInput,
      street: streetInput,
      area: req.body.area || "",
      landmark: req.body.landmark || "",

      city: cityInput,
      district: req.body.district || cityInput,
      state: stateInput,
      country: req.body.country || "India",
      pincode: String(pincodeInput).trim(),

      latitude:
        req.body.latitude != null &&
        req.body.latitude !== ""
          ? Number(req.body.latitude)
          : null,

      longitude:
        req.body.longitude != null &&
        req.body.longitude !== ""
          ? Number(req.body.longitude)
          : null,

      placeId: req.body.placeId || "",
      isDefault: makeDefault,
    });

    // ==========================================
    // RESPONSE
    // ==========================================
    return res.status(201).json({
      success: true,
      message: "Address created successfully.",
      address,
    });
  } catch (error) {
    console.error("CREATE ADDRESS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create address.",
      error: error.message,
    });
  }
};

// ============================================================
// GET ALL ADDRESSES
// ============================================================

const getAllAddresses = async (req, res) => {
  try {
    const userId = getUserId(req);

    const addresses = await Address.find({
      user: userId,
      isActive: true,
    }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      message: "Addresses fetched successfully.",
      count: addresses.length,
      addresses,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch addresses.",
      error: error.message,
    });
  }
};

// ============================================================
// GET SINGLE ADDRESS BY ID
// ============================================================

const getAddressById = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { addressId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid address ID." });
    }

    const address = await Address.findOne({
      _id: addressId,
      user: userId,
      isActive: true,
    });

    if (!address) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Address fetched successfully.",
      address,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch address.",
      error: error.message,
    });
  }
};

// ============================================================
// UPDATE ADDRESS
// ============================================================

const updateAddress = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { addressId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid address ID." });
    }

    const address = await Address.findOne({
      _id: addressId,
      user: userId,
      isActive: true,
    });

    if (!address) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found." });
    }

    const fullNameInput = req.body.fullName || req.body.name;
    const mobileNumberInput = req.body.mobileNumber || req.body.phone;
    const houseNoInput =
      req.body.houseNo || req.body.addressLine1 || req.body.address;
    const streetInput = req.body.street || req.body.addressLine2;
    const pincodeInput = req.body.pincode || req.body.zipCode;

    if (req.body.addressType !== undefined)
      address.addressType = req.body.addressType;
    if (fullNameInput !== undefined) address.fullName = fullNameInput;
    if (mobileNumberInput !== undefined)
      address.mobileNumber = mobileNumberInput;
    if (req.body.alternateMobileNumber !== undefined)
      address.alternateMobileNumber = req.body.alternateMobileNumber;
    if (houseNoInput !== undefined) address.houseNo = houseNoInput;
    if (streetInput !== undefined) address.street = streetInput;
    if (req.body.area !== undefined) address.area = req.body.area;
    if (req.body.landmark !== undefined) address.landmark = req.body.landmark;
    if (req.body.city !== undefined) address.city = req.body.city;
    if (req.body.district !== undefined) address.district = req.body.district;
    if (req.body.state !== undefined) address.state = req.body.state;
    if (req.body.country !== undefined) address.country = req.body.country;
    if (pincodeInput !== undefined) address.pincode = pincodeInput;
    if (req.body.latitude !== undefined)
      address.latitude = req.body.latitude
        ? Number(req.body.latitude)
        : null;
    if (req.body.longitude !== undefined)
      address.longitude = req.body.longitude
        ? Number(req.body.longitude)
        : null;
    if (req.body.placeId !== undefined) address.placeId = req.body.placeId;

    if (req.body.isDefault === true) {
      await Address.updateMany(
        { user: userId, _id: { $ne: addressId } },
        { $set: { isDefault: false } }
      );
      address.isDefault = true;
    }

    await address.save();

    return res.status(200).json({
      success: true,
      message: "Address updated successfully.",
      address,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update address.",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE ADDRESS
// ============================================================

const deleteAddress = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { addressId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid address ID." });
    }

    const address = await Address.findOne({
      _id: addressId,
      user: userId,
      isActive: true,
    });

    if (!address) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found." });
    }

    const wasDefault = address.isDefault;

    address.isActive = false;
    await address.save();

    if (wasDefault) {
      const nextAddress = await Address.findOne({
        user: userId,
        isActive: true,
      }).sort({ createdAt: -1 });

      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete address.",
      error: error.message,
    });
  }
};

// ============================================================
// SET DEFAULT ADDRESS
// ============================================================

const setDefaultAddress = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { addressId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid address ID." });
    }

    const address = await Address.findOne({
      _id: addressId,
      user: userId,
      isActive: true,
    });

    if (!address) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found." });
    }

    await Address.updateMany({ user: userId }, { $set: { isDefault: false } });

    address.isDefault = true;
    await address.save();

    return res.status(200).json({
      success: true,
      message: "Default address updated successfully.",
      address,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to set default address.",
      error: error.message,
    });
  }
};

// ============================================================
// GET DEFAULT ADDRESS
// ============================================================

const getDefaultAddress = async (req, res) => {
  try {
    const userId = getUserId(req);

    const address = await Address.findOne({
      user: userId,
      isDefault: true,
      isActive: true,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Default address not found.",
        address: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Default address fetched successfully.",
      address,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch default address.",
      error: error.message,
    });
  }
};

module.exports = {
  createAddress,
  getAllAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getDefaultAddress,
};