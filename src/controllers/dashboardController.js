const User = require("../models/userModel");
const Product = require("../models/productModel");
const ProductVariant = require("../models/productVariantModel");
const Order = require("../models/orderModel");
const OrderItem = require("../models/orderItemModel");
const Banner = require("../models/bannerModel");
const Visitor = require("../models/visitorModel");
const {getDateFilter, getUpdatedDateFilter}  = require("../utils/dateHelper"); 

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const getUserId = (req) => {
  return (
    req.user?.id ||
    req.user?._id ||
    req.user?.userId
  );
};

const getNumber = (obj, fields, defaultValue = 0) => {
  for (const field of fields) {
    if (
      obj &&
      obj[field] !== undefined &&
      obj[field] !== null &&
      !isNaN(Number(obj[field]))
    ) {
      return Number(obj[field]);
    }
  }

  return defaultValue;
};

const getCustomerName = (user) => {
  if (!user) return "Guest";

  return (
    user.name ||
    user.fullName ||
    user.firstName ||
    user.username ||
    user.mobileNumber ||
    "Guest"
  );
};

const getProductName = (product) => {
  if (!product) return "Unknown Product";

  return (
    product.name ||
    product.productName ||
    product.title ||
    "Unknown Product"
  );
};

const getProductImage = (product) => {
  if (!product) return null;

  if (Array.isArray(product.images) && product.images.length > 0) {
    const firstImage = product.images[0];

    if (typeof firstImage === "string") {
      return firstImage;
    }

    return (
      firstImage?.url ||
      firstImage?.imageUrl ||
      firstImage?.secure_url ||
      null
    );
  }

  return (
    product.image ||
    product.imageUrl ||
    product.thumbnail ||
    null
  );
};

// ============================================================
// GET DASHBOARD SUMMARY
// ============================================================

const getDashboardSummary = async (req, res) => {
  try {
    const [
      totalOrders,
      totalCustomers,
      totalProducts,
      totalVisitors,
      orders
    ] = await Promise.all([
      Order.countDocuments({
        isDeleted: { $ne: true }
      }),

      User.countDocuments({
        isDeleted: { $ne: true }
      }),

      Product.countDocuments({
        isDeleted: { $ne: true }
      }),

      Visitor.countDocuments({
        isDeleted: { $ne: true }
      }),

      Order.find({
        isDeleted: { $ne: true }
      }).lean()
    ]);

    // --------------------------------------------------------
    // Calculate total sales
    // --------------------------------------------------------

    const completedStatuses = [
      "CONFIRMED",
      "PROCESSING",
      "PACKED",
      "SHIPPED",
      "DELIVERED",
      "COMPLETED"
    ];

    const totalSales = orders.reduce((total, order) => {
      const status = String(
        order.orderStatus ||
        order.status ||
        ""
      ).toUpperCase();

      if (!completedStatuses.includes(status)) {
        return total;
      }

      const amount = getNumber(
        order,
        [
          "grandTotal",
          "finalAmount",
          "totalAmount",
          "amount",
          "total"
        ]
      );

      return total + amount;
    }, 0);

    res.status(200).json({
      success: true,
      data: {
        totalSales,
        totalOrders,
        totalCustomers,
        totalProducts
      }
    });

  } catch (error) {
    console.error(
      "GET DASHBOARD SUMMARY ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard summary",
      error: error.message
    });
  }
};

// ============================================================
// SALES OVERVIEW
// ============================================================

