const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const SizeChart = require("../models/sizeChartModel");
const Product = require("../models/productModel");
const { deleteFileByUrl } = require("../middleware/uploadMiddleware");

// ============================================================
// HELPER: NORMALIZE SIZE FOR ACCURATE MATCHING
// (e.g. 2XL <-> XXL, 3XL <-> XXXL)
// ============================================================
const normalizeSize = (s) => {
  if (!s) return "";
  const clean = String(s).trim().toUpperCase();
  if (clean === "2XL") return "XXL";
  if (clean === "3XL") return "XXXL";
  return clean;
};

// ============================================================
// HELPER: GET IMAGE URL
// ============================================================
const getImageURL = (file) => {
  if (!file) return null;
  return `/uploads/size-charts/${file.filename}`;
};

// ============================================================
// HELPER: PROCESS UPLOADED FILES FOR SIZE CHART & SECTIONS
// Supports multiple images for sections (TOP, BOTTOM, etc.) and up to 5 main diagram images
// ============================================================
const processUploadedFiles = (req) => {
  const files = req.files || (req.file ? [req.file] : []);
  const result = {
    mainImages: [],
    tableImages: {}, // tableIndex -> array of string URLs
  };

  if (!Array.isArray(files)) return result;

  files.forEach((file) => {
    const fileUrl = `/uploads/size-charts/${file.filename}`;
    const fieldname = file.fieldname || "";

    // Matches section-specific images: table_0_images, table_0_image, section_0_images, etc.
    const match = fieldname.match(/(?:table|section)(?:_images)?_(\d+)(?:_images?)?/i);
    if (match) {
      const tableIndex = parseInt(match[1], 10);
      if (!result.tableImages[tableIndex]) {
        result.tableImages[tableIndex] = [];
      }
      result.tableImages[tableIndex].push(fileUrl);
    } else {
      // Main guide/diagram images (e.g. image, images, mainImage, mainImages, diagram_images)
      result.mainImages.push(fileUrl);
    }
  });

  return result;
};

const cleanupUploadedFiles = (req) => {
  const files = req.files || (req.file ? [req.file] : []);
  if (Array.isArray(files)) {
    files.forEach((f) => {
      deleteFileByUrl(`/uploads/size-charts/${f.filename}`);
    });
  }
};

// ============================================================
// CREATE SIZE CHART
// POST /api/size-charts/create
// ============================================================
exports.createSizeChart = async (req, res) => {
  try {
    const {
      name,
      productId,
      categoryId,
      unit = "inches",
      description = "All measurements are in inches",
      tables,
      isActive = true,
    } = req.body;

    if (!name || !name.trim()) {
      cleanupUploadedFiles(req);
      return res.status(400).json({
        success: false,
        message: "Size chart name is required",
      });
    }

    const uploaded = processUploadedFiles(req);

    // Parse tables if passed as JSON string (multipart/form-data)
    let parsedTables = [];
    if (tables) {
      parsedTables = typeof tables === "string" ? JSON.parse(tables) : tables;
    }

    // Format and sanitize tables structure
    if (Array.isArray(parsedTables)) {
      parsedTables = parsedTables.map((t, idx) => {
        let existingImages = [];
        if (Array.isArray(t.images)) {
          existingImages = t.images.filter((img) => typeof img === "string" && img.trim());
        } else if (t.image && typeof t.image === "string" && t.image.trim()) {
          existingImages = [t.image.trim()];
        }

        const newTableImages = uploaded.tableImages[idx] || [];
        const combinedImages = [...existingImages, ...newTableImages];
        const primaryImage = combinedImages[0] || t.image || "";

        return {
          tableName: (t.tableName || "STANDARD").toUpperCase().trim(),
          image: primaryImage,
          images: combinedImages,
          sizes: Array.isArray(t.sizes)
            ? t.sizes.map((s) => String(s).trim().toUpperCase()).filter(Boolean)
            : [],
          rows: Array.isArray(t.rows)
            ? t.rows.map((r) => ({
                parameter: (r.parameter || "").toUpperCase().trim(),
                values: r.values && typeof r.values === "object" ? r.values : {},
              }))
            : [],
        };
      });
    }

    // Parse existing main diagram images
    let existingMainImages = [];
    const rawExisting = req.body.existingImages || req.body.images;
    if (Array.isArray(rawExisting)) {
      existingMainImages = rawExisting.filter((img) => typeof img === "string" && img.trim());
    } else if (typeof rawExisting === "string" && rawExisting.trim()) {
      try {
        const parsed = JSON.parse(rawExisting);
        if (Array.isArray(parsed)) {
          existingMainImages = parsed.filter((img) => typeof img === "string" && img.trim());
        } else {
          existingMainImages = [rawExisting.trim()];
        }
      } catch {
        existingMainImages = [rawExisting.trim()];
      }
    }
    if (req.body.image && typeof req.body.image === "string" && req.body.image.trim()) {
      if (!existingMainImages.includes(req.body.image.trim())) {
        existingMainImages.unshift(req.body.image.trim());
      }
    }

    const combinedMainImages = [...existingMainImages, ...uploaded.mainImages].slice(0, 5);
    const primaryMainImage = combinedMainImages[0] || "";

    const sizeChart = await SizeChart.create({
      name: name.trim(),
      productId: productId && mongoose.Types.ObjectId.isValid(productId) ? productId : null,
      categoryId: categoryId && mongoose.Types.ObjectId.isValid(categoryId) ? categoryId : null,
      unit: unit.trim(),
      description: description.trim(),
      image: primaryMainImage,
      images: combinedMainImages,
      tables: parsedTables,
      isActive: isActive !== "false" && isActive !== false,
      createdBy: req.user?._id || null,
    });

    // If associated with a product, update product.sizeChartId
    if (sizeChart.productId) {
      await Product.findByIdAndUpdate(sizeChart.productId, {
        sizeChartId: sizeChart._id,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Size chart created successfully",
      data: sizeChart,
    });
  } catch (error) {
    console.error("Create SizeChart Error:", error);
    cleanupUploadedFiles(req);
    return res.status(500).json({
      success: false,
      message: "Failed to create size chart",
      error: error.message,
    });
  }
};

// ============================================================
// GET ALL SIZE CHARTS
// GET /api/size-charts/all
// ============================================================
exports.getAllSizeCharts = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 50, status } = req.query;

    const query = {};

    if (search && search.trim()) {
      query.name = { $regex: search.trim(), $options: "i" };
    }

    if (status !== undefined && status !== "") {
      query.isActive = status === "true" || status === true;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 50);
    const skip = (pageNum - 1) * limitNum;

    const [total, sizeCharts] = await Promise.all([
      SizeChart.countDocuments(query),
      SizeChart.find(query)
        .populate("productId", "name variants")
        .populate("categoryId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      message: "Size charts fetched successfully",
      count: sizeCharts.length,
      data: sizeCharts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error("Get All SizeCharts Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch size charts",
      error: error.message,
    });
  }
};

