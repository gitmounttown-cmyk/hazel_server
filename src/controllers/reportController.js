const mongoose = require("mongoose");

const Report = require("../models/reportModel");
const Order = require("../models/orderModel");
const User = require("../models/userModel");

// ============================================================
// DATE RANGE HELPER
// ============================================================

const getDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    throw new Error("Invalid startDate");
  }

  if (isNaN(end.getTime())) {
    throw new Error("Invalid endDate");
  }

  // Start of day
  start.setHours(0, 0, 0, 0);

  // End of day
  end.setHours(23, 59, 59, 999);

  return {
    start,
    end,
  };
};

// ============================================================
// NUMBER HELPER
// ============================================================

const roundNumber = (value) => {
  return Number(Number(value || 0).toFixed(2));
};

// ============================================================
// SALES REPORT
// ============================================================

exports.getSalesReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
    } = req.query;

    // ----------------------------------------------------------
    // Validate dates
    // ----------------------------------------------------------

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message:
          "startDate and endDate are required.",
      });
    }

    const {
      start,
      end,
    } = getDateRange(
      startDate,
      endDate
    );

    // ----------------------------------------------------------
    // Get orders
    // ----------------------------------------------------------

    const orders = await Order.find({
      createdAt: {
        $gte: start,
        $lte: end,
      },
    }).lean();

    // ----------------------------------------------------------
    // Variables
    // ----------------------------------------------------------

    let totalOrders = orders.length;

    let totalRevenue = 0;

    let totalDiscount = 0;

    let totalTax = 0;

    let totalShipping = 0;

    let totalQuantitySold = 0;

    let cancelledOrders = 0;

    let refundedAmount = 0;

    // ----------------------------------------------------------
    // Daily sales
    // ----------------------------------------------------------

    const dailySalesMap = {};

    // ----------------------------------------------------------
    // Order status
    // ----------------------------------------------------------

    const orderStatusMap = {};

    // ----------------------------------------------------------
    // Payment status
    // ----------------------------------------------------------

    const paymentStatusMap = {};

    // ==========================================================
    // PROCESS ORDERS
    // ==========================================================

    orders.forEach((order) => {
      // --------------------------------------------------------
      // Amount
      // --------------------------------------------------------

      const orderAmount = Number(
        order.totalAmount ||
          order.total ||
          order.grandTotal ||
          order.finalAmount ||
          0
      );

      const discount = Number(
        order.discountAmount ||
          order.discount ||
          0
      );

      const tax = Number(
        order.taxAmount ||
          order.tax ||
          0
      );

      const shipping = Number(
        order.shippingAmount ||
          order.shippingCharge ||
          order.shipping ||
          0
      );

      totalRevenue += orderAmount;

      totalDiscount += discount;

      totalTax += tax;

      totalShipping += shipping;

      // --------------------------------------------------------
      // Items
      // --------------------------------------------------------

      const items =
        order.items ||
        order.orderItems ||
        order.products ||
        [];

      items.forEach((item) => {
        const quantity = Number(
          item.quantity || 0
        );

        totalQuantitySold += quantity;
      });

      // --------------------------------------------------------
      // Order Status
      // --------------------------------------------------------

      const orderStatus =
        order.orderStatus ||
        order.status ||
        "UNKNOWN";

      if (
        orderStatus.toUpperCase() ===
        "CANCELLED"
      ) {
        cancelledOrders++;

        refundedAmount += Number(
          order.refundAmount ||
            order.refundedAmount ||
            0
        );
      }

      // --------------------------------------------------------
      // Order status summary
      // --------------------------------------------------------

      if (!orderStatusMap[orderStatus]) {
        orderStatusMap[orderStatus] = {
          status: orderStatus,
          count: 0,
          amount: 0,
        };
      }

      orderStatusMap[orderStatus].count++;

      orderStatusMap[
        orderStatus
      ].amount += orderAmount;

      // --------------------------------------------------------
      // Payment status
      // --------------------------------------------------------

      const paymentStatus =
        order.paymentStatus ||
        "UNKNOWN";

      if (
        !paymentStatusMap[paymentStatus]
      ) {
        paymentStatusMap[
          paymentStatus
        ] = {
          status: paymentStatus,
          count: 0,
          amount: 0,
        };
      }

      paymentStatusMap[
        paymentStatus
      ].count++;

      paymentStatusMap[
        paymentStatus
      ].amount += orderAmount;

      // --------------------------------------------------------
      // Daily sales
      // --------------------------------------------------------

      const orderDate = new Date(
        order.createdAt
      );

      const dateKey =
        orderDate
          .toISOString()
          .split("T")[0];

      if (!dailySalesMap[dateKey]) {
        dailySalesMap[dateKey] = {
          date: new Date(
            `${dateKey}T00:00:00.000Z`
          ),

          orders: 0,

          revenue: 0,
        };
      }

      dailySalesMap[dateKey].orders++;

      dailySalesMap[
        dateKey
      ].revenue += orderAmount;
    });

    // ==========================================================
    // DAILY SALES ARRAY
    // ==========================================================

    const dailySales = Object.values(
      dailySalesMap
    )
      .sort(
        (a, b) =>
          new Date(a.date) -
          new Date(b.date)
      )
      .map((item) => ({
        date: item.date,

        orders: item.orders,

        revenue: roundNumber(
          item.revenue
        ),
      }));

    // ==========================================================
    // AVERAGE ORDER VALUE
    // ==========================================================

    const averageOrderValue =
      totalOrders > 0
        ? totalRevenue / totalOrders
        : 0;

    // ==========================================================
    // ORDER STATUS ARRAY
    // ==========================================================

    const orderStatuses = Object.values(
      orderStatusMap
    ).map((item) => ({
      status: item.status,

      count: item.count,

      amount: roundNumber(
        item.amount
      ),
    }));

    // ==========================================================
    // PAYMENT STATUS ARRAY
    // ==========================================================

    const paymentStatuses =
      Object.values(
        paymentStatusMap
      ).map((item) => ({
        status: item.status,

        count: item.count,

        amount: roundNumber(
          item.amount
        ),
      }));

    // ==========================================================
    // SAVE REPORT
    // ==========================================================

    const report =
      await Report.create({
        reportType: "SALES",

        reportName:
          "Sales Report",

        startDate: start,

        endDate: end,

        totalOrders,

        totalRevenue:
          roundNumber(
            totalRevenue
          ),

        totalDiscount:
          roundNumber(
            totalDiscount
          ),

        totalTax:
          roundNumber(totalTax),

        totalShipping:
          roundNumber(
            totalShipping
          ),

        totalQuantitySold,

        averageOrderValue:
          roundNumber(
            averageOrderValue
          ),

        cancelledOrders,

        refundedAmount:
          roundNumber(
            refundedAmount
          ),

        dailySales,

        orderStatuses,

        paymentStatuses,

        generatedBy:
          req.user?.id ||
          req.user?._id ||
          null,
      });

    // ==========================================================
    // RESPONSE
    // ==========================================================

    return res.status(200).json({
      success: true,

      message:
        "Sales report generated successfully.",

      report,
    });
  } catch (error) {
    console.error(
      "SALES REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to generate sales report.",

      error: error.message,
    });
  }
};

// ============================================================
// CUSTOMER REPORT
// ============================================================

exports.getCustomerReport = async (
  req,
  res
) => {
  try {
    const {
      startDate,
      endDate,
    } = req.query;

    // ----------------------------------------------------------
    // Validate
    // ----------------------------------------------------------

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,

        message:
          "startDate and endDate are required.",
      });
    }

    const {
      start,
      end,
    } = getDateRange(
      startDate,
      endDate
    );

    // ==========================================================
    // TOTAL CUSTOMERS
    // ==========================================================

    const totalCustomers =
      await User.countDocuments({
        role: "customer",
      });

    // ==========================================================
    // NEW CUSTOMERS
    // ==========================================================

    const newCustomers =
      await User.countDocuments({
        role: "customer",

        createdAt: {
          $gte: start,
          $lte: end,
        },
      });

    // ==========================================================
    // ACTIVE CUSTOMERS
    // ==========================================================

    const activeCustomers =
      await User.countDocuments({
        role: "customer",

        isActive: true,
      });

    // ==========================================================
    // INACTIVE CUSTOMERS
    // ==========================================================

    const inactiveCustomers =
      await User.countDocuments({
        role: "customer",

        isActive: false,
      });

    // ==========================================================
    // SAVE REPORT
    // ==========================================================

    const report =
      await Report.create({
        reportType:
          "CUSTOMERS",

        reportName:
          "Customer Report",

        startDate: start,

        endDate: end,

        totalCustomers,

        newCustomers,

        activeCustomers,

        inactiveCustomers,

        generatedBy:
          req.user?.id ||
          req.user?._id ||
          null,
      });

    // ==========================================================
    // RESPONSE
    // ==========================================================

    return res.status(200).json({
      success: true,

      message:
        "Customer report generated successfully.",

      report,
    });
  } catch (error) {
    console.error(
      "CUSTOMER REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to generate customer report.",

      error: error.message,
    });
  }
};

// ============================================================
// GET ALL REPORTS
// ============================================================

exports.getReports = async (
  req,
  res
) => {
  try {
    const {
      reportType,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    // ----------------------------------------------------------
    // Filter report type
    // ----------------------------------------------------------

    if (reportType) {
      query.reportType =
        reportType.toUpperCase();
    }

    // ----------------------------------------------------------
    // Pagination
    // ----------------------------------------------------------

    const pageNumber =
      Number(page);

    const limitNumber =
      Number(limit);

    const skip =
      (pageNumber - 1) *
      limitNumber;

    // ----------------------------------------------------------
    // Reports
    // ----------------------------------------------------------

    const reports =
      await Report.find(query)
        .populate(
          "generatedBy",
          "name email"
        )
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber)
        .lean();

    // ----------------------------------------------------------
    // Count
    // ----------------------------------------------------------

    const total =
      await Report.countDocuments(
        query
      );

    // ----------------------------------------------------------
    // Response
    // ----------------------------------------------------------

    return res.status(200).json({
      success: true,

      reports,

      pagination: {
        page: pageNumber,

        limit: limitNumber,

        total,

        totalPages:
          Math.ceil(
            total /
              limitNumber
          ),
      },
    });
  } catch (error) {
    console.error(
      "GET REPORTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch reports.",

      error: error.message,
    });
  }
};

// ============================================================
// GET REPORT BY ID
// ============================================================

exports.getReportById = async (
  req,
  res
) => {
  try {
    const {
      id,
    } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Invalid report ID.",
      });
    }

    const report =
      await Report.findById(id)
        .populate(
          "generatedBy",
          "name email"
        )
        .lean();

    if (!report) {
      return res.status(404).json({
        success: false,

        message:
          "Report not found.",
      });
    }

    return res.status(200).json({
      success: true,

      report,
    });
  } catch (error) {
    console.error(
      "GET REPORT BY ID ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch report.",

      error: error.message,
    });
  }
};

// ============================================================
// DELETE REPORT
// ============================================================

exports.deleteReport = async (
  req,
  res
) => {
  try {
    const {
      id,
    } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Invalid report ID.",
      });
    }

    const report =
      await Report.findByIdAndDelete(
        id
      );

    if (!report) {
      return res.status(404).json({
        success: false,

        message:
          "Report not found.",
      });
    }

    return res.status(200).json({
      success: true,

      message:
        "Report deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to delete report.",

      error: error.message,
    });
  }
};