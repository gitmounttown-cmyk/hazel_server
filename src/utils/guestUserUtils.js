
const User = require("../models/userModel");

const createOrUpdateGuestUser = async ({
  guestId,
  name,
  mobileNumber,
  email,
  session = null,
}) => {
  try {
    const normalizedGuestId = String(guestId || "").trim();
    const normalizedMobile = String(mobileNumber || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedGuestId) {
      throw new Error("Guest ID is required.");
    }

    // Build update data
    const updateData = {
      isGuest: true,
      role: "customer",
      isActive: true,
    };

    if (name) updateData.name = name;
    if (normalizedMobile) updateData.mobileNumber = normalizedMobile;
    if (normalizedEmail) updateData.email = normalizedEmail;

    const options = {
      new: true,
      runValidators: true,
      session,
    };

    // 1. First check by guestId
    let guestUser = await User.findOne({
      guestId: normalizedGuestId,
      isGuest: true,
    }).session(session);

    if (guestUser) {
      Object.assign(guestUser, updateData);
      await guestUser.save({ session });

      console.log("Guest user updated using guestId:", guestUser._id);

      return guestUser;
    }

    // 2. Check existing guest using mobile number or email
    const contactConditions = [];

    if (normalizedMobile) {
      contactConditions.push({
        mobileNumber: normalizedMobile,
      });
    }

    if (normalizedEmail) {
      contactConditions.push({
        email: normalizedEmail,
      });
    }

    if (contactConditions.length > 0) {
      guestUser = await User.findOne({
        isGuest: true,
        $or: contactConditions,
      }).session(session);
    }

    if (guestUser) {
      Object.assign(guestUser, updateData);

      // Preserve an existing guestId rather than replacing it
      if (!guestUser.guestId) {
        guestUser.guestId = normalizedGuestId;
      }

      await guestUser.save({ session });

      console.log("Existing guest user updated:", guestUser._id);

      return guestUser;
    }

    // 3. No guest record found: create a new guest
    const [newGuestUser] = await User.create(
      [
        {
          ...updateData,
          guestId: normalizedGuestId,
          isVerified: false,
          lastLoginAt: null,
        },
      ],
      { session }
    );

    console.log("New guest user created:", newGuestUser._id);

    return newGuestUser;

  } catch (error) {
    console.error("Guest user creation/update error:", error);
    throw error;
  }
};

module.exports = {
  createOrUpdateGuestUser,
};
