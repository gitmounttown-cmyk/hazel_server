const mongoose = require("mongoose");
const Customer = require("../models/customerModel");

// =========================================================
// GENERATE CUSTOMER CODE
// =========================================================

const generateCustomerCode = async () => {
  const lastCustomer = await Customer.findOne({
    customerCode: { $exists: true, $ne: null },
  })
    .sort({ createdAt: -1 })
    .select("customerCode");

  let nextNumber = 1;

  if (lastCustomer && lastCustomer.customerCode) {
    const match = lastCustomer.customerCode.match(/(\d+)$/);

    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `CUS${String(nextNumber).padStart(5, "0")}`;
};

// =========================================================
// CREATE CUSTOMER
// =========================================================
// POST /api/customers
// =========================================================

exports.createCustomer = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      address,
      city,
      state,
      pincode,
      notes,
    } = req.body;

    // -------------------------------------------------------
    // VALIDATION
    // -------------------------------------------------------

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required",
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer phone is required",
      });
    }

    // -------------------------------------------------------
    // NORMALIZE VALUES
    // -------------------------------------------------------

    const normalizedPhone = phone
      .trim()
      .replace(/\s+/g, "");

    const normalizedEmail =
      email && email.trim()
        ? email.trim().toLowerCase()
        : null;

    // -------------------------------------------------------
    // CHECK DUPLICATE PHONE
    // -------------------------------------------------------

    const existingPhone = await Customer.findOne({
      phone: normalizedPhone,
      status: "active",
    });

    if (existingPhone) {
      return res.status(200).json({
        success: true,
        existing: true,
        message: "Customer already exists with this phone number",
        customer: existingPhone,
      });
    }

    // -------------------------------------------------------
    // CHECK DUPLICATE EMAIL
    // -------------------------------------------------------

    if (normalizedEmail) {
      const existingEmail = await Customer.findOne({
        email: normalizedEmail,
        status: "active",
      });

      if (existingEmail) {
        return res.status(200).json({
          success: true,
          existing: true,
          message: "Customer already exists with this email",
          customer: existingEmail,
        });
      }
    }

    // -------------------------------------------------------
    // GENERATE CUSTOMER CODE
    // -------------------------------------------------------

    const customerCode = await generateCustomerCode();

    // -------------------------------------------------------
    // CREATE CUSTOMER
    // -------------------------------------------------------

    const customer = await Customer.create({
      customerCode,

      name: name.trim(),

      phone: normalizedPhone,

      email: normalizedEmail,

      address: address?.trim() || "",

      city: city?.trim() || "",

      state: state?.trim() || "",

      pincode: pincode?.trim() || "",

      notes: notes?.trim() || "",

      status: "active",

      totalOrders: 0,

      totalPurchaseAmount: 0,

      lastPurchaseDate: null,
    });

    // -------------------------------------------------------
    // RESPONSE
    // -------------------------------------------------------

    return res.status(201).json({
      success: true,
      existing: false,
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    console.error("CREATE CUSTOMER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create customer",
      error: error.message,
    });
  }
};

// =========================================================
// SEARCH CUSTOMER
// =========================================================
// GET /api/customers/search?search=Arun
// GET /api/customers/search?search=9876543210
// =========================================================

exports.searchCustomers = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";

    if (!search) {
      return res.status(200).json({
        success: true,
        count: 0,
        customers: [],
      });
    }

    const regex = new RegExp(search, "i");

    const customers = await Customer.find({
      status: "active",

      $or: [
        {
          name: regex,
        },
        {
          phone: regex,
        },
        {
          email: regex,
        },
        {
          customerCode: regex,
        },
      ],
    })
      .select(
        "customerCode name phone email address city state pincode status totalOrders totalPurchaseAmount lastPurchaseDate"
      )
      .sort({
        name: 1,
      })
      .limit(20);

    return res.status(200).json({
      success: true,
      count: customers.length,
      customers,
    });
  } catch (error) {
    console.error("SEARCH CUSTOMER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to search customers",
      error: error.message,
    });
  }
};

// =========================================================
// GET ALL CUSTOMERS
// =========================================================
// GET /api/customers
// GET /api/customers?page=1&limit=20&search=Arun
// =========================================================