const getSalesOverview = async (req, res) => {
  try {
    const range = String(req.query.range || "today").toLowerCase();
    const { fromDate, toDate } = req.query;

    const allowedRanges = ["today", "week", "month", "custom"];

    if (!allowedRanges.includes(range)) {
      return res.status(400).json({
        success: false,
        message: "Invalid range. Use today, week, month or custom.",
      });
    }

    if (
      (fromDate && !toDate) ||
      (!fromDate && toDate) ||
      (range === "custom" && (!fromDate || !toDate))
    ) {
      return res.status(400).json({
        success: false,
        message: "Both fromDate and toDate are required.",
      });
    }

    const now = new Date();

    // Format a Date as a calendar date in India Standard Time.
    const formatISTDate = (date) => {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
    };

    const isValidDateString = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
        return false;
      }

      const date = new Date(`${value}T00:00:00+05:30`);

      return (
        !Number.isNaN(date.getTime()) &&
        formatISTDate(date) === value
      );
    };

    let startKey;
    let endKey;

    // Prefer the exact dates selected by the frontend.
    if (fromDate && toDate) {
      if (
        !isValidDateString(fromDate) ||
        !isValidDateString(toDate) ||
        fromDate > toDate
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid date range.",
        });
      }

      startKey = fromDate;
      endKey = toDate;
    } else {
      // Backward-compatible defaults when dates aren't supplied.
      const today = formatISTDate(now);
      const [year, month, day] = today.split("-").map(Number);

      if (range === "today") {
        startKey = today;
        endKey = today;
      } else if (range === "week") {
        const start = new Date(year, month - 1, day);
        const daysSinceMonday = (start.getDay() + 6) % 7;

        start.setDate(start.getDate() - daysSinceMonday);

        startKey = [
          start.getFullYear(),
          String(start.getMonth() + 1).padStart(2, "0"),
          String(start.getDate()).padStart(2, "0"),
        ].join("-");

        endKey = today;
      } else {
        startKey = `${year}-${String(month).padStart(2, "0")}-01`;
        endKey = today;
      }
    }

    // Interpret date inputs as IST midnight.
    const startDate = new Date(`${startKey}T00:00:00+05:30`);

    // Exclusive end: midnight after the selected end date.
    const endExclusive = new Date(
      new Date(`${endKey}T00:00:00+05:30`).getTime() +
        24 * 60 * 60 * 1000
    );

    const orders = await Order.find({
      isDeleted: { $ne: true },
      createdAt: {
        $gte: startDate,
        $lt: endExclusive,
      },
      orderStatus: {
        $nin: ["CANCELLED", "FAILED", "REFUNDED"],
      },
    }).lean();

    // TODAY: hourly sales in IST.
    if (range === "today") {
      const hourlySales = Array.from(
        { length: 24 },
        (_, hour) => ({
          hour,
          label: `${String(hour).padStart(2, "0")}:00`,
          sales: 0,
        })
      );

      orders.forEach((order) => {
        const date = new Date(order.createdAt);

        const hour = Number(
          new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            hourCycle: "h23",
          }).format(date)
        );

        const amount = getNumber(order, ["totalAmount"]);

        if (hour >= 0 && hour < 24) {
          hourlySales[hour].sales += amount;
        }
      });

      return res.status(200).json({
        success: true,
        range,
        fromDate: startKey,
        toDate: endKey,
        data: hourlySales,
      });
    }

    // WEEK, MONTH and CUSTOM: daily sales.
    // Generate every calendar date, including dates with zero sales.
    const dailySales = {};

    const cursor = new Date(`${startKey}T00:00:00+05:30`);
    const lastDate = new Date(`${endKey}T00:00:00+05:30`);

    while (cursor <= lastDate) {
      const key = formatISTDate(cursor);

      dailySales[key] = {
        date: key,
        sales: 0,
      };

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    orders.forEach((order) => {
      const key = formatISTDate(new Date(order.createdAt));

      if (dailySales[key]) {
        dailySales[key].sales += getNumber(order, ["totalAmount"]);
      }
    });

    return res.status(200).json({
      success: true,
      range,
      fromDate: startKey,
      toDate: endKey,
      data: Object.values(dailySales),
    });
  } catch (error) {
    console.error("GET SALES OVERVIEW ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sales overview",
      error: error.message,
    });
  }
};

// ============================================================
// RECENT ORDERS
// ============================================================

const getRecentOrders = async (req, res) => {
  try {
    const limit = Number(
      req.query.limit || 5
    );

    const orders = await Order.find({
      isDeleted: { $ne: true }
    })
      .populate(
        "user",
        "name fullName firstName mobileNumber"
      )
      .sort({
        createdAt: -1
      })
      .limit(limit)
      .lean();

    const formattedOrders = orders.map(
      (order) => ({
        orderId:
          order.orderNumber ||
          order.orderId ||
          `#${String(order._id).slice(-6).toUpperCase()}`,

        customer: getCustomerName(
          order.user
        ),

        amount: getNumber(
          order,
          [
            "grandTotal",
            "finalAmount",
            "totalAmount",
            "amount",
            "total"
          ]
        ),

        status:
          order.orderStatus ||
          order.status ||
          "PENDING",

        createdAt: order.createdAt
      })
    );

    res.status(200).json({
      success: true,
      count: formattedOrders.length,
      data: formattedOrders
    });

  } catch (error) {
    console.error(
      "GET RECENT ORDERS ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch recent orders",
      error: error.message
    });
  }
};