// ============================================================
// GET SIZE CHART BY ID
// GET /api/size-charts/:id
// ============================================================
exports.getSizeChartById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid size chart ID",
      });
    }

    const sizeChart = await SizeChart.findById(id)
      .populate("productId", "name variants")
      .populate("categoryId", "name");

    if (!sizeChart) {
      return res.status(404).json({
        success: false,
        message: "Size chart not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: sizeChart,
    });
  } catch (error) {
    console.error("Get SizeChart By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch size chart",
      error: error.message,
    });
  }
};

// ============================================================
// GET SIZE CHART FOR A SPECIFIC PRODUCT (WITH SIZE AVAILABILITY CHECK)
// GET /api/size-charts/product/:productId
//
// REQUIREMENT:
// "if the size is added based on the product if any one of the
//  size name is not available in the product then it does not shows the sizechart"
// ============================================================
exports.getSizeChartByProductId = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    // 1. Fetch product
    const product = await Product.findById(productId)
      .populate("sizeChartId")
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // 2. Locate size chart:
    // ONLY show size chart if this product explicitly has a size chart assigned!
    // If the admin did not mention/assign a size chart for this product, return data: null.
    let sizeChart = product.sizeChartId || null;

    if (!sizeChart) {
      sizeChart = await SizeChart.findOne({
        productId: product._id,
        isActive: true,
      }).lean();
    }

    if (!sizeChart || !sizeChart.isActive) {
      return res.status(200).json({
        success: true,
        canShow: false,
        message: "No size chart mentioned for this product",
        data: null,
      });
    }

    // 3. Extract all sizes configured on the product across variants
    const productSizes = [];
    if (Array.isArray(product.variants)) {
      product.variants.forEach((v) => {
        if (Array.isArray(v.sizes)) {
          v.sizes.forEach((s) => {
            if (s && s.size && s.isActive !== false) {
              productSizes.push(String(s.size).trim().toUpperCase());
            }
          });
        }
      });
    }

    const uniqueProductSizes = Array.from(new Set(productSizes));

    // A size chart is explicitly mentioned / configured for this product: show it!
    return res.status(200).json({
      success: true,
      canShow: true,
      data: sizeChart,
      productSizes: uniqueProductSizes,
    });
  } catch (error) {
    console.error("Get SizeChart By Product Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch size chart for product",
      error: error.message,
    });
  }
};