exports.getCustomers = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 20,
      search = "",
      status = "active",
    } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    if (page < 1) page = 1;

    if (limit < 1) limit = 20;

    if (limit > 100) limit = 100;

    // -------------------------------------------------------
    // QUERY
    // -------------------------------------------------------

    const query = {};

    if (status) {
      query.status = status;
    }

    // -------------------------------------------------------
    // SEARCH
    // -------------------------------------------------------

    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");

      query.$or = [
        {
          name: regex,
        },
        {
          phone: regex,
        },
        {
          email: regex,
        },
        {
          customerCode: regex,
        },
      ];
    }

    // -------------------------------------------------------
    // PAGINATION
    // -------------------------------------------------------

    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit),

      Customer.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,

      customers,

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET CUSTOMERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get customers",
      error: error.message,
    });
  }
};

// =========================================================
// GET CUSTOMER BY ID
// =========================================================
// GET /api/customers/:id
// =========================================================

exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    // -------------------------------------------------------
    // VALIDATE ID
    // -------------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    // -------------------------------------------------------
    // FIND CUSTOMER
    // -------------------------------------------------------

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error("GET CUSTOMER BY ID ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get customer",
      error: error.message,
    });
  }
};

// =========================================================
// GET CUSTOMER BY PHONE
// =========================================================
// GET /api/customers/phone/9876543210
// =========================================================

exports.getCustomerByPhone = async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const normalizedPhone = phone
      .trim()
      .replace(/\s+/g, "");

    const customer = await Customer.findOne({
      phone: normalizedPhone,
      status: "active",
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error("GET CUSTOMER BY PHONE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to find customer",
      error: error.message,
    });
  }
};

// =========================================================
// UPDATE CUSTOMER
// =========================================================
// PUT /api/customers/:id
// =========================================================

exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const {
      name,
      phone,
      email,
      address,
      city,
      state,
      pincode,
      notes,
      status,
    } = req.body;

    // -------------------------------------------------------
    // CHECK CUSTOMER
    // -------------------------------------------------------

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // -------------------------------------------------------
    // UPDATE BASIC DETAILS
    // -------------------------------------------------------

    if (name !== undefined) {
      customer.name = name.trim();
    }

    if (phone !== undefined) {
      const normalizedPhone = phone
        .trim()
        .replace(/\s+/g, "");

      // Check another customer using same phone
      const duplicatePhone = await Customer.findOne({
        phone: normalizedPhone,
        _id: { $ne: id },
        status: "active",
      });

      if (duplicatePhone) {
        return res.status(409).json({
          success: false,
          message: "Another customer already uses this phone number",
        });
      }

      customer.phone = normalizedPhone;
    }

    if (email !== undefined) {
      const normalizedEmail =
        email && email.trim()
          ? email.trim().toLowerCase()
          : null;

      if (normalizedEmail) {
        const duplicateEmail = await Customer.findOne({
          email: normalizedEmail,
          _id: { $ne: id },
          status: "active",
        });

        if (duplicateEmail) {
          return res.status(409).json({
            success: false,
            message: "Another customer already uses this email",
          });
        }
      }

      customer.email = normalizedEmail;
    }

    if (address !== undefined) {
      customer.address = address.trim();
    }

    if (city !== undefined) {
      customer.city = city.trim();
    }

    if (state !== undefined) {
      customer.state = state.trim();
    }

    if (pincode !== undefined) {
      customer.pincode = pincode.trim();
    }

    if (notes !== undefined) {
      customer.notes = notes.trim();
    }

    if (status !== undefined) {
      customer.status = status;
    }


    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      customer,
    });
  } catch (error) {
    console.error("UPDATE CUSTOMER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update customer",
      error: error.message,
    });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const customer = await Customer.findByIdAndDelete(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
      customer,
    });
  } catch (error) {
    console.error("DELETE CUSTOMER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete customer",
      error: error.message,
    });
  }
};

exports.updateCustomerPurchaseSummary = async (
  customerId,
  orderAmount
) => {
  try {
    if (!customerId) {
      return null;
    }

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return null;
    }

    const customer = await Customer.findByIdAndUpdate(
      customerId,
      {
        $inc: {
          totalOrders: 1,
          totalPurchaseAmount: Number(orderAmount) || 0,
        },

        $set: {
          lastPurchaseDate: new Date(),
        },
      },
      {
        new: true,
      }
    );

    return customer;
  } catch (error) {
    console.error(
      "UPDATE CUSTOMER PURCHASE SUMMARY ERROR:",
      error
    );

    throw error;
  }
};