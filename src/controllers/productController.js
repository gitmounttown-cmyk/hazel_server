const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const Brand = require("../models/brandModel");

const formatMediaPath = (file) => `/uploads/products/${file.filename}`;

// GET ALL PRODUCTS
exports.getAllProducts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.categoryId) filter.categoryId = req.query.categoryId;
    if (req.query.subCategoryId) filter.subCategoryId = req.query.subCategoryId;
    if (req.query.brandId) filter.brandId = req.query.brandId;
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true";
    }
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: "i" };
    }

    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .populate("categoryId", "name")
      .populate("brandId", "name")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      data: products,
    });
  } catch (error) {
    console.error("Error in getAllProducts:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve products",
    });
  }
};

// GET PRODUCT BY ID
exports.getProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId)
      .populate("categoryId", "name")
      .populate("brandId", "name");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const relatedProducts = await Product.find({
      categoryId: product.categoryId,
      brandId: product.brandId,
      _id: { $ne: product._id },
      isDeleted: false,
    })
      .populate("categoryId")
      .populate("brandId")
      .limit(5);

    return res.status(200).json({
      success: true,
      data: { ...product.toObject(), relatedProducts },
    });
  } catch (error) {
    console.error("Error in getProductById:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch product details",
    });
  }
};

// CREATE PRODUCT
exports.createProduct = async (req, res) => {
  try {
    const { categoryId, brandId, name, description, variants, isActive } = req.body;

    if (!name || !brandId) {
      return res.status(400).json({
        success: false,
        message: "Product Name and Brand are required",
      });
    }

    let parsedDescription = {};
    if (description) {
      parsedDescription = typeof description === "string" ? JSON.parse(description) : description;
    }

    let parsedVariants = [];
    if (variants) {
      parsedVariants = typeof variants === "string" ? JSON.parse(variants) : variants;
    }

    if (req.files && req.files.length > 0 && parsedVariants.length > 0) {
      const uploadedMedia = req.files.map((file) => ({
        imageURL: formatMediaPath(file),
        type: file.mimetype.startsWith("video/") ? "video" : "image",
      }));

      if (!parsedVariants[0].media) parsedVariants[0].media = [];
      parsedVariants[0].media.push(...uploadedMedia);
    }

    const newProduct = new Product({
      categoryId: categoryId || null,
      brandId,
      name,
      description: parsedDescription,
      variants: parsedVariants,
      isActive: isActive !== undefined ? isActive : true,
    });

    await newProduct.save();

    const populatedProduct = await Product.findById(newProduct._id)
      .populate("categoryId", "name")
      .populate("brandId", "name");

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: populatedProduct,
    });
  } catch (error) {
    console.error("Error in createProduct:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create product",
    });
  }
};

// UPDATE PRODUCT
exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { categoryId, brandId, name, description, variants, isActive } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (name) product.name = name;
    if (brandId) product.brandId = brandId;
    if (categoryId !== undefined) product.categoryId = categoryId || null;
    if (isActive !== undefined) product.isActive = isActive;

    if (description) {
      product.description = typeof description === "string" ? JSON.parse(description) : description;
    }

    if (variants) {
      const parsedVariants = typeof variants === "string" ? JSON.parse(variants) : variants;

      if (req.files && req.files.length > 0 && parsedVariants.length > 0) {
        const uploadedMedia = req.files.map((file) => ({
          imageURL: formatMediaPath(file),
          type: file.mimetype.startsWith("video/") ? "video" : "image",
        }));

        if (!parsedVariants[0].media) parsedVariants[0].media = [];
        parsedVariants[0].media.push(...uploadedMedia);
      }

      product.variants = parsedVariants;
    }

    await product.save();

    const updatedProduct = await Product.findById(productId)
      .populate("categoryId", "name")
      .populate("brandId", "name");

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Error in updateProduct:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update product",
    });
  }
};

// DELETE PRODUCT
exports.deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findByIdAndUpdate(
      productId,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deactivated successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error in deleteProduct:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete product",
    });
  }
};

// UPLOAD MEDIA HANDLER
exports.uploadProductMediaHandler = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files provided",
      });
    }

    const uploadedMedia = req.files.map((file) => ({
      imageURL: formatMediaPath(file),
      type: file.mimetype.startsWith("video/") ? "video" : "image",
    }));

    return res.status(200).json({
      success: true,
      data: uploadedMedia,
    });
  } catch (error) {
    console.error("Error in uploadProductMediaHandler:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload media",
    });
  }
};