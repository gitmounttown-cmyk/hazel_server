const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// ==========================================================
// MIDDLEWARE
// ==========================================================

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use(
  "/api/payments/webhook",
  express.raw({
    type: "application/json",
  })
);

// ==========================================================
// STATIC UPLOADS
// ==========================================================

app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"))
);
// ==========================================================
// ROOT API
// ==========================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Hazel Ecommerce API is running",
  });
});

// ==========================================================
// AUTH
// ==========================================================

app.use(
  "/api/auth",
  require("./src/routes/authRoutes")
);

// ==========================================================
// MASTER DATA
// ==========================================================

app.use(
  "/api/categories",
  require("./src/routes/categoryRoutes")
);

app.use(
  "/api/subcategories",
  require("./src/routes/subCategoryRoutes")
);

app.use(
  "/api/brands",
  require("./src/routes/brandRoutes")
);

app.use(
  "/api/lengths",
  require("./src/routes/lengthRoutes")
);

app.use(
  "/api/neck-patterns",
  require("./src/routes/neckPatternRoutes")
);

app.use(
  "/api/size",
  require("./src/routes/sizeRoutes")
);

app.use(
  "/api/colors",
  require("./src/routes/colorRoutes")
);

// ==========================================================
// PRODUCTS
// ==========================================================

app.use(
  "/api/products",
  require("./src/routes/productRoutes")
);

// Product variants currently disabled
// app.use(
//   "/api/product-variants",
//   require("./src/routes/productVariantRoutes")
// );

// ==========================================================
// CUSTOMER
// ==========================================================

app.use(
  "/api/cart",
  require("./src/routes/cartRoutes")
);

app.use(
  "/api/wishlist",
  require("./src/routes/wishlistRoutes")
);

app.use(
  "/api/locations",
  require("./src/routes/locationRoutes")
);

app.use(
  "/api/addresses",
  require("./src/routes/addressRoutes")
);

// ==========================================================
// ORDERS & PAYMENTS
// ==========================================================

app.use(
  "/api/orders",
  require("./src/routes/orderRoutes")
);

app.use(
  "/api/payments",
  require("./src/routes/paymentRoutes")
);

app.use(
  "/api/coupons",
  require("./src/routes/couponRoutes")
);

// ==========================================================
// REVIEWS
// ==========================================================

app.use(
  "/api/reviews",
  require("./src/routes/reviewRoutes")
);

// ==========================================================
// MERCHANDISING
// ==========================================================

app.use(
  "/api/banners",
  require("./src/routes/bannerRoutes")
);

app.use(
  "/api/banner-products",
  require("./src/routes/bannerProductRoutes")
);

app.use(
  "/api/newArrivals",
  require("./src/routes/newArrivalRoutes")
);

app.use(
  "/api/trending-products",
  require("./src/routes/trendingProductRoutes")
);

// ==========================================================
// NOTIFICATIONS
// ==========================================================

app.use(
  "/api/notifications",
  require("./src/routes/notificationRoutes")
);

// ==========================================================
// DASHBOARD
// ==========================================================

app.use(
  "/api/dashboard",
  require("./src/routes/dashboardRoutes")
);
app.use("/api/similar-products",require("./src/routes/similarProductRoutes"));
app.use("/api/inventory",require("./src/routes/inventoryRoutes"));
app.use("/api/stock-history",require("./src/routes/stockHistoryRoutes"));
app.use("/api/customers",require("./src/routes/customerRoutes"));
// ==========================================================
// 404 HANDLER
// ==========================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ==========================================================
// GLOBAL ERROR HANDLER
// ==========================================================

app.use((err, req, res, next) => {
  console.error("Global Error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;