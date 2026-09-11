const User = require("../models/userModel");
const Product = require("../models/productModel");
const ProductVariant = require("../models/productVariantModel");
const Order = require("../models/orderModel");
const OrderItem = require("../models/orderItemModel");
const Banner = require("../models/bannerModel");

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
    const range = (
      req.query.range || "today"
    ).toLowerCase();

    const now = new Date();

    let startDate;
    let endDate = new Date(now);

    // --------------------------------------------------------
    // TODAY
    // --------------------------------------------------------

    if (range === "today") {
      startDate = new Date(now);

      startDate.setHours(
        0,
        0,
        0,
        0
      );

    }

    // --------------------------------------------------------
    // WEEK
    // --------------------------------------------------------

    else if (range === "week") {
      startDate = new Date(now);

      startDate.setDate(
        now.getDate() - 6
      );

      startDate.setHours(
        0,
        0,
        0,
        0
      );
    }

    // --------------------------------------------------------
    // MONTH
    // --------------------------------------------------------

    else if (range === "month") {
      startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

    }

    else {
      return res.status(400).json({
        success: false,
        message:
          "Invalid range. Use today, week or month."
      });
    }

    const orders = await Order.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate
      },

      isDeleted: {
        $ne: true
      },

      orderStatus: {
        $nin: [
          "CANCELLED",
          "FAILED",
          "REFUNDED"
        ]
      }
    }).lean();

    // --------------------------------------------------------
    // TODAY = HOURLY DATA
    // --------------------------------------------------------

    if (range === "today") {
      const hourlySales = {};

      for (let hour = 0; hour < 24; hour++) {
        hourlySales[hour] = 0;
      }

      orders.forEach((order) => {
        const date = new Date(order.createdAt);

        const hour = date.getHours();

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

        hourlySales[hour] += amount;
      });

      const sales = Object.keys(hourlySales).map(
        (hour) => ({
          hour: Number(hour),
          label: `${hour}:00`,
          sales: hourlySales[hour]
        })
      );

      return res.status(200).json({
        success: true,
        range,
        data: sales
      });
    }

    // --------------------------------------------------------
    // WEEK = DAILY DATA
    // --------------------------------------------------------

    if (range === "week") {
      const dailySales = {};

      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);

        date.setDate(
          startDate.getDate() + i
        );

        const key =
          date.toISOString().split("T")[0];

        dailySales[key] = {
          date: key,
          sales: 0
        };
      }

      orders.forEach((order) => {
        const date = new Date(order.createdAt);

        const key =
          date.toISOString().split("T")[0];

        if (dailySales[key]) {
          dailySales[key].sales += getNumber(
            order,
            [
              "grandTotal",
              "finalAmount",
              "totalAmount",
              "amount",
              "total"
            ]
          );
        }
      });

      return res.status(200).json({
        success: true,
        range,
        data: Object.values(dailySales)
      });
    }

    // --------------------------------------------------------
    // MONTH = DAILY DATA
    // --------------------------------------------------------

    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();

    const monthlySales = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth(),
        day
      );

      const key =
        date.toISOString().split("T")[0];

      monthlySales[key] = {
        date: key,
        sales: 0
      };
    }

    orders.forEach((order) => {
      const date = new Date(order.createdAt);

      const key =
        date.toISOString().split("T")[0];

      if (monthlySales[key]) {
        monthlySales[key].sales += getNumber(
          order,
          [
            "grandTotal",
            "finalAmount",
            "totalAmount",
            "amount",
            "total"
          ]
        );
      }
    });

    res.status(200).json({
      success: true,
      range,
      data: Object.values(monthlySales)
    });

  } catch (error) {
    console.error(
      "GET SALES OVERVIEW ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch sales overview",
      error: error.message
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
    const [
      summary,
      recentOrders,
      topProducts,
      inventory,
      activities
    ] = await Promise.all([
      getSummaryData(),
      getRecentOrdersData(),
      getTopProductsData(),
      getInventoryData(),
      getActivitiesData()
    ]);

    res.status(200).json({
      success: true,

      data: {
        summary,
        recentOrders,
        topSellingProducts: topProducts,
        inventory,
        recentActivities: activities
      }
    });

  } catch (error) {
    console.error(
      "GET COMPLETE DASHBOARD ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard",
      error: error.message
    });
  }
};

// ============================================================
// INTERNAL SUMMARY FUNCTION
// ============================================================

const getSummaryData = async () => {
  const [
    totalOrders,
    totalCustomers,
    totalProducts,
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

    Order.find({
      isDeleted: { $ne: true }
    }).lean()
  ]);

  const completedStatuses = [
    "CONFIRMED",
    "PROCESSING",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
    "COMPLETED"
  ];

  const totalSales = orders.reduce(
    (total, order) => {
      const status = String(
        order.orderStatus ||
        order.status ||
        ""
      ).toUpperCase();

      if (
        !completedStatuses.includes(status)
      ) {
        return total;
      }

      return (
        total +
        getNumber(
          order,
          [
            "grandTotal",
            "finalAmount",
            "totalAmount",
            "amount",
            "total"
          ]
        )
      );
    },
    0
  );

  return {
    totalSales,
    totalOrders,
    totalCustomers,
    totalProducts
  };
};

// ============================================================
// INTERNAL RECENT ORDERS
// ============================================================

const getRecentOrdersData = async () => {
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

const getTopProductsData = async () => {
  const orderItems =
    await OrderItem.find()
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

const getInventoryData = async () => {
  const variants =
    await ProductVariant.find()
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

const getActivitiesData = async () => {
  const [
    orders,
    products,
    customers,
    banners
  ] = await Promise.all([
    Order.find({
      isDeleted: { $ne: true }
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),

    Product.find({
      isDeleted: { $ne: true }
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),

    User.find({
      isDeleted: { $ne: true }
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),

    Banner.find()
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