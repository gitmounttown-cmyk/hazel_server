
const mongoose = require("mongoose");
const Address = require("../models/addressModel");

// ==========================================================
// CREATE ADDRESS
// POST /api/address/create
// ==========================================================
const createAddress = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      addressType,
      fullName,
      mobileNumber,
      alternateMobileNumber,
      houseNo,
      street,
      area,
      landmark,
      city,
      district,
      state,
      country,
      pincode,
      latitude,
      longitude,
      placeId,
      isDefault,
    } = req.body;

    // ======================================================
    // VALIDATE USER ID
    // ======================================================

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // ======================================================
    // REQUIRED FIELDS
    // ======================================================

    if (
      !fullName ||
      !mobileNumber ||
      !houseNo ||
      !city ||
      !state ||
      !pincode
    ) {
      return res.status(400).json({
        success: false,
        message:
          "fullName, mobileNumber, houseNo, city, state and pincode are required",
      });
    }

    // ======================================================
    // CHECK EXISTING ADDRESSES
    // ======================================================

    const existingAddresses = await Address.find({
      user: userId,
    });

    // ======================================================
    // FIRST ADDRESS AUTOMATICALLY BECOMES DEFAULT
    // ======================================================

    let makeDefault = Boolean(isDefault);

    if (existingAddresses.length === 0) {
      makeDefault = true;
    }

    // ======================================================
    // IF NEW ADDRESS IS DEFAULT
    // REMOVE DEFAULT FROM OLD ADDRESSES
    // ======================================================

    if (makeDefault) {
      await Address.updateMany(
        {
          user: userId,
        },
        {
          $set: {
            isDefault: false,
          },
        }
      );
    }

    // ======================================================
    // CREATE ADDRESS
    // ======================================================

    const address = await Address.create({
      user: userId,

      addressType: addressType || "home",

      fullName,
      mobileNumber,
      alternateMobileNumber: alternateMobileNumber || "",

      houseNo,
      street: street || "",
      area: area || "",
      landmark: landmark || "",

      city,
      district: district || "",

      state,
      country: country || "India",

      pincode,

      latitude:
        latitude !== undefined &&
        latitude !== null &&
        latitude !== ""
          ? Number(latitude)
          : null,

      longitude:
        longitude !== undefined &&
        longitude !== null &&
        longitude !== ""
          ? Number(longitude)
          : null,

      placeId: placeId || "",

      isDefault: makeDefault,
    });

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(201).json({
      success: true,
      message: "Address created successfully",
      address,
    });
  } catch (error) {
    console.error("CREATE ADDRESS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create address",
      error: error.message,
    });
  }
};

// ==========================================================
// GET ALL ADDRESSES
// GET /api/address/all
// ==========================================================
const getAllAddresses = async (req, res) => {
  try {
    const userId = req.user.id;

    // ======================================================
    // GET USER ADDRESSES
    // ======================================================

    const addresses = await Address.find({
      user: userId,
    }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(200).json({
      success: true,
      message: "Addresses fetched successfully",
      count: addresses.length,
      addresses,
    });
  } catch (error) {
    console.error("GET ALL ADDRESSES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
      error: error.message,
    });
  }
};

// ==========================================================
// GET SINGLE ADDRESS
// GET /api/address/:addressId
// ==========================================================
const getAddressById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    // ======================================================
    // VALIDATE ADDRESS ID
    // ======================================================

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    // ======================================================
    // FIND ADDRESS
    // ======================================================

    const address = await Address.findOne({
      _id: addressId,
      user: userId,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(200).json({
      success: true,
      message: "Address fetched successfully",
      address,
    });
  } catch (error) {
    console.error("GET ADDRESS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch address",
      error: error.message,
    });
  }
};