// ============================================================
// TOP SELLING PRODUCTS
// ============================================================

const getTopSellingProducts = async (req, res) => {
  try {
    const limit = Number(
      req.query.limit || 5
    );

    const orderItems = await OrderItem.find()
      .populate(
        "product",
        "name productName title images image imageUrl thumbnail"
      )
      .populate(
        "order",
        "orderStatus status"
      )
      .lean();

    const productMap = {};

    orderItems.forEach((item) => {
      const order = item.order;

      if (!order) return;

      const status = String(
        order.orderStatus ||
        order.status ||
        ""
      ).toUpperCase();

      if (
        [
          "CANCELLED",
          "FAILED",
          "REFUNDED"
        ].includes(status)
      ) {
        return;
      }

      const product = item.product;

      if (!product) return;

      const productId =
        String(product._id);

      const quantity = getNumber(
        item,
        [
          "quantity",
          "qty"
        ],
        1
      );

      const price = getNumber(
        item,
        [
          "totalPrice",
          "subtotal",
          "price",
          "unitPrice"
        ]
      );

      if (!productMap[productId]) {
        productMap[productId] = {
          productId,
          product:
            getProductName(product),
          image:
            getProductImage(product),
          sold: 0,
          revenue: 0
        };
      }

      productMap[productId].sold += quantity;

      if (
        item.totalPrice !== undefined ||
        item.subtotal !== undefined
      ) {
        productMap[productId].revenue += price;
      } else {
        productMap[productId].revenue +=
          price * quantity;
      }
    });

    const products = Object.values(
      productMap
    )
      .sort(
        (a, b) =>
          b.sold - a.sold
      )
      .slice(0, limit);

    res.status(200).json({
      success: true,
      data: products
    });

  } catch (error) {
    console.error(
      "GET TOP SELLING PRODUCTS ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to fetch top selling products",
      error: error.message
    });
  }
};

// ============================================================
// INVENTORY STATUS
// ============================================================

const getInventoryStatus = async (req, res) => {
  try {
    const variants =
      await ProductVariant.find()
        .lean();

    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;

    const LOW_STOCK_LIMIT = 10;

    variants.forEach((variant) => {
      const stock = getNumber(
        variant,
        [
          "stockQuantity",
          "quantity",
          "stock",
          "availableStock",
          "inventory"
        ]
      );

      if (stock <= 0) {
        outOfStock++;
      }

      else if (
        stock <= LOW_STOCK_LIMIT
      ) {
        lowStock++;
      }

      else {
        inStock++;
      }
    });

    const total =
      inStock +
      lowStock +
      outOfStock;

    res.status(200).json({
      success: true,

      data: {
        totalProducts: total,

        inStock: {
          count: inStock,
          percentage:
            total > 0
              ? Number(
                  (
                    (inStock / total) *
                    100
                  ).toFixed(1)
                )
              : 0
        },

        lowStock: {
          count: lowStock,
          percentage:
            total > 0
              ? Number(
                  (
                    (lowStock / total) *
                    100
                  ).toFixed(1)
                )
              : 0
        },

        outOfStock: {
          count: outOfStock,
          percentage:
            total > 0
              ? Number(
                  (
                    (outOfStock / total) *
                    100
                  ).toFixed(1)
                )
              : 0
        }
      }
    });

  } catch (error) {
    console.error(
      "GET INVENTORY STATUS ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to fetch inventory status",
      error: error.message
    });
  }
};

// ============================================================
// RECENT ACTIVITIES
// ============================================================

