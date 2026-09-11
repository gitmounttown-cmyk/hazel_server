const mongoose = require("mongoose");

const Address = require("../models/addressModel");
const Location = require("../models/locationModel");

// *==========================================================*
// *HELPERS*
// *==========================================================*

// Validate MongoDB ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Validate Indian mobile number
const isValidMobileNumber = (mobileNumber) => {
  if (!mobileNumber) return false;

  const normalized = String(mobileNumber)
    .replace(/\D/g, "")
    .slice(-10);

  return /^[6-9]\d{9}$/.test(normalized);
};

// Validate Indian pincode
const isValidPincode = (pincode) => {
  if (!pincode) return false;

  return /^[1-9][0-9]{5}$/.test(String(pincode));
};

// Normalize mobile number
const normalizeMobileNumber = (mobileNumber) => {
  if (!mobileNumber) return "";

  return String(mobileNumber)
    .replace(/\D/g, "")
    .slice(-10);
};

// *==========================================================*
// *CREATE ADDRESS*
// *POST /api/addresses/create*
// *==========================================================*

exports.createAddress = async (req, res) => {
  try {
    // ========================================================
    // AUTHENTICATION
    // ========================================================

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // ========================================================
    // VALIDATE USER ID
    // ========================================================

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // ========================================================
    // REQUEST BODY
    // ========================================================

    const {
      location,
      addressType = "home",
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
      country = "India",
      pincode,
      latitude,
      longitude,
      placeId,
      isDefault = false,
    } = req.body;

    // ========================================================
    // REQUIRED FIELDS
    // ========================================================

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
          "Full name, mobile number, house number, city, state and pincode are required",
      });
    }

    // ========================================================
    // ADDRESS TYPE VALIDATION
    // ========================================================

    if (!["home", "work", "other"].includes(addressType)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid address type. Allowed values: home, work, other",
      });
    }

    // ========================================================
    // MOBILE VALIDATION
    // ========================================================

    if (!isValidMobileNumber(mobileNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number",
      });
    }

    if (
      alternateMobileNumber &&
      !isValidMobileNumber(alternateMobileNumber)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid alternate mobile number",
      });
    }

    // ========================================================
    // PINCODE VALIDATION
    // ========================================================

    if (!isValidPincode(pincode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Indian pincode",
      });
    }

    // ========================================================
    // LOCATION DATA
    // ========================================================

    let locationData = null;

    if (location) {
      // ------------------------------------------------------
      // Validate Location ID
      // ------------------------------------------------------

      if (!isValidObjectId(location)) {
        return res.status(400).json({
          success: false,
          message: "Invalid location ID",
        });
      }

      // ------------------------------------------------------
      // Make sure location belongs to logged-in user
      // ------------------------------------------------------

      locationData = await Location.findOne({
        _id: location,
        user: userId,
      });

      if (!locationData) {
        return res.status(404).json({
          success: false,
          message: "Location not found",
        });
      }
    }

    // ========================================================
    // FINAL LOCATION VALUES
    // ========================================================

    let finalLatitude =
      latitude !== undefined && latitude !== null
        ? Number(latitude)
        : null;

    let finalLongitude =
      longitude !== undefined && longitude !== null
        ? Number(longitude)
        : null;

    let finalPlaceId = placeId || "";

    // ========================================================
    // USE LOCATION DATA WHEN AVAILABLE
    // ========================================================

    if (locationData) {
      finalLatitude = locationData.latitude;
      finalLongitude = locationData.longitude;

      finalPlaceId = locationData.placeId || "";
    }

    // ========================================================
    // LATITUDE VALIDATION
    // ========================================================

    if (finalLatitude !== null) {
      if (
        Number.isNaN(finalLatitude) ||
        finalLatitude < -90 ||
        finalLatitude > 90
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid latitude",
        });
      }
    }

    // ========================================================
    // LONGITUDE VALIDATION
    // ========================================================

    if (finalLongitude !== null) {
      if (
        Number.isNaN(finalLongitude) ||
        finalLongitude < -180 ||
        finalLongitude > 180
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid longitude",
        });
      }
    }

    // ========================================================
    // IF DEFAULT ADDRESS
    // REMOVE OLD DEFAULT ADDRESS
    // ========================================================

    if (isDefault === true) {
      await Address.updateMany(
        {
          user: userId,
          isActive: true,
          isDefault: true,
        },
        {
          $set: {
            isDefault: false,
          },
        }
      );
    }

    // ========================================================
    // CREATE ADDRESS
    // ========================================================

    const address = await Address.create({
      user: userId,

      location: location || null,

      addressType,

      fullName: String(fullName).trim(),

      mobileNumber:
        normalizeMobileNumber(mobileNumber),

      alternateMobileNumber:
        alternateMobileNumber
          ? normalizeMobileNumber(
              alternateMobileNumber
            )
          : "",

      houseNo: String(houseNo).trim(),

      street: street
        ? String(street).trim()
        : "",

      area: area
        ? String(area).trim()
        : "",

      landmark: landmark
        ? String(landmark).trim()
        : "",

      city: String(city).trim(),

      district: district
        ? String(district).trim()
        : "",

      state: String(state).trim(),

      country: country
        ? String(country).trim()
        : "India",

      pincode: String(pincode).trim(),

      latitude: finalLatitude,

      longitude: finalLongitude,

      placeId: finalPlaceId,

      isDefault:
        isDefault === true,

      isActive: true,
    });

    // ========================================================
    // POPULATE LOCATION
    // ========================================================

    await address.populate("location");

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(201).json({
      success: true,
      message: "Address created successfully",
      address,
    });
  } catch (error) {
    console.error(
      "CREATE ADDRESS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create address",
      error: error.message,
    });
  }
};