// ==========================================================
// UPDATE ADDRESS
// PUT /api/address/update/:addressId
// ==========================================================
const updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    // ======================================================
    // VALIDATE ADDRESS ID
    // ======================================================

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    // ======================================================
    // FIND ADDRESS
    // ======================================================

    const address = await Address.findOne({
      _id: addressId,
      user: userId,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // ======================================================
    // GET BODY DATA
    // ======================================================

    const {
      addressType,
      fullName,
      mobileNumber,
      alternateMobileNumber,
      houseNo,
      street,
      area,
      landmark,
      city,
      district,
      state,
      country,
      pincode,
      latitude,
      longitude,
      placeId,
      isDefault,
    } = req.body;

    // ======================================================
    // UPDATE FIELDS
    // ======================================================

    if (addressType !== undefined) {
      address.addressType = addressType;
    }

    if (fullName !== undefined) {
      address.fullName = fullName;
    }

    if (mobileNumber !== undefined) {
      address.mobileNumber = mobileNumber;
    }

    if (alternateMobileNumber !== undefined) {
      address.alternateMobileNumber = alternateMobileNumber;
    }

    if (houseNo !== undefined) {
      address.houseNo = houseNo;
    }

    if (street !== undefined) {
      address.street = street;
    }

    if (area !== undefined) {
      address.area = area;
    }

    if (landmark !== undefined) {
      address.landmark = landmark;
    }

    if (city !== undefined) {
      address.city = city;
    }

    if (district !== undefined) {
      address.district = district;
    }

    if (state !== undefined) {
      address.state = state;
    }

    if (country !== undefined) {
      address.country = country;
    }

    if (pincode !== undefined) {
      address.pincode = pincode;
    }

    if (latitude !== undefined) {
      address.latitude =
        latitude === null || latitude === ""
          ? null
          : Number(latitude);
    }

    if (longitude !== undefined) {
      address.longitude =
        longitude === null || longitude === ""
          ? null
          : Number(longitude);
    }

    if (placeId !== undefined) {
      address.placeId = placeId;
    }

    // ======================================================
    // SET DEFAULT ADDRESS
    // ======================================================

    if (isDefault === true) {
      await Address.updateMany(
        {
          user: userId,
          _id: { $ne: addressId },
        },
        {
          $set: {
            isDefault: false,
          },
        }
      );

      address.isDefault = true;
    }

    // ======================================================
    // SAVE
    // ======================================================

    await address.save();

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      address,
    });
  } catch (error) {
    console.error("UPDATE ADDRESS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update address",
      error: error.message,
    });
  }
};

// ==========================================================
// DELETE ADDRESS
// DELETE /api/address/delete/:addressId
// ==========================================================
const deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    // ======================================================
    // VALIDATE ADDRESS ID
    // ======================================================

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    // ======================================================
    // FIND ADDRESS
    // ======================================================

    const address = await Address.findOne({
      _id: addressId,
      user: userId,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // ======================================================
    // CHECK WHETHER DELETED ADDRESS IS DEFAULT
    // ======================================================

    const wasDefault = address.isDefault;

    // ======================================================
    // DELETE ADDRESS
    // ======================================================

    await Address.deleteOne({
      _id: addressId,
      user: userId,
    });

    // ======================================================
    // IF DEFAULT ADDRESS WAS DELETED
    // MAKE ANOTHER ADDRESS DEFAULT
    // ======================================================

    if (wasDefault) {
      const nextAddress = await Address.findOne({
        user: userId,
      }).sort({
        createdAt: -1,
      });

      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("DELETE ADDRESS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete address",
      error: error.message,
    });
  }
};

// ==========================================================
// SET DEFAULT ADDRESS
// PUT /api/address/default/:addressId
// ==========================================================
const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    // ======================================================
    // VALIDATE ADDRESS ID
    // ======================================================

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    // ======================================================
    // FIND ADDRESS
    // ======================================================

    const address = await Address.findOne({
      _id: addressId,
      user: userId,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // ======================================================
    // REMOVE DEFAULT FROM ALL USER ADDRESSES
    // ======================================================

    await Address.updateMany(
      {
        user: userId,
      },
      {
        $set: {
          isDefault: false,
        },
      }
    );

    // ======================================================
    // SET SELECTED ADDRESS AS DEFAULT
    // ======================================================

    address.isDefault = true;

    await address.save();

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(200).json({
      success: true,
      message: "Default address updated successfully",
      address,
    });
  } catch (error) {
    console.error("SET DEFAULT ADDRESS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to set default address",
      error: error.message,
    });
  }
};

// ==========================================================
// GET DEFAULT ADDRESS
// GET /api/address/default
// ==========================================================
const getDefaultAddress = async (req, res) => {
  try {
    const userId = req.user.id;

    // ======================================================
    // FIND DEFAULT ADDRESS
    // ======================================================

    const address = await Address.findOne({
      user: userId,
      isDefault: true,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Default address not found",
        address: null,
      });
    }

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(200).json({
      success: true,
      message: "Default address fetched successfully",
      address,
    });
  } catch (error) {
    console.error("GET DEFAULT ADDRESS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch default address",
      error: error.message,
    });
  }
};

// ==========================================================
// EXPORT
// ==========================================================

module.exports = {
  createAddress,
  getAllAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getDefaultAddress,
};

