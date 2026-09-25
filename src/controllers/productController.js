const Product = require("../models/productModel");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

// ============================================================
// CONSTANTS
// ============================================================

const AVAILABILITY_OPTIONS = ["In Stock", "Out of Stock"];

const RATING_OPTIONS = [0, 1, 2, 3, 4, 5];

const SIZE_MAP = {
  XS: "XS",
  S: "S",
  M: "M",
  L: "L",
  XL: "XL",
  "2XL": "2XL",
  XXL: "XXL",
  "3XL": "3XL",
};

// ============================================================
// COMMON HELPERS
// ============================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// ============================================================
// PARSE JSON
// ============================================================

const parseJSON = (value, fallback = null) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

// ============================================================
// NORMALIZE ARRAY
// ============================================================

const normalizeArray = (value) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = parseJSON(value);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [value];
};

// ============================================================
// RANDOM NUMBER
// ============================================================

const generateRandomNumber = (length = 4) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;

  return Math.floor(min + Math.random() * (max - min + 1));
};

// ============================================================
// COLOR CODE
// ============================================================

const createColorCode = (color) => {
  if (!color) {
    return "CLR";
  }

  return color
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 4) || "CLR";
};

// ============================================================
// PRODUCT CODE
// ============================================================

const createProductCode = (productName) => {
  if (!productName) {
    return `PRD${generateRandomNumber(6)}`;
  }

  const code = productName
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 6);

  return code || `PRD${generateRandomNumber(6)}`;
};

// ============================================================
// SKU
// ============================================================

const generateSKU = (productName, color, size) => {
  const productCode = createProductCode(productName);
  const colorCode = createColorCode(color);

  const normalizedSize = normalizeSize(size);

  return `${productCode}-${colorCode}-${normalizedSize}-${generateRandomNumber(
    4
  )}`;
};

// ============================================================
// BARCODE
// ============================================================

const generateBarcode = () => {
  return `89${generateRandomNumber(10)}`;
};

// ============================================================
// NORMALIZE SIZE
// ============================================================

const normalizeSize = (size) => {
  if (!size) {
    return "";
  }

  const normalized = size
    .toString()
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  return SIZE_MAP[normalized] || normalized;
};

// ============================================================
// CALCULATE VARIANT QUANTITY
// ============================================================

const calculateVariantQuantity = (sizes = []) => {
  if (!Array.isArray(sizes)) {
    return 0;
  }

  return sizes.reduce((total, size) => {
    return total + Number(size.stockQuantity || 0);
  }, 0);
};

// ============================================================
// PREPARE UPLOADED MEDIA
// Generates clean web URLs like "/uploads/filename.ext" instead of local OS paths
// ============================================================

const prepareUploadedMedia = (file) => {
  if (!file) {
    return null;
  }

  const fileExtension = path
    .extname(file.originalname || "")
    .toLowerCase();

  const videoExtensions = [".mp4", ".webm", ".mov"];

  const type = videoExtensions.includes(fileExtension)
    ? "video"
    : "image";

  let imageURL = "";
  if (file.filename) {
    imageURL = `/uploads/${file.filename}`;
  } else if (file.path) {
    imageURL = `/uploads/${path.basename(file.path)}`;
  }

  let thumbnail = null;
  if (file.thumbnail) {
    thumbnail = `/uploads/${path.basename(file.thumbnail)}`;
  }

  return {
    type,
    imageURL,
    thumbnail,
  };
};

// ============================================================
// NORMALIZE MEDIA
// Clean up existing or incoming image paths to format "/uploads/..."
// ============================================================

const normalizeMedia = (media) => {
  if (!media) {
    return [];
  }

  if (!Array.isArray(media)) {
    media = [media];
  }

  return media
    .map((item) => {
      if (!item) {
        return null;
      }

      let rawURL = typeof item === "string" ? item : item.imageURL || "";

      if (!rawURL) return null;

      // Clean local OS Windows paths (e.g. "c:/Users/.../uploads/filename.png")
      if (rawURL.includes("uploads")) {
        rawURL = "/uploads/" + rawURL.split("uploads").pop().replace(/\\/g, "/").replace(/^\//, "");
      } else if (!rawURL.startsWith("/") && !rawURL.startsWith("http")) {
        rawURL = `/${rawURL}`;
      }

      if (typeof item === "string") {
        return {
          type: "image",
          imageURL: rawURL,
          thumbnail: null,
        };
      }

      return {
        type: item.type || "image",
        imageURL: rawURL,
        thumbnail: item.thumbnail || null,
      };
    })
    .filter((item) => item && item.imageURL);
};

// ============================================================
// DELETE UPLOADED FILE
// ============================================================

const deleteUploadedFile = (filePath) => {
  if (!filePath) {
    return;
  }

  try {
    const filename = path.basename(filePath);
    const absolutePath = path.join(process.cwd(), "uploads", filename);

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    console.error("Error deleting file:", error.message);
  }
};

// ============================================================
// DELETE MEDIA FILE
// ============================================================

const deleteMediaFile = (media) => {
  if (!media) {
    return;
  }

  if (media.imageURL) {
    deleteUploadedFile(media.imageURL);
  }

  if (media.thumbnail) {
    deleteUploadedFile(media.thumbnail);
  }
};

// ============================================================
// DELETE MEDIA ARRAY
// ============================================================

const deleteMediaArray = (media = []) => {
  if (!Array.isArray(media)) {
    return;
  }

  media.forEach((item) => {
    deleteMediaFile(item);
  });
};

// ============================================================
// PREPARE VARIANTS
// ============================================================

const prepareVariants = (variants = [], productName = "") => {
  if (!Array.isArray(variants)) {
    return [];
  }

  return variants.map((variant) => {
    const color = variant.color
      ? variant.color.toString().trim().toUpperCase()
      : "";

    let sizes = normalizeArray(variant.sizes);

    sizes = sizes.map((size) => {
      const normalizedSize =
        typeof size === "string"
          ? {
              size: normalizeSize(size),
              stockQuantity: 0,
            }
          : {
              ...size,
              size: normalizeSize(size.size),
              stockQuantity: Number(size.stockQuantity || 0),
            };

      if (!normalizedSize.sku) {
        normalizedSize.sku = generateSKU(
          productName,
          color,
          normalizedSize.size
        );
      }

      if (!normalizedSize.barcode) {
        normalizedSize.barcode = generateBarcode();
      }

      if (normalizedSize.isActive === undefined) {
        normalizedSize.isActive = true;
      }

      return normalizedSize;
    });

    const quantity = calculateVariantQuantity(sizes);

    return {
      ...variant,
      color,
      media: normalizeMedia(variant.media),
      fabric: variant.fabric || "",
      feel: variant.feel || "",
      lining: variant.lining || "",
      sleeveStyle: variant.sleeveStyle || "",
      finishing: variant.finishing || "",
      pocket: variant.pocket || "",
      quantity,
      price: Number(variant.price || 0),
      discountPrice:
        variant.discountPrice !== undefined &&
        variant.discountPrice !== ""
          ? Number(variant.discountPrice)
          : 0,
      offer: variant.offer || {
        type: "none",
        value: 0,
        startDate: null,
        endDate: null,
      },
      sizes,
      isActive:
        variant.isActive === undefined ? true : Boolean(variant.isActive),
    };
  });
};

// ============================================================
// ATTACH UPLOADED MEDIA TO VARIANTS
// ============================================================

const attachUploadedMediaToVariants = (
  variants = [],
  uploadedFiles = []
) => {
  if (!Array.isArray(variants)) {
    return variants;
  }

  if (!Array.isArray(uploadedFiles) || uploadedFiles.length === 0) {
    return variants;
  }

  let fileIndex = 0;

  return variants.map((variant) => {
    const mediaCount = Array.isArray(variant.media)
      ? variant.media.length
      : 0;

    const uploadedMedia = [];

    for (let i = 0; i < mediaCount; i++) {
      if (uploadedFiles[fileIndex]) {
        const media = prepareUploadedMedia(
          uploadedFiles[fileIndex]
        );

        if (media) {
          uploadedMedia.push(media);
        }

        fileIndex++;
      }
    }

    return {
      ...variant,
      media: [
        ...(variant.media || []),
        ...uploadedMedia,
      ],
    };
  });
};

// ============================================================
// CREATE PRODUCT
// POST /api/products/create
// ============================================================

const createProduct = async (req, res) => {
  try {
    const {
      categoryId,
      brandId,
      name,
      productType,
      fit,
      length,
      description,
      features,
      comboOffer,
      bannerType,
      rating,
      reviewCount,
      availability,
      variants,
      isActive,
    } = req.body;

    if (categoryId && !isValidObjectId(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid categoryId",
      });
    }

    if (brandId && !isValidObjectId(brandId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brandId",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }

    const parsedDescription = parseJSON(description, {});
    const parsedFeatures = normalizeArray(features);
    let parsedVariants = parseJSON(variants, []);

    if (!Array.isArray(parsedVariants)) {
      return res.status(400).json({
        success: false,
        message: "variants must be an array",
      });
    }

    parsedVariants = prepareVariants(
      parsedVariants,
      name.trim()
    );

    const colors = parsedVariants
      .map((variant) =>
        variant.color
          ? variant.color.toUpperCase().trim()
          : ""
      )
      .filter(Boolean);

    const duplicateColors = colors.filter(
      (color, index) => colors.indexOf(color) !== index
    );

    if (duplicateColors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Duplicate variant color: ${[
          ...new Set(duplicateColors),
        ].join(", ")}`,
      });
    }

    const uploadedFiles = Array.isArray(req.files)
      ? req.files
      : [];

    parsedVariants = attachUploadedMediaToVariants(
      parsedVariants,
      uploadedFiles
    );

    const product = new Product({
      categoryId: categoryId || null,
      brandId: brandId || null,

      name: name.trim(),

      productType: productType || "",
      fit: fit || "",
      length: length || "",

      description: parsedDescription,
      features: parsedFeatures,

      comboOffer: comboOffer || "",
      bannerType: bannerType || "",

      rating:
        rating !== undefined && rating !== ""
          ? Number(rating)
          : 0,

      reviewCount:
        reviewCount !== undefined && reviewCount !== ""
          ? Number(reviewCount)
          : 0,

      availability:
        availability &&
        AVAILABILITY_OPTIONS.includes(availability)
          ? availability
          : "Out of Stock",

      variants: parsedVariants,

      isActive:
        isActive === undefined
          ? true
          : Boolean(
              isActive === true ||
                isActive === "true"
            ),
    });

    await product.save();

    const populatedProduct = await Product.findById(
      product._id
    )
      .populate("categoryId")
      .populate("brandId");

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: populatedProduct,
    });
  } catch (error) {
    console.error("Create Product Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: error.message,
    });
  }
};

// ============================================================
// GET ALL PRODUCTS
// GET /api/products/all
// ============================================================

const getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      categoryId,
      brandId,
      isActive,
      size,
      fabric,
      color,
      pocket,
      features,
      sleeveStyle,
      sleeve,
      availability,
      rating,
      productType,
      fit,
      length,
    } = req.query;

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    const filter = { isDeleted: false };

    if (search && search.trim()) {
      filter.name = {
        $regex: search.trim(),$options: "i",
      };
    }

    if (categoryId) {
      if (!isValidObjectId(categoryId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid categoryId",
        });
      }
      filter.categoryId = categoryId;
    }

    if (brandId) {
      if (!isValidObjectId(brandId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid brandId",
        });
      }
      filter.brandId = brandId;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === true || isActive === "true";
    }

    if (availability) {
      if (!AVAILABILITY_OPTIONS.includes(availability)) {
        return res.status(400).json({
          success: false,
          message: "Invalid availability value",
        });
      }
      filter.availability = availability;
    }

    if (rating !== undefined) {
      const ratingNumber = Number(rating);

      if (
        Number.isNaN(ratingNumber) ||
        !RATING_OPTIONS.includes(ratingNumber)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid rating value",
        });
      }

      filter.rating = { $gte: ratingNumber };
    }

    if (productType) filter.productType = { $regex: productType,$options: "i" };
    if (fit) filter.fit = { $regex: fit,$options: "i" };
    if (length) filter.length = { $regex: length,$options: "i" };

    const variantFilter = {};
    if (size) variantFilter["variants.sizes.size"] = normalizeSize(size);
    if (fabric) variantFilter["variants.fabric"] = { $regex: fabric,$options: "i" };
    if (color) variantFilter["variants.color"] = { $regex: color,$options: "i" };
    if (pocket) variantFilter["variants.pocket"] = { $regex: pocket,$options: "i" };
    if (sleeveStyle) variantFilter["variants.sleeveStyle"] = { $regex: sleeveStyle,$options: "i" };
    if (sleeve) variantFilter["variants.sleeveStyle"] = { $regex: sleeve,$options: "i" };

    Object.assign(filter, variantFilter);

    if (features) {
      const featureArray = normalizeArray(features);
      if (featureArray.length > 0) {
        filter.features = { $all: featureArray };
      }
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("categoryId")
        .populate("brandId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      data: products,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(total / limitNumber),
        totalProducts: total,
        limit: limitNumber,
      },
    });
  } catch (error) {
    console.error("Get All Products Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};

// ============================================================
// GET PRODUCT BY ID
// GET /api/products/:productId
// ============================================================

const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid productId",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    })
      .populate("categoryId")
      .populate("brandId");

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
      message: "Product fetched successfully",
      data: { ...product.toObject(), relatedProducts },
    });
  } catch (error) {
    console.error("Get Product By ID Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message,
    });
  }
};

// ============================================================
// UPDATE PRODUCT
// PUT /api/products/update/:productId
// ============================================================

const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid productId",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (req.body.name !== undefined) {
      if (!req.body.name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Product name cannot be empty",
        });
      }
      product.name = req.body.name.trim();
    }

    if (req.body.categoryId !== undefined) {
      if (req.body.categoryId && !isValidObjectId(req.body.categoryId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid categoryId",
        });
      }
      product.categoryId = req.body.categoryId || null;
    }

    if (req.body.brandId !== undefined) {
      if (req.body.brandId && !isValidObjectId(req.body.brandId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid brandId",
        });
      }
      product.brandId = req.body.brandId || null;
    }

    if (req.body.productType !== undefined) product.productType = req.body.productType;
    if (req.body.fit !== undefined) product.fit = req.body.fit;
    if (req.body.length !== undefined) product.length = req.body.length;
    if (req.body.comboOffer !== undefined) product.comboOffer = req.body.comboOffer;
    if (req.body.bannerType !== undefined) product.bannerType = req.body.bannerType;

    if (req.body.description !== undefined) {
      product.description = parseJSON(req.body.description, product.description || {});
    }

    if (req.body.features !== undefined) {
      product.features = normalizeArray(req.body.features);
    }

    if (req.body.rating !== undefined) {
      const ratingNumber = Number(req.body.rating);
      if (Number.isNaN(ratingNumber) || ratingNumber < 0 || ratingNumber > 5) {
        return res.status(400).json({
          success: false,
          message: "Rating must be between 0 and 5",
        });
      }
      product.rating = ratingNumber;
    }

    if (req.body.reviewCount !== undefined) {
      product.reviewCount = Number(req.body.reviewCount);
    }

    if (req.body.availability !== undefined) {
      if (!AVAILABILITY_OPTIONS.includes(req.body.availability)) {
        return res.status(400).json({
          success: false,
          message: "Invalid availability value",
        });
      }
      product.availability = req.body.availability;
    }

    if (req.body.isActive !== undefined) {
      product.isActive = req.body.isActive === true || req.body.isActive === "true";
    }

    if (req.body.variants !== undefined) {
      let parsedVariants = parseJSON(req.body.variants, []);

      if (!Array.isArray(parsedVariants)) {
        return res.status(400).json({
          success: false,
          message: "variants must be an array",
        });
      }

      parsedVariants = prepareVariants(parsedVariants, product.name);

      const colors = parsedVariants
        .map((variant) => (variant.color ? variant.color.toString().trim().toUpperCase() : ""))
        .filter(Boolean);

      const duplicateColors = colors.filter((color, index) => colors.indexOf(color) !== index);

      if (duplicateColors.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Duplicate variant color: ${[...new Set(duplicateColors)].join(", ")}`,
        });
      }

      const oldVariants = product.variants || [];

      oldVariants.forEach((oldVariant) => {
        const newVariant = parsedVariants.find((variant) => variant.color === oldVariant.color);

        if (!newVariant) {
          deleteMediaArray(oldVariant.media || []);
          return;
        }

        const newMediaURLs = (newVariant.media || []).map((media) => media.imageURL);
        const removedMedia = (oldVariant.media || []).filter(
          (oldMedia) => !newMediaURLs.includes(oldMedia.imageURL)
        );

        deleteMediaArray(removedMedia);
      });

      const uploadedFiles = Array.isArray(req.files) ? req.files : [];

      if (uploadedFiles.length > 0) {
        let fileIndex = 0;

        parsedVariants = parsedVariants.map((variant) => {
          const filesForVariant = [];
          const mediaCount = Array.isArray(variant.media) ? variant.media.length : 0;

          for (let i = 0; i < mediaCount; i++) {
            if (uploadedFiles[fileIndex]) {
              const media = prepareUploadedMedia(uploadedFiles[fileIndex]);
              if (media) {
                filesForVariant.push(media);
              }
              fileIndex++;
            }
          }

          return {
            ...variant,
            media: [...(variant.media || []), ...filesForVariant],
          };
        });
      }

      product.variants = parsedVariants;
    }

    await product.save();

    const updatedProduct = await Product.findById(product._id)
      .populate("categoryId")
      .populate("brandId");

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Update Product Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE PRODUCT
// DELETE /api/products/delete/:productId
// ============================================================

const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid productId",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (Array.isArray(product.variants)) {
      product.variants.forEach((variant) => {
        deleteMediaArray(variant.media || []);
      });
    }

    product.isDeleted = true;
    product.isActive = false;

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete Product Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    });
  }
};

// ============================================================
// ADD VARIANT MEDIA
// POST /api/products/:productId/variant/:color/media
// ============================================================

const addVariantMedia = async (req, res) => {
  try {
    const { productId } = req.params;
    const color = req.params.color || req.params.variantId;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid productId",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const variant = product.variants.find(
      (item) =>
        item.color?.toUpperCase() === color?.toUpperCase() ||
        item._id?.toString() === color
    );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: `${color} Variant color not found`,
      });
    }

    const files = Array.isArray(req.files) ? req.files : [];

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one media file",
      });
    }

    const currentCount = variant.media?.length || 0;

    if (currentCount + files.length > 10) {
      return res.status(400).json({
        success: false,
        message: "A variant can have maximum 10 media files",
      });
    }

    const uploadedMedia = files
      .map((file) => prepareUploadedMedia(file))
      .filter(Boolean);

    variant.media.push(...uploadedMedia);

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Variant media added successfully",
      data: product,
    });
  } catch (error) {
    console.error("Add Variant Media Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add variant media",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE VARIANT MEDIA
// DELETE /api/products/:productId/variant/:color/media/:mediaId
// ============================================================

const deleteVariantMedia = async (req, res) => {
  try {
    const { productId, mediaId } = req.params;
    const color = req.params.color || req.params.variantId;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid productId",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const variant = product.variants.find(
      (item) =>
        item.color?.toUpperCase() === color?.toUpperCase() ||
        item._id?.toString() === color
    );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant color not found",
      });
    }

    const mediaIndex = variant.media.findIndex(
      (media) => media._id?.toString() === mediaId
    );

    if (mediaIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Media not found",
      });
    }

    const media = variant.media[mediaIndex];
    deleteMediaFile(media);
    variant.media.splice(mediaIndex, 1);

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Variant media deleted successfully",
      data: product,
    });
  } catch (error) {
    console.error("Delete Variant Media Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete variant media",
      error: error.message,
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  addVariantMedia,
  deleteVariantMedia,
};