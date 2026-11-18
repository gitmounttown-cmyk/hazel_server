const User = require("../models/userModel");

// Get logged-in user profile details
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("-__v");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: error.message,
    });
  }
};

// Update details (Name & Email from "Edit details" modal)
const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;

    // Handle profile image upload
    if (req.file) {
      user.profileImage = `uploads/profiles/${req.file.filename}`; // Save the filename of the uploaded image
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        mobileNumber: user.mobileNumber,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage || null,
        isVerified: user.isVerified,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
};

//get all users
// const getAllUsers = async (req, res) => {
//   try {
//     let {
//       page = 1,
//       limit = 10,
//       search = "",
//       status = "",
//     } = req.query;

//     page = Math.max(1, parseInt(page, 10) || 1);
//     limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

//     const query = {};

//     // Optional status filter
//     if (status && status !== "all") {
//       query.isActive = status;
//     }

//     // Search users by name, email, phone, or mobile number
//     const searchText = String(search).trim();

//     if (searchText) {
//       const regex = new RegExp(
//         searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
//         "i",
//       );

//       query.$or = [
//         { name: regex },
//         { email: regex },
//         { phone: regex },
//         { mobileNumber: regex },
//       ];
//     }

//     const skip = (page - 1) * limit;

//     const [users, total] = await Promise.all([
//       User.find(query)
//         .select("-__v")
//         .sort({ createdAt: -1, _id: -1 })
//         .skip(skip)
//         .limit(limit)
//         .lean(),

//       User.countDocuments(query),
//     ]);

//     return res.status(200).json({
//       success: true,
//       users,
//       pagination: {
//         page,
//         limit,
//         total,
//         totalPages: Math.ceil(total / limit),
//       },
//     });
//   } catch (error) {
//     console.error("GET ALL USERS ERROR:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch users",
//       error: error.message,
//     });
//   }
// };


// Get all users - group duplicate customer records
const getAllUsers = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search = "",
      status = "",
    } = req.query;

    page = Math.max(1, parseInt(page, 10) || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    const query = {};

    // Status filter
    if (status && status !== "all") {
      query.isActive = status === "true";
    }

    // Search filter
    const searchText = String(search).trim();

    if (searchText) {
      const escapedSearch = searchText.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const regex = new RegExp(escapedSearch, "i");

      query.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { mobileNumber: regex },
      ];
    }

    // Fetch matching records
    const users = await User.find(query)
      .select("-__v")
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    // Group users by mobile number or email
    const groups = new Map();

    users.forEach((user) => {
      const mobile = String(user.mobileNumber || "")
        .replace(/\D/g, "");

      const email = String(user.email || "")
        .trim()
        .toLowerCase();

      const keys = [];

      if (mobile) keys.push(`mobile:${mobile}`);
      if (email) keys.push(`email:${email}`);

      if (!keys.length) {
        keys.push(`id:${user._id}`);
      }

      // Find matching groups
      const matchedGroups = [
        ...new Set(
          keys
            .map((key) => groups.get(key))
            .filter(Boolean)
        ),
      ];

      let group;

      if (matchedGroups.length === 0) {
        group = {
          _id: user._id,
          name: user.name,
          mobileNumber: user.mobileNumber,
          email: user.email,
          accounts: [],
          accountCount: 0,
        };
      } else {
        group = matchedGroups[0];

        // Merge connected groups
        matchedGroups.slice(1).forEach((otherGroup) => {
          group.accounts.push(...otherGroup.accounts);

          for (const [key, value] of groups.entries()) {
            if (value === otherGroup) {
              groups.set(key, group);
            }
          }
        });
      }

      group.accounts.push(user);
      group.accountCount = group.accounts.length;

      // Keep available customer details
      if (!group.name && user.name) {
        group.name = user.name;
      }

      if (!group.mobileNumber && user.mobileNumber) {
        group.mobileNumber = user.mobileNumber;
      }

      if (!group.email && user.email) {
        group.email = user.email;
      }

      // Register matching keys
      keys.forEach((key) => groups.set(key, group));
    });

    // Get unique customer groups
    const groupedUsers = [...new Set(groups.values())];

    // Select primary account for frontend
    const finalUsers = groupedUsers.map((group) => {
      const primaryAccount =
        group.accounts.find((account) => !account.isGuest) ||
        group.accounts[0];

      return {
        ...group,

        // Primary account details
        _id: primaryAccount._id,
        name: primaryAccount.name || group.name,
        mobileNumber:
          primaryAccount.mobileNumber || group.mobileNumber,
        email: primaryAccount.email || group.email,
        profileImage: primaryAccount.profileImage || null,
        role: primaryAccount.role,
        isActive: primaryAccount.isActive,
        isVerified: primaryAccount.isVerified,
        lastLoginAt: primaryAccount.lastLoginAt,
        createdAt: primaryAccount.createdAt,

        // Keep all grouped accounts
        accounts: group.accounts,
        accountCount: group.accounts.length,
      };
    });

    // Pagination after grouping
    const total = finalUsers.length;
    const skip = (page - 1) * limit;

    const paginatedUsers = finalUsers.slice(
      skip,
      skip + limit
    );

    return res.status(200).json({
      success: true,
      users: paginatedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET ALL USERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  getAllUsers,
};