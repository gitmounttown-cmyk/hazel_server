const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const TrendingProduct = require("../models/trendingProductModel");
const Product = require("../models/productModel");

// ==========================================================
// GET FULL IMAGE URL
// ==========================================================

const getImageUrl = (req, imagePath) => {
  if (!imagePath) {
    return null;
  }

  // If it's already an absolute URL, return it as is
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  const normalizedPath = imagePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  return `${req.protocol}://${req.get(
    "host"
  )}/${normalizedPath}`;
};

// ==========================================================
// DELETE LOCAL IMAGE
// ==========================================================

const deleteLocalFile = (imagePath) => {
  if (!imagePath) {
    return;
  }

  const normalizedPath = imagePath.replace(
    /\\/g,
    "/"
  );

  const absolutePath = path.join(
    process.cwd(),
    normalizedPath
  );

  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      console.log("Deleted image:", absolutePath);
    }
  } catch (error) {
    console.error("Error deleting image:", error.message);
  }
};

// ==========================================================
// DELETE UPLOADED FILES
// ==========================================================

const deleteUploadedFiles = (files) => {
  if (!files || !Array.isArray(files)) {
    return;
  }

  files.forEach((file) => {
    if (file && file.path) {
      const relativePath = path
        .relative(process.cwd(), file.path)
        .replace(/\\/g, "/");

      deleteLocalFile(relativePath);
    }
  });
};

// ==========================================================
// PARSE PRODUCTS
// ==========================================================

const parseProducts = (products) => {
  if (!products) {
    return [];
  }

  if (Array.isArray(products)) {
    return products;
  }

  try {
    return JSON.parse(products);
  } catch (error) {
    const customError = new Error("Invalid products JSON format");
    customError.details = error.message;
    throw customError;
  }
};

// ==========================================================
// VALIDATE PRODUCTS
// ==========================================================

const validateProducts = async (products) => {
  if (!Array.isArray(products)) {
    throw new Error("Products must be an array");
  }

  const productIds = [];

  for (let i = 0; i < products.length; i++) {
    const item = products[i];

    if (!item || typeof item !== "object") {
      throw new Error(`Invalid product data at index ${i}`);
    }

    if (!item.product) {
      throw new Error(`Product ID is required at index ${i}`);
    }

    if (!mongoose.Types.ObjectId.isValid(item.product)) {
      throw new Error(`Invalid product ID at index ${i}: ${item.product}`);
    }

    productIds.push(item.product.toString());

    if (
      item.displayOrder !== undefined &&
      (Number.isNaN(Number(item.displayOrder)) || Number(item.displayOrder) < 1)
    ) {
      throw new Error(`Invalid displayOrder at index ${i}`);
    }

    if (
      item.isFeatured !== undefined &&
      typeof item.isFeatured !== "boolean"
    ) {
      throw new Error(`isFeatured must be true or false at index ${i}`);
    }
  }

  const uniqueProductIds = new Set(productIds);

  if (uniqueProductIds.size !== productIds.length) {
    throw new Error("Duplicate products are not allowed");
  }

  if (productIds.length > 0) {
    const existingProducts = await Product.find({
      _id: { $in: productIds },
    }).select("_id");

    const existingIds = existingProducts.map((product) =>
      product._id.toString()
    );

    const missingProducts = productIds.filter(
      (id) => !existingIds.includes(id)
    );

    if (missingProducts.length > 0) {
      const error = new Error("One or more products were not found");
      error.missingProducts = missingProducts;
      throw error;
    }
  }

  return true;
};

// ==========================================================
// CREATE TRENDING PRODUCT
// ==========================================================

const createTrendingProduct = async (req, res) => {
  const uploadedFiles = req.files || [];

  try {
    const { title, subtitle, products, isActive } = req.body;

    let parsedProducts;
    try {
      parsedProducts = parseProducts(products);
    } catch (error) {
      deleteUploadedFiles(uploadedFiles);
      return res.status(400).json({
        success: false,
        message: "Invalid products JSON format",
        error: error.details,
      });
    }

    try {
      await validateProducts(parsedProducts);
    } catch (error) {
      deleteUploadedFiles(uploadedFiles);
      return res.status(400).json({
        success: false,
        message: error.message,
        missingProducts: error.missingProducts || undefined,
      });
    }

    const productImages = Array.isArray(req.files) ? req.files : [];

    if (productImages.length > parsedProducts.length) {
      deleteUploadedFiles(productImages);
      return res.status(400).json({
        success: false,
        message: "Number of images cannot exceed number of products",
      });
    }

    const finalProducts = parsedProducts.map((item, index) => {
      const uploadedImage = productImages[index];

      return {
        product: item.product,
        displayOrder: item.displayOrder || index + 1,
        isFeatured: item.isFeatured === true,
        image: uploadedImage
          ? path
              .relative(process.cwd(), uploadedImage.path)
              .replace(/\\/g, "/")
          : null,
      };
    });

    const trendingProduct = await TrendingProduct.create({
      title: title?.trim() || "Trending Products",
      subtitle: subtitle?.trim() || "",
      products: finalProducts,
      isActive:
        isActive === undefined
          ? true
          : isActive === true || isActive === "true",
    });

    const populated = await TrendingProduct.findById(
      trendingProduct._id
    ).populate("products.product");

    const data = populated.toObject();

    data.products = data.products
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((item) => ({
        ...item,
        image: getImageUrl(req, item.image || item.product?.image),
        product: item.product
          ? {
              ...item.product,
              image: getImageUrl(req, item.product.image),
            }
          : null,
      }));

    return res.status(201).json({
      success: true,
      message: "Trending Products created successfully",
      data,
    });
  } catch (error) {
    console.error("CREATE TRENDING PRODUCT ERROR:", error);
    deleteUploadedFiles(uploadedFiles);
    return res.status(500).json({
      success: false,
      message: "Failed to create Trending Products",
      error: error.message,
    });
  }
};