const getRecentActivities = async (req, res) => {
  try {
    const limit = Number(
      req.query.limit || 10
    );

    // --------------------------------------------------------
    // Recent orders
    // --------------------------------------------------------

    const recentOrders = await Order.find({
      isDeleted: { $ne: true }
    })
      .sort({
        createdAt: -1
      })
      .limit(5)
      .lean();

    // --------------------------------------------------------
    // Recent products
    // --------------------------------------------------------

    const recentProducts =
      await Product.find({
        isDeleted: { $ne: true }
      })
        .sort({
          updatedAt: -1
        })
        .limit(5)
        .lean();

    // --------------------------------------------------------
    // Recent customers
    // --------------------------------------------------------

    const recentCustomers =
      await User.find({
        isDeleted: { $ne: true }
      })
        .sort({
          createdAt: -1
        })
        .limit(5)
        .lean();

    // --------------------------------------------------------
    // Recent banners
    // --------------------------------------------------------

    const recentBanners =
      await Banner.find()
        .sort({
          updatedAt: -1
        })
        .limit(5)
        .lean();

    const activities = [];

    // --------------------------------------------------------
    // ORDER ACTIVITIES
    // --------------------------------------------------------

    recentOrders.forEach((order) => {
      const orderId =
        order.orderNumber ||
        order.orderId ||
        `#${String(order._id)
          .slice(-6)
          .toUpperCase()}`;

      activities.push({
        type: "ORDER",
        icon: "shopping-bag",

        message:
          `New order received ${orderId}`,

        createdAt:
          order.createdAt
      });
    });

    // --------------------------------------------------------
    // PRODUCT ACTIVITIES
    // --------------------------------------------------------

    recentProducts.forEach((product) => {
      activities.push({
        type: "PRODUCT",
        icon: "package",

        message:
          `Product "${getProductName(
            product
          )}" updated`,

        createdAt:
          product.updatedAt ||
          product.createdAt
      });
    });

    // --------------------------------------------------------
    // CUSTOMER ACTIVITIES
    // --------------------------------------------------------

    recentCustomers.forEach((user) => {
      activities.push({
        type: "CUSTOMER",
        icon: "users",

        message:
          `New customer registered: ${getCustomerName(
            user
          )}`,

        createdAt:
          user.createdAt
      });
    });

    // --------------------------------------------------------
    // BANNER ACTIVITIES
    // --------------------------------------------------------

    recentBanners.forEach((banner) => {
      const bannerName =
        banner.title ||
        banner.name ||
        banner.bannerName ||
        "Banner";

      activities.push({
        type: "BANNER",
        icon: "image",

        message:
          `Banner "${bannerName}" activated`,

        createdAt:
          banner.updatedAt ||
          banner.createdAt
      });
    });

    // --------------------------------------------------------
    // SORT
    // --------------------------------------------------------

    activities.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

    const result =
      activities.slice(0, limit);

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error(
      "GET RECENT ACTIVITIES ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to fetch recent activities",
      error: error.message
    });
  }
};

// ============================================================
// COMPLETE DASHBOARD
// ============================================================

const getDashboard = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    // Custom range must contain both dates.
    if ((fromDate && !toDate) || (!fromDate && toDate)) {
      return res.status(400).json({
        success: false,
        message: "Both fromDate and toDate are required",
      });
    }

    if (
      fromDate &&
      toDate &&
      (
        !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(toDate) ||
        fromDate > toDate
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date range",
      });
    }

    const [
      summary,
      recentOrders,
      topProducts,
      inventory,
      activities,
    ] = await Promise.all([
      getSummaryData(fromDate, toDate),
      getRecentOrdersData(fromDate, toDate),
      getTopProductsData(fromDate, toDate),
      getInventoryData(fromDate, toDate),
      getActivitiesData(fromDate, toDate),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        summary,
        recentOrders,
        topSellingProducts: topProducts,
        inventory,
        recentActivities: activities,
      },
    });
  } catch (error) {
    console.error("GET COMPLETE DASHBOARD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard",
      error: error.message,
    });
  }
};

// ============================================================
// INTERNAL SUMMARY FUNCTION
// ============================================================

