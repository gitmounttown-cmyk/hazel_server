// const express = require("express");

// const router = express.Router();

// const {
//   createProductVariant,
//   getProductVariants,
//   getProductVariantById,
//   updateProductVariant,
//   deleteProductVariant,
//   restoreProductVariant,
//   updateVariantStock,
//   setDefaultVariant,
// } = require("../controllers/productVariantController");

// const {
//   uploadProductVariantImage,
// } = require("../middleware/uploadMiddleware");


// // ============================================================
// // CREATE VARIANT
// // POST /api/product-variants/create
// // ============================================================

// router.post(
//   "/create",
//   uploadProductVariantImage.array("images", 10),
//   createProductVariant
// );


// // ============================================================
// // GET ALL VARIANTS
// // GET /api/product-variants/all
// // ============================================================

// router.get(
//   "/all",
//   getProductVariants
// );


// // ============================================================
// // GET VARIANT BY ID
// // GET /api/product-variants/:id
// // ============================================================

// router.get(
//   "/:id",
//   getProductVariantById
// );


// // ============================================================
// // UPDATE VARIANT
// // PUT /api/product-variants/update/:id
// // ============================================================

// router.put(
//   "/update/:id",
//   uploadProductVariantImage.array("images", 10),
//   updateProductVariant
// );


// // ============================================================
// // DELETE / DEACTIVATE VARIANT
// // DELETE /api/product-variants/delete/:id
// // ============================================================

// router.delete(
//   "/delete/:id",
//   deleteProductVariant
// );


// // ============================================================
// // UPDATE STOCK
// // PATCH /api/product-variants/:id/stock
// // ============================================================

// // router.patch(
// //   "/:id/stock",
// //   updateVariantStock
// // );


// // ============================================================
// // SET DEFAULT VARIANT
// // PATCH /api/product-variants/:id/default
// // ============================================================

// // router.patch(
// //   "/:id/default",
// //   setDefaultVariant
// // );


// module.exports = router;