// ============================================================
// UPDATE SIZE CHART
// PUT /api/size-charts/update/:id
// ============================================================
exports.updateSizeChart = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      cleanupUploadedFiles(req);
      return res.status(400).json({
        success: false,
        message: "Invalid size chart ID",
      });
    }

    const sizeChart = await SizeChart.findById(id);
    if (!sizeChart) {
      cleanupUploadedFiles(req);
      return res.status(404).json({
        success: false,
        message: "Size chart not found",
      });
    }

    const {
      name,
      productId,
      categoryId,
      unit,
      description,
      tables,
      isActive,
    } = req.body;

    if (name) sizeChart.name = name.trim();
    if (unit) sizeChart.unit = unit.trim();
    if (description !== undefined) sizeChart.description = description.trim();
    if (isActive !== undefined) {
      sizeChart.isActive = isActive !== "false" && isActive !== false;
    }

    const uploaded = processUploadedFiles(req);

    // Parse and handle main diagram guide images (up to 5 images)
    let existingMainImages = [];
    const rawExisting = req.body.existingImages || req.body.images;
    if (Array.isArray(rawExisting)) {
      existingMainImages = rawExisting.filter((img) => typeof img === "string" && img.trim());
    } else if (typeof rawExisting === "string" && rawExisting.trim()) {
      try {
        const parsed = JSON.parse(rawExisting);
        if (Array.isArray(parsed)) {
          existingMainImages = parsed.filter((img) => typeof img === "string" && img.trim());
        } else {
          existingMainImages = [rawExisting.trim()];
        }
      } catch {
        existingMainImages = [rawExisting.trim()];
      }
    } else if (req.body.image && typeof req.body.image === "string" && req.body.image.trim()) {
      existingMainImages = [req.body.image.trim()];
    } else if (Array.isArray(sizeChart.images) && sizeChart.images.length > 0) {
      existingMainImages = sizeChart.images;
    } else if (sizeChart.image) {
      existingMainImages = [sizeChart.image];
    }

    if (uploaded.mainImages && uploaded.mainImages.length > 0) {
      const combinedMainImages = [...existingMainImages, ...uploaded.mainImages].slice(0, 5);
      sizeChart.images = combinedMainImages;
      sizeChart.image = combinedMainImages[0] || "";
    } else if (rawExisting !== undefined || req.body.image !== undefined) {
      const combinedMainImages = existingMainImages.slice(0, 5);
      sizeChart.images = combinedMainImages;
      sizeChart.image = combinedMainImages[0] || "";
    }

    // Handle tables update
    if (tables !== undefined) {
      let parsedTables = typeof tables === "string" ? JSON.parse(tables) : tables;
      if (Array.isArray(parsedTables)) {
        sizeChart.tables = parsedTables.map((t, idx) => {
          let existingImages = [];
          if (Array.isArray(t.images)) {
            existingImages = t.images.filter((img) => typeof img === "string" && img.trim());
          } else if (t.image && typeof t.image === "string" && t.image.trim()) {
            existingImages = [t.image.trim()];
          }

          const newTableImages = uploaded.tableImages[idx] || [];
          const combinedImages = [...existingImages, ...newTableImages];
          const primaryImage = combinedImages[0] || t.image || "";

          return {
            tableName: (t.tableName || "STANDARD").toUpperCase().trim(),
            image: primaryImage,
            images: combinedImages,
            sizes: Array.isArray(t.sizes)
              ? t.sizes.map((s) => String(s).trim().toUpperCase()).filter(Boolean)
              : [],
            rows: Array.isArray(t.rows)
              ? t.rows.map((r) => ({
                  parameter: (r.parameter || "").toUpperCase().trim(),
                  values: r.values && typeof r.values === "object" ? r.values : {},
                }))
              : [],
          };
        });
      }
    }

    // Handle Product link changes
    if (productId !== undefined) {
      const previousProductId = sizeChart.productId ? String(sizeChart.productId) : null;
      const newProductId =
        productId && mongoose.Types.ObjectId.isValid(productId) ? String(productId) : null;

      if (previousProductId && previousProductId !== newProductId) {
        await Product.findByIdAndUpdate(previousProductId, { sizeChartId: null });
      }

      sizeChart.productId = newProductId ? new mongoose.Types.ObjectId(newProductId) : null;
      if (newProductId) {
        await Product.findByIdAndUpdate(newProductId, { sizeChartId: sizeChart._id });
      }
    }

    if (categoryId !== undefined) {
      sizeChart.categoryId =
        categoryId && mongoose.Types.ObjectId.isValid(categoryId)
          ? new mongoose.Types.ObjectId(categoryId)
          : null;
    }

    sizeChart.updatedBy = req.user?._id || null;
    await sizeChart.save();

    return res.status(200).json({
      success: true,
      message: "Size chart updated successfully",
      data: sizeChart,
    });
  } catch (error) {
    console.error("Update SizeChart Error:", error);
    cleanupUploadedFiles(req);
    return res.status(500).json({
      success: false,
      message: "Failed to update size chart",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE SIZE CHART
// DELETE /api/size-charts/delete/:id
// ============================================================
exports.deleteSizeChart = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid size chart ID",
      });
    }

    const sizeChart = await SizeChart.findById(id);
    if (!sizeChart) {
      return res.status(404).json({
        success: false,
        message: "Size chart not found",
      });
    }

    // Delete image if exists
    if (sizeChart.image) {
      deleteFileByUrl(sizeChart.image);
    }

    // Unlink any products pointing to this size chart
    await Product.updateMany({ sizeChartId: id }, { sizeChartId: null });

    await SizeChart.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Size chart deleted successfully",
    });
  } catch (error) {
    console.error("Delete SizeChart Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete size chart",
      error: error.message,
    });
  }
};
