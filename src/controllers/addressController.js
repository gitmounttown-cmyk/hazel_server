const mongoose = require("mongoose");
const Address = require("../models/addressModel");
const User = require("../models/userModel");

// CREATE ADDRESS
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

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Fallback to logged-in user details if empty
    const user = await User.findById(userId);
    const finalFullName = fullName || user?.name || "Customer";
    const finalMobile = mobileNumber || user?.mobileNumber;

    if (!finalFullName || !finalMobile || !houseNo || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: "fullName, mobileNumber, houseNo, city, state, and pincode are required",
      });
    }

    const existingAddresses = await Address.find({ user: userId, isActive: true });
    let makeDefault = Boolean(isDefault);

    if (existingAddresses.length === 0) {
      makeDefault = true;
    }

    if (makeDefault) {
      await Address.updateMany(
        { user: userId },
        { $set: { isDefault: false } }
      );
    }

    const address = await Address.create({
      user: userId,
      addressType: addressType || "Home",
      fullName: finalFullName,
      mobileNumber: finalMobile,
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
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      placeId: placeId || "",
      isDefault: makeDefault,
    });

    return res.status(201).json({
      success: true,
      message: "Address created successfully",
      address,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create address",
      error: error.message,
    });
  }
};

// GET ALL ADDRESSES
const getAllAddresses = async (req, res) => {
  try {
    const userId = req.user.id;

    const addresses = await Address.find({ user: userId, isActive: true }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      message: "Addresses fetched successfully",
      count: addresses.length,
      addresses,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
      error: error.message,
    });
  }
};

// GET SINGLE ADDRESS BY ID
const getAddressById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({ success: false, message: "Invalid address ID" });
    }

    const address = await Address.findOne({ _id: addressId, user: userId, isActive: true });

    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    return res.status(200).json({ success: true, message: "Address fetched successfully", address });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch address", error: error.message });
  }
};

// UPDATE ADDRESS
const updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({ success: false, message: "Invalid address ID" });
    }

    const address = await Address.findOne({ _id: addressId, user: userId, isActive: true });

    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

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

    if (addressType !== undefined) address.addressType = addressType;
    if (fullName !== undefined) address.fullName = fullName;
    if (mobileNumber !== undefined) address.mobileNumber = mobileNumber;
    if (alternateMobileNumber !== undefined) address.alternateMobileNumber = alternateMobileNumber;
    if (houseNo !== undefined) address.houseNo = houseNo;
    if (street !== undefined) address.street = street;
    if (area !== undefined) address.area = area;
    if (landmark !== undefined) address.landmark = landmark;
    if (city !== undefined) address.city = city;
    if (district !== undefined) address.district = district;
    if (state !== undefined) address.state = state;
    if (country !== undefined) address.country = country;
    if (pincode !== undefined) address.pincode = pincode;
    if (latitude !== undefined) address.latitude = latitude ? Number(latitude) : null;
    if (longitude !== undefined) address.longitude = longitude ? Number(longitude) : null;
    if (placeId !== undefined) address.placeId = placeId;

    if (isDefault === true) {
      await Address.updateMany(
        { user: userId, _id: { $ne: addressId } },
        { $set: { isDefault: false } }
      );
      address.isDefault = true;
    }

    await address.save();

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      address,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update address", error: error.message });
  }
};

// DELETE ADDRESS
const deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({ success: false, message: "Invalid address ID" });
    }

    const address = await Address.findOne({ _id: addressId, user: userId, isActive: true });

    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    const wasDefault = address.isDefault;

    // Soft Delete
    address.isActive = false;
    await address.save();

    if (wasDefault) {
      const nextAddress = await Address.findOne({ user: userId, isActive: true }).sort({ createdAt: -1 });

      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete address", error: error.message });
  }
};

// SET DEFAULT ADDRESS
const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({ success: false, message: "Invalid address ID" });
    }

    const address = await Address.findOne({ _id: addressId, user: userId, isActive: true });

    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    await Address.updateMany({ user: userId }, { $set: { isDefault: false } });

    address.isDefault = true;
    await address.save();

    return res.status(200).json({
      success: true,
      message: "Default address updated successfully",
      address,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to set default address", error: error.message });
  }
};

// GET DEFAULT ADDRESS
const getDefaultAddress = async (req, res) => {
  try {
    const userId = req.user.id;

    const address = await Address.findOne({ user: userId, isDefault: true, isActive: true });

    if (!address) {
      return res.status(404).json({ success: false, message: "Default address not found", address: null });
    }

    return res.status(200).json({ success: true, message: "Default address fetched successfully", address });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch default address", error: error.message });
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