// ==========================================================
// GET ALL TRENDING PRODUCTS
// ==========================================================

const getAllTrendingProducts = async (req, res) => {
  try {
    const trendingProducts = await TrendingProduct.find()
      .select("_id title subtitle isActive products")
      .populate({
        path: "products.product",
        select: "_id name title price variants image",
      })
      .sort({ createdAt: -1 });

    const data = trendingProducts.map((trending) => {
      const item = trending.toObject();

      item.products = item.products
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((productItem) => {
          // Resolve image: use trending item image first, then populated product image
          const resolvedImage = productItem.image || productItem.product?.image;

          return {
            ...productItem,
            image: getImageUrl(req, resolvedImage),
            product: productItem.product
              ? {
                  ...productItem.product,
                  image: getImageUrl(req, productItem.product.image),
                }
              : null,
          };
        });

      return item;
    });

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("GET ALL TRENDING PRODUCTS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Trending Products",
      error: error.message,
    });
  }
};

// ==========================================================
// GET TRENDING PRODUCT BY ID
// ==========================================================

const getTrendingProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Trending Product ID",
      });
    }

    const trendingProduct = await TrendingProduct.findById(id).populate(
      "products.product"
    );

    if (!trendingProduct) {
      return res.status(404).json({
        success: false,
        message: "Trending Products not found",
      });
    }

    const data = trendingProduct.toObject();

    data.products = data.products
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((item) => ({
        ...item,
        image: getImageUrl(req, item.image || item.product?.image),
        product: item.product
          ? {
              ...item.product,
              image: getImageUrl(req, item.product.image),
            }
          : null,
      }));

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("GET TRENDING PRODUCT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Trending Product",
      error: error.message,
    });
  }
};

// ==========================================================
// UPDATE TRENDING PRODUCT
// ==========================================================

const updateTrendingProduct = async (req, res) => {
  const uploadedFiles = req.files || [];

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      deleteUploadedFiles(uploadedFiles);
      return res.status(400).json({
        success: false,
        message: "Invalid Trending Product ID",
      });
    }

    const existing = await TrendingProduct.findById(id);

    if (!existing) {
      deleteUploadedFiles(uploadedFiles);
      return res.status(404).json({
        success: false,
        message: "Trending Products not found",
      });
    }

    const { title, subtitle, products, isActive } = req.body;

    if (title !== undefined) {
      existing.title = title.trim();
    }

    if (subtitle !== undefined) {
      existing.subtitle = subtitle.trim();
    }

    if (isActive !== undefined) {
      existing.isActive = isActive === true || isActive === "true";
    }

    if (products !== undefined) {
      let parsedProducts;

      try {
        parsedProducts = parseProducts(products);
      } catch (error) {
        deleteUploadedFiles(uploadedFiles);
        return res.status(400).json({
          success: false,
          message: "Invalid products JSON format",
          error: error.details,
        });
      }

      try {
        await validateProducts(parsedProducts);
      } catch (error) {
        deleteUploadedFiles(uploadedFiles);
        return res.status(400).json({
          success: false,
          message: error.message,
          missingProducts: error.missingProducts || undefined,
        });
      }

      const productImages = Array.isArray(req.files) ? req.files : [];

      if (productImages.length > parsedProducts.length) {
        deleteUploadedFiles(productImages);
        return res.status(400).json({
          success: false,
          message: "Number of images cannot exceed number of products",
        });
      }

      existing.products.forEach((oldProduct) => {
        if (oldProduct.image) {
          deleteLocalFile(oldProduct.image);
        }
      });

      existing.products = parsedProducts.map((item, index) => {
        const uploadedImage = productImages[index];

        return {
          product: item.product,
          displayOrder: item.displayOrder || index + 1,
          isFeatured: item.isFeatured === true,
          image: uploadedImage
            ? path
                .relative(process.cwd(), uploadedImage.path)
                .replace(/\\/g, "/")
            : null,
        };
      });
    }

    await existing.save();

    const populated = await TrendingProduct.findById(existing._id).populate(
      "products.product"
    );

    const data = populated.toObject();

    data.products = data.products
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((item) => ({
        ...item,
        image: getImageUrl(req, item.image || item.product?.image),
        product: item.product
          ? {
              ...item.product,
              image: getImageUrl(req, item.product.image),
            }
          : null,
      }));

    return res.status(200).json({
      success: true,
      message: "Trending Products updated successfully",
      data,
    });
  } catch (error) {
    console.error("UPDATE TRENDING PRODUCT ERROR:", error);
    deleteUploadedFiles(uploadedFiles);
    return res.status(500).json({
      success: false,
      message: "Failed to update Trending Products",
      error: error.message,
    });
  }
};

// ==========================================================
// DELETE TRENDING PRODUCT
// ==========================================================

const deleteTrendingProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Trending Product ID",
      });
    }

    const trendingProduct = await TrendingProduct.findById(id);

    if (!trendingProduct) {
      return res.status(404).json({
        success: false,
        message: "Trending Products not found",
      });
    }

    trendingProduct.products.forEach((product) => {
      if (product.image) {
        deleteLocalFile(product.image);
      }
    });

    await TrendingProduct.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Trending Products deleted successfully",
    });
  } catch (error) {
    console.error("DELETE TRENDING PRODUCT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete Trending Products",
      error: error.message,
    });
  }
};

// ==========================================================
// EXPORT
// ==========================================================

module.exports = {
  createTrendingProduct,
  getAllTrendingProducts,
  getTrendingProductById,
  updateTrendingProduct,
  deleteTrendingProduct,
};