const getSummaryData = async (fromDate, toDate) => {
  const dateFilter = getDateFilter(fromDate, toDate);


  const completedStatuses = [
    "CONFIRMED",
    "PROCESSING",
    "PACKED",
    "SHIPPED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "COMPLETED",
  ];

  const [
    visitorIds,
    totalOrders,
    totalCustomers,
    totalProducts,
    orders,
    newCustomers,
  ] = await Promise.all([
    // Unique visitors during the selected period.
    Visitor.distinct("guestId", {
      ...dateFilter,
      guestId: { $exists: true, $nin: ["", null] },
      path: { $not: /^\/admin(?:\/|$)/ },
    }),

    // Total non-deleted orders during the selected period.
    Order.countDocuments({
      isDeleted: { $ne: true },
      ...dateFilter,
    }),

    // Total customers overall.
    User.countDocuments({
      isDeleted: { $ne: true },
    }),

    // Total products overall.
    Product.countDocuments({
      isDeleted: { $ne: true },
    }),

    // Fetch orders and populate referenced OrderItem documents.
    Order.find({
      isDeleted: { $ne: true },
      ...dateFilter,
    })
      .populate("items")
      .lean(),

    // Newly registered users during the selected period.
    User.countDocuments({
      isDeleted: { $ne: true },
      ...dateFilter,
    }),
  ]);

  // Select eligible orders for sales calculations.
  const completedOrders = orders.filter((order) => {
    const status = String(
      order.orderStatus || order.status || ""
    ).toUpperCase();

    return completedStatuses.includes(status);
  });

  // Total sales from eligible orders.
  const totalSales = completedOrders.reduce((total, order) => {
    return total + (Number(order.totalAmount) || 0);
  }, 0);

  // Total units sold from populated OrderItem documents.
  const totalProductsSold = completedOrders.reduce(
    (total, order) => {
      const items = Array.isArray(order.items) ? order.items : [];

      const orderQuantity = items.reduce((sum, item) => {
        // Ignore missing or invalid item references.
        if (!item || typeof item !== "object") {
          return sum;
        }

        return sum + (Number(item.quantity) || 0);
      }, 0);

      return total + orderQuantity;
    },
    0
  );

  // Average sale value per eligible order.
  const averageSaleValue =
    completedOrders.length > 0
      ? Math.round(
          (totalSales / completedOrders.length) * 100
        ) / 100
      : 0;

  return {
    totalVisitors: visitorIds.length,
    totalOrders,
    totalSales: Math.round(totalSales * 100) / 100,
    totalCustomers,
    totalProducts,
    totalProductsSold,
    newCustomers,
    averageSaleValue,
  };
};



// ============================================================
// INTERNAL RECENT ORDERS
// ============================================================

const getRecentOrdersData = async (fromDate, toDate) => {
  const dateFilter = getDateFilter(fromDate, toDate);

  const orders = await Order.find({
    isDeleted: { $ne: true },
    ...dateFilter
  })
    .populate(
      "user",
      "name fullName firstName mobileNumber"
    )
    .sort({
      createdAt: -1
    })
    .limit(5)
    .lean();

  return orders.map((order) => ({
    orderId:
      order.orderNumber ||
      order.orderId ||
      `#${String(order._id)
        .slice(-6)
        .toUpperCase()}`,

    customer:
      getCustomerName(order.user),

    amount:
      getNumber(
        order,
        [
          "grandTotal",
          "finalAmount",
          "totalAmount",
          "amount",
          "total"
        ]
      ),

    status:
      order.orderStatus ||
      order.status ||
      "PENDING",

    createdAt:
      order.createdAt
  }));
};

// ============================================================
// INTERNAL TOP PRODUCTS
// ============================================================