// *==========================================================*
// *GET ALL ADDRESSES*
// *GET /api/addresses/all*
// *==========================================================*

exports.getAddresses = async (req, res) => {
  try {
    // ========================================================
    // AUTHENTICATION
    // ========================================================

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // ========================================================
    // GET ADDRESSES
    // ========================================================

    const addresses = await Address.find({
      user: userId,
      isActive: true,
    })
      .populate("location")
      .sort({
        isDefault: -1,
        createdAt: -1,
      });

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,
      count: addresses.length,
      addresses,
    });
  } catch (error) {
    console.error(
      "GET ADDRESSES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get addresses",
      error: error.message,
    });
  }
};

// *==========================================================*
// *GET ADDRESS BY ID*
// *GET /api/addresses/:id*
// *==========================================================*

exports.getAddressById = async (req, res) => {
  try {
    // ========================================================
    // AUTHENTICATION
    // ========================================================

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // ========================================================
    // ADDRESS ID
    // ========================================================

    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    // ========================================================
    // FIND ADDRESS
    // ========================================================

    const address = await Address.findOne({
      _id: id,
      user: userId,
      isActive: true,
    }).populate("location");

    // ========================================================
    // NOT FOUND
    // ========================================================

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,
      address,
    });
  } catch (error) {
    console.error(
      "GET ADDRESS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get address",
      error: error.message,
    });
  }
};

// *==========================================================*
// *UPDATE ADDRESS*
// *PUT /api/addresses/update/:id*
// *==========================================================*

exports.updateAddress = async (req, res) => {
  try {
    // ========================================================
    // AUTHENTICATION
    // ========================================================

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // ========================================================
    // ADDRESS ID
    // ========================================================

    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    // ========================================================
    // FIND EXISTING ADDRESS
    // ========================================================

    const existingAddress =
      await Address.findOne({
        _id: id,
        user: userId,
        isActive: true,
      });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // ========================================================
    // REQUEST BODY
    // ========================================================

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
      location,
      isDefault,
    } = req.body;

    // ========================================================
    // ADDRESS TYPE
    // ========================================================

    if (
      addressType !== undefined &&
      !["home", "work", "other"].includes(
        addressType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid address type. Allowed values: home, work, other",
      });
    }

    // ========================================================
    // MOBILE VALIDATION
    // ========================================================

    if (
      mobileNumber !== undefined &&
      !isValidMobileNumber(mobileNumber)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number",
      });
    }

    // ========================================================
    // ALTERNATE MOBILE VALIDATION
    // ========================================================

    if (
      alternateMobileNumber !==
        undefined &&
      alternateMobileNumber !== "" &&
      !isValidMobileNumber(
        alternateMobileNumber
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid alternate mobile number",
      });
    }

    // ========================================================
    // PINCODE VALIDATION
    // ========================================================

    if (
      pincode !== undefined &&
      !isValidPincode(pincode)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Indian pincode",
      });
    }

    // ========================================================
    // LOCATION VALIDATION
    // ========================================================

    let locationData = null;

    if (
      location !== undefined &&
      location !== null &&
      location !== ""
    ) {
      // ------------------------------------------------------
      // Validate ObjectId
      // ------------------------------------------------------

      if (!isValidObjectId(location)) {
        return res.status(400).json({
          success: false,
          message: "Invalid location ID",
        });
      }

      // ------------------------------------------------------
      // Make sure Location belongs to user
      // ------------------------------------------------------

      locationData =
        await Location.findOne({
          _id: location,
          user: userId,
        });

      if (!locationData) {
        return res.status(404).json({
          success: false,
          message: "Location not found",
        });
      }
    }

    // ========================================================
    // UPDATE DATA
    // ========================================================

    const updateData = {};

    if (addressType !== undefined) {
      updateData.addressType =
        addressType;
    }

    if (fullName !== undefined) {
      if (!String(fullName).trim()) {
        return res.status(400).json({
          success: false,
          message: "Full name cannot be empty",
        });
      }

      updateData.fullName =
        String(fullName).trim();
    }

    if (mobileNumber !== undefined) {
      updateData.mobileNumber =
        normalizeMobileNumber(
          mobileNumber
        );
    }

    if (
      alternateMobileNumber !==
      undefined
    ) {
      updateData.alternateMobileNumber =
        alternateMobileNumber
          ? normalizeMobileNumber(
              alternateMobileNumber
            )
          : "";
    }

    if (houseNo !== undefined) {
      if (!String(houseNo).trim()) {
        return res.status(400).json({
          success: false,
          message:
            "House number cannot be empty",
        });
      }

      updateData.houseNo =
        String(houseNo).trim();
    }

    if (street !== undefined) {
      updateData.street =
        String(street).trim();
    }

    if (area !== undefined) {
      updateData.area =
        String(area).trim();
    }

    if (landmark !== undefined) {
      updateData.landmark =
        String(landmark).trim();
    }

    if (city !== undefined) {
      if (!String(city).trim()) {
        return res.status(400).json({
          success: false,
          message:
            "City cannot be empty",
        });
      }

      updateData.city =
        String(city).trim();
    }

    if (district !== undefined) {
      updateData.district =
        String(district).trim();
    }

    if (state !== undefined) {
      if (!String(state).trim()) {
        return res.status(400).json({
          success: false,
          message:
            "State cannot be empty",
        });
      }

      updateData.state =
        String(state).trim();
    }

    if (country !== undefined) {
      updateData.country =
        String(country).trim();
    }

    if (pincode !== undefined) {
      updateData.pincode =
        String(pincode).trim();
    }

    // ========================================================
    // LOCATION
    // ========================================================

    if (location !== undefined) {
      updateData.location =
        location || null;
    }

    // ========================================================
    // LATITUDE / LONGITUDE / PLACE ID
    // ========================================================

    if (locationData) {
      updateData.latitude =
        locationData.latitude;

      updateData.longitude =
        locationData.longitude;

      updateData.placeId =
        locationData.placeId || "";
    } else {
      if (latitude !== undefined) {
        const lat = Number(latitude);

        if (
          Number.isNaN(lat) ||
          lat < -90 ||
          lat > 90
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid latitude",
          });
        }

        updateData.latitude = lat;
      }

      if (longitude !== undefined) {
        const lng = Number(longitude);

        if (
          Number.isNaN(lng) ||
          lng < -180 ||
          lng > 180
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid longitude",
          });
        }

        updateData.longitude = lng;
      }

      if (placeId !== undefined) {
        updateData.placeId =
          placeId || "";
      }
    }

    // ========================================================
    // DEFAULT ADDRESS
    // ========================================================

    if (isDefault === true) {
      await Address.updateMany(
        {
          user: userId,
          _id: {
            $ne: id,
          },
          isActive: true,
          isDefault: true,
        },
        {
          $set: {
            isDefault: false,
          },
        }
      );

      updateData.isDefault = true;
    }

    if (isDefault === false) {
      updateData.isDefault = false;
    }

    // ========================================================
    // UPDATE ADDRESS
    // ========================================================

    const address =
      await Address.findOneAndUpdate(
        {
          _id: id,
          user: userId,
          isActive: true,
        },
        {
          $set: updateData,
        },
        {
          new: true,
          runValidators: true,
        }
      ).populate("location");

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,
      message:
        "Address updated successfully",
      address,
    });
  } catch (error) {
    console.error(
      "UPDATE ADDRESS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update address",
      error: error.message,
    });
  }
};

// *==========================================================*
// *DELETE ADDRESS*
// *DELETE /api/addresses/delete/:id*
// *==========================================================*

exports.deleteAddress = async (req, res) => {
  try {
    // ========================================================
    // AUTHENTICATION
    // ========================================================

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // ========================================================
    // ADDRESS ID
    // ========================================================

    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    // ========================================================
    // SOFT DELETE
    // ========================================================

    const address =
      await Address.findOneAndUpdate(
        {
          _id: id,
          user: userId,
          isActive: true,
        },
        {
          $set: {
            isActive: false,
            isDefault: false,
          },
        },
        {
          new: true,
        }
      );

    // ========================================================
    // NOT FOUND
    // ========================================================

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,
      message:
        "Address deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE ADDRESS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete address",
      error: error.message,
    });
  }
};

// *==========================================================*
// *SET DEFAULT ADDRESS*
// *PATCH /api/addresses/:id/default*
// *==========================================================*

exports.setDefaultAddress = async (
  req,
  res
) => {
  try {
    // ========================================================
    // AUTHENTICATION
    // ========================================================

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // ========================================================
    // ADDRESS ID
    // ========================================================

    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    // ========================================================
    // FIND ACTIVE ADDRESS
    // ========================================================

    const address =
      await Address.findOne({
        _id: id,
        user: userId,
        isActive: true,
      });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // ========================================================
    // REMOVE OLD DEFAULT
    // ========================================================

    await Address.updateMany(
      {
        user: userId,
        _id: {
          $ne: id,
        },
        isActive: true,
        isDefault: true,
      },
      {
        $set: {
          isDefault: false,
        },
      }
    );

    // ========================================================
    // SET NEW DEFAULT
    // ========================================================

    address.isDefault = true;

    await address.save();

    // ========================================================
    // POPULATE LOCATION
    // ========================================================

    await address.populate("location");

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,
      message:
        "Default address updated successfully",
      address,
    });
  } catch (error) {
    console.error(
      "SET DEFAULT ADDRESS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to set default address",
      error: error.message,
    });
  }
};