const getTopProductsData = async (fromDate, toDate) => {
  const dateFilter = getDateFilter(fromDate, toDate);

  const orderItems =
    await OrderItem.find({
      ...dateFilter
    })
      .populate(
        "product",
        "name productName title images image imageUrl thumbnail"
      )
      .populate(
        "order",
        "orderStatus status"
      )
      .lean();

  const productMap = {};

  orderItems.forEach((item) => {
    const order = item.order;

    if (!order || !item.product) {
      return;
    }

    const status = String(
      order.orderStatus ||
      order.status ||
      ""
    ).toUpperCase();

    if (
      [
        "CANCELLED",
        "FAILED",
        "REFUNDED"
      ].includes(status)
    ) {
      return;
    }

    const product = item.product;
    const id = String(product._id);

    const quantity = getNumber(
      item,
      ["quantity", "qty"],
      1
    );

    const price = getNumber(
      item,
      [
        "totalPrice",
        "subtotal",
        "price",
        "unitPrice"
      ]
    );

    if (!productMap[id]) {
      productMap[id] = {
        productId: id,
        product:
          getProductName(product),
        image:
          getProductImage(product),
        sold: 0,
        revenue: 0
      };
    }

    productMap[id].sold += quantity;

    if (
      item.totalPrice !== undefined ||
      item.subtotal !== undefined
    ) {
      productMap[id].revenue += price;
    } else {
      productMap[id].revenue +=
        price * quantity;
    }
  });

  return Object.values(productMap)
    .sort(
      (a, b) =>
        b.sold - a.sold
    )
    .slice(0, 5);
};

// ============================================================
// INTERNAL INVENTORY
// ============================================================

const getInventoryData = async (fromDate, toDate) => {
  const dateFilter = getDateFilter(fromDate, toDate);

  const variants =
    await ProductVariant.find(dateFilter)
      .lean();

  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;

  variants.forEach((variant) => {
    const stock = getNumber(
      variant,
      [
        "stockQuantity",
        "quantity",
        "stock",
        "availableStock",
        "inventory"
      ]
    );

    if (stock <= 0) {
      outOfStock++;
    } else if (stock <= 10) {
      lowStock++;
    } else {
      inStock++;
    }
  });

  const total =
    inStock +
    lowStock +
    outOfStock;

  return {
    totalProducts: total,

    inStock: {
      count: inStock,
      percentage:
        total
          ? Number(
              (
                (inStock / total) *
                100
              ).toFixed(1)
            )
          : 0
    },

    lowStock: {
      count: lowStock,
      percentage:
        total
          ? Number(
              (
                (lowStock / total) *
                100
              ).toFixed(1)
            )
          : 0
    },

    outOfStock: {
      count: outOfStock,
      percentage:
        total
          ? Number(
              (
                (outOfStock / total) *
                100
              ).toFixed(1)
            )
          : 0
    }
  };
};

// ============================================================
// INTERNAL ACTIVITIES
// ============================================================

const getActivitiesData = async (fromDate, toDate) => {
  const dateFilter = getDateFilter(fromDate, toDate);

  const [
    orders,
    products,
    customers,
    banners
  ] = await Promise.all([
    Order.find({
      isDeleted: { $ne: true },
      ...dateFilter
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),

    Product.find({
      isDeleted: { $ne: true },
      ...getUpdatedDateFilter(fromDate, toDate)
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),

    User.find({
      isDeleted: { $ne: true },
      ...dateFilter
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),

    Banner.find({
      ...getUpdatedDateFilter(fromDate, toDate)
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean()
  ]);

  const activities = [];

  orders.forEach((order) => {
    const orderId =
      order.orderNumber ||
      order.orderId ||
      `#${String(order._id)
        .slice(-6)
        .toUpperCase()}`;

    activities.push({
      type: "ORDER",
      icon: "shopping-bag",
      message:
        `New order received ${orderId}`,
      createdAt:
        order.createdAt
    });
  });

  products.forEach((product) => {
    activities.push({
      type: "PRODUCT",
      icon: "package",
      message:
        `Product "${getProductName(
          product
        )}" updated`,
      createdAt:
        product.updatedAt ||
        product.createdAt
    });
  });

  customers.forEach((user) => {
    activities.push({
      type: "CUSTOMER",
      icon: "users",
      message:
        `New customer registered: ${getCustomerName(
          user
        )}`,
      createdAt:
        user.createdAt
    });
  });

  banners.forEach((banner) => {
    const name =
      banner.title ||
      banner.name ||
      banner.bannerName ||
      "Banner";

    activities.push({
      type: "BANNER",
      icon: "image",
      message:
        `Banner "${name}" activated`,
      createdAt:
        banner.updatedAt ||
        banner.createdAt
    });
  });

  return activities
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    )
    .slice(0, 10);
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getDashboard,
  getDashboardSummary,
  getSalesOverview,
  getRecentOrders,
  getTopSellingProducts,
  getInventoryStatus,
  getRecentActivities
};