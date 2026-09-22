const Product = require("../models/productModel");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

// ============================================================
// CONSTANTS
// ============================================================

const AVAILABILITY_OPTIONS = [
  "In Stock",
  "Out of Stock",
];

const RATING_OPTIONS = [0, 1, 2, 3, 4, 5];

const SIZE_MAP = {
  XXL: "XXL",
  "2XL": "2XL",
  XXXL: "3XL",
  "3XL": "3XL",
};

// ============================================================
// HELPERS
// ============================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// ============================================================
// PARSE JSON
// ============================================================

const parseJSON = (value, defaultValue = null) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return defaultValue;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return defaultValue;
  }
};

// ============================================================
// NORMALIZE ARRAY
// ============================================================

const normalizeArray = (value) => {
  if (value === undefined || value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = parseJSON(value, null);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

// ============================================================
// RANDOM NUMBER
// ============================================================

const generateRandomNumber = (length = 6) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;

  return Math.floor(
    Math.random() * (max - min + 1) + min
  );
};

// ============================================================
// COLOR CODE
// ============================================================

const createColorCode = (color) => {
  return String(color || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 4);
};

// ============================================================
// PRODUCT CODE
// ============================================================

const createProductCode = () => {
  return `HZP-${generateRandomNumber(6)}`;
};

// ============================================================
// SKU
// ============================================================

const generateSKU = (
  productName,
  color,
  size
) => {
  const productCode = String(productName || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 5);

  const colorCode = createColorCode(color);

  return `HZ-${productCode}-${colorCode}-${size}`;
};

// ============================================================
// BARCODE
// ============================================================

const generateBarcode = () => {
  return `890${Date.now()}${generateRandomNumber(4)}`;
};

// ============================================================
// QUANTITY
// ============================================================

const calculateVariantQuantity = (sizes = []) => {
  return sizes.reduce(
    (total, size) =>
      total + (Number(size.stockQuantity) || 0),
    0
  );
};

// ============================================================
// NORMALIZE SIZE
// ============================================================

const normalizeSize = (value) => {
  const size = String(value || "")
    .trim()
    .toUpperCase();

  return SIZE_MAP[size] || size;
};

// ============================================================
// PREPARE UPLOADED MEDIA
// ============================================================

const prepareUploadedMedia = (files = []) => {
  return files.map((file) => {
    const isVideo =
      file.mimetype &&
      file.mimetype.startsWith("video/");

    return {
      type: isVideo ? "video" : "image",
      imageURL: `/uploads/products/${file.filename}`,
      thumbnail: null,
    };
  });
};

// ============================================================
// NORMALIZE MEDIA
// ============================================================

const normalizeMedia = (media = []) => {
  if (!Array.isArray(media)) {
    return [];
  }

  return media.map((item) => ({
    type: item.type || "image",
    imageURL:
      item.imageURL ||
      item.url ||
      null,
    thumbnail:
      item.thumbnail || null,
  }));
};

// ============================================================
// DELETE UPLOADED FILE
// ============================================================

const deleteUploadedFile = (file) => {
  try {
    if (
      file?.path &&
      fs.existsSync(file.path)
    ) {
      fs.unlinkSync(file.path);
    }
  } catch (error) {
    console.error(
      "DELETE UPLOADED FILE ERROR:",
      error.message
    );
  }
};

// ============================================================
// DELETE MEDIA FILE
// ============================================================

const deleteMediaFile = (imageURL) => {
  try {
    if (!imageURL) {
      return;
    }

    const cleanURL = imageURL.split("?")[0];

    const relativePath = cleanURL
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/^\/+/, "");

    if (!relativePath.startsWith("uploads/")) {
      return;
    }

    const uploadRoot = path.resolve(
      __dirname,
      "../uploads"
    );

    const filePath = path.resolve(
      __dirname,
      "..",
      relativePath
    );

    if (
      filePath.startsWith(uploadRoot) &&
      fs.existsSync(filePath)
    ) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(
      "DELETE MEDIA FILE ERROR:",
      error.message
    );
  }
};

// ============================================================
// DELETE MEDIA ARRAY
// ============================================================

const deleteMediaArray = (mediaArray = []) => {
  mediaArray.forEach((media) => {
    if (media?.imageURL) {
      deleteMediaFile(media.imageURL);
    }

    if (media?.thumbnail) {
      deleteMediaFile(media.thumbnail);
    }
  });
};

// ============================================================
// PREPARE VARIANTS
// ============================================================

const prepareVariants = (
  variants = [],
  productName
) => {
  if (!Array.isArray(variants)) {
    throw new Error(
      "Variants must be an array"
    );
  }

  return variants.map(
    (variant, variantIndex) => {
      if (!variant.color) {
        throw new Error(
          `Color is required for variant ${
            variantIndex + 1
          }`
        );
      }

      const color = String(
        variant.color
      )
        .trim()
        .toUpperCase();

      let sizes = variant.sizes;

      if (typeof sizes === "string") {
        sizes = parseJSON(
          sizes,
          []
        );
      }

      if (!Array.isArray(sizes)) {
        sizes = [];
      }

      sizes = sizes.map((size) => {
        const sizeValue =
          normalizeSize(size.size);

        if (!sizeValue) {
          throw new Error(
            `Size is required for color ${color}`
          );
        }

        return {
          _id: size._id,

          size: sizeValue,

          stockQuantity:
            Number(size.stockQuantity) || 0,

          sku:
            size.sku ||
            generateSKU(
              productName,
              color,
              sizeValue
            ),

          barcode:
            size.barcode ||
            generateBarcode(),

          isActive:
            size.isActive !== undefined
              ? Boolean(size.isActive)
              : true,
        };
      });

      let media = variant.media;

      if (typeof media === "string") {
        media = parseJSON(
          media,
          []
        );
      }

      media = normalizeMedia(media);

      if (media.length > 10) {
        throw new Error(
          `Maximum 10 media files are allowed for color ${color}`
        );
      }

      const quantity =
        calculateVariantQuantity(
          sizes
        );

      const price = Number(
        variant.price
      );

      if (
        Number.isNaN(price) ||
        price < 0
      ) {
        throw new Error(
          `Invalid price for color ${color}`
        );
      }

      let discountPrice =
        variant.discountPrice;

      if (
        discountPrice !== null &&
        discountPrice !== undefined &&
        discountPrice !== ""
      ) {
        discountPrice =
          Number(discountPrice);

        if (
          Number.isNaN(
            discountPrice
          ) ||
          discountPrice < 0
        ) {
          throw new Error(
            `Invalid discountPrice for color ${color}`
          );
        }

        if (
          discountPrice > price
        ) {
          throw new Error(
            `discountPrice cannot be greater than price for color ${color}`
          );
        }
      } else {
        discountPrice = null;
      }

      let offer = variant.offer;

      if (typeof offer === "string") {
        offer = parseJSON(
          offer,
          null
        );
      }

      if (!offer) {
        offer = {
          type: "none",
          value: 0,
          startDate: null,
          endDate: null,
        };
      }

      return {
        _id: variant._id,

        color,

        media,

        fabric:
          variant.fabric || "",

        feel:
          variant.feel || "",

        lining:
          variant.lining || "",

        sleeveStyle:
          variant.sleeveStyle || "",

        finishing:
          variant.finishing || "",

        pocket:
          variant.pocket || "",

        quantity,

        price,

        discountPrice,

        offer,

        sizes,

        isActive:
          variant.isActive !== undefined
            ? Boolean(
                variant.isActive
              )
            : true,
      };
    }
  );
};

// ============================================================
// ATTACH UPLOADED MEDIA BY COLOR
// ============================================================

const attachUploadedMediaByColor = ({
  variants,
  files = [],
  mediaColors = [],
}) => {
  if (!files.length) {
    return variants;
  }

  const uploadedMedia =
    prepareUploadedMedia(files);

  uploadedMedia.forEach(
    (media, index) => {
      const color =
        mediaColors[index];

      if (!color) {
        return;
      }

      const variant =
        variants.find(
          (item) =>
            String(
              item.color
            ).toUpperCase() ===
            String(color).toUpperCase()
        );

      if (!variant) {
        return;
      }

      if (!Array.isArray(variant.media)) {
        variant.media = [];
      }

      if (
        variant.media.length >= 10
      ) {
        throw new Error(
          `Maximum 10 media files are allowed for color ${color}`
        );
      }

      variant.media.push(media);
    }
  );

  return variants;
};

// ============================================================
// CREATE PRODUCT
// ============================================================

const createProduct = async (
  req,
  res
) => {
  try {
    const {
      categoryId,
      subCategoryId,
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
      variants: bodyVariants,
    } = req.body;

    // --------------------------------------------------------
    // NAME
    // --------------------------------------------------------

    if (
      !name ||
      !String(name).trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Product name is required",
      });
    }

    // --------------------------------------------------------
    // OBJECT IDS
    // --------------------------------------------------------

    if (
      categoryId &&
      !isValidObjectId(categoryId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid categoryId",
      });
    }

    if (
      subCategoryId &&
      !isValidObjectId(
        subCategoryId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid subCategoryId",
      });
    }

    if (
      brandId &&
      !isValidObjectId(brandId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid brandId",
      });
    }

    // --------------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------------

    const parsedDescription =
      parseJSON(
        description,
        description || {}
      );

    // --------------------------------------------------------
    // FEATURES
    // --------------------------------------------------------

    const normalizedFeatures =
      normalizeArray(
        features
      );

    // --------------------------------------------------------
    // RATING
    // --------------------------------------------------------

    let productRating = 0;

    if (
      rating !== undefined &&
      rating !== ""
    ) {
      productRating =
        Number(rating);

      if (
        !RATING_OPTIONS.includes(
          productRating
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Rating must be between 0 and 5",
        });
      }
    }

    // --------------------------------------------------------
    // REVIEW COUNT
    // --------------------------------------------------------

    let productReviewCount = 0;

    if (
      reviewCount !== undefined &&
      reviewCount !== ""
    ) {
      productReviewCount =
        Number(reviewCount);

      if (
        Number.isNaN(
          productReviewCount
        ) ||
        productReviewCount < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid reviewCount",
        });
      }
    }

    // --------------------------------------------------------
    // VARIANTS
    // --------------------------------------------------------

    let variants = bodyVariants;

    if (
      typeof variants ===
      "string"
    ) {
      variants =
        parseJSON(
          variants,
          []
        );
    }

    if (
      !Array.isArray(
        variants
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Variants must be an array",
      });
    }

    variants =
      prepareVariants(
        variants,
        name
      );

    // --------------------------------------------------------
    // DUPLICATE COLORS
    // --------------------------------------------------------

    const colors =
      variants.map(
        (variant) =>
          variant.color
      );

    const duplicateColors =
      colors.filter(
        (color, index) =>
          colors.indexOf(
            color
          ) !== index
      );

    if (
      duplicateColors.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Duplicate colors are not allowed",
        duplicateColors: [
          ...new Set(
            duplicateColors
          ),
        ],
      });
    }

    // --------------------------------------------------------
    // MEDIA
    // --------------------------------------------------------

    if (req.files?.length) {
      const mediaColors =
        normalizeArray(
          req.body.mediaColors
        ).map((color) =>
          String(color)
            .trim()
            .toUpperCase()
        );

      if (
        mediaColors.length !==
        req.files.length
      ) {
        req.files.forEach(
          deleteUploadedFile
        );

        return res.status(400).json({
          success: false,
          message:
            "mediaColors count must match uploaded media count",
        });
      }

      variants =
        attachUploadedMediaByColor({
          variants,
          files: req.files,
          mediaColors,
        });
    }

    // --------------------------------------------------------
    // CREATE
    // --------------------------------------------------------

    const product =
      new Product({
        categoryId:
          categoryId || null,

        subCategoryId:
          subCategoryId || null,

        brandId:
          brandId || null,

        name:
          String(name).trim(),

        productType:
          productType || "",

        fit:
          fit || "",

        length:
          length || "",

        description:
          parsedDescription,

        features:
          normalizedFeatures,

        comboOffer:
          comboOffer || "",

        bannerType:
          bannerType || "",

        rating:
          productRating,

        reviewCount:
          productReviewCount,

        variants,

        isActive: true,

        isDeleted: false,
      });

    await product.save();

    return res.status(201).json({
      success: true,
      message:
        "Product created successfully",
      data: product,
    });
  } catch (error) {
    console.error(
      "CREATE PRODUCT ERROR:",
      error
    );

    if (req.files?.length) {
      req.files.forEach(
        deleteUploadedFile
      );
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create product",
    });
  }
};

// ============================================================
// GET ALL PRODUCTS
// ============================================================

const getAllProducts = async (
  req,
  res
) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      categoryId,
      subCategoryId,
      brandId,
      isActive,
      size,
      fabric,
      color,
      sleeveStyle,
      pocket,
      availability,
      rating,
      minRating,
      price,
      minPrice,
      maxPrice,
    } = req.query;

    const filter = {
      isDeleted: false,
    };

    // --------------------------------------------------------
    // SEARCH
    // --------------------------------------------------------

    if (
      search &&
      String(search).trim()
    ) {
      filter.name = {
        $regex:
          String(search).trim(),
        $options: "i",
      };
    }

    // --------------------------------------------------------
    // IDS
    // --------------------------------------------------------

    if (categoryId) {
      if (
        !isValidObjectId(
          categoryId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid categoryId",
        });
      }

      filter.categoryId =
        categoryId;
    }

    if (subCategoryId) {
      if (
        !isValidObjectId(
          subCategoryId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid subCategoryId",
        });
      }

      filter.subCategoryId =
        subCategoryId;
    }

    if (brandId) {
      if (
        !isValidObjectId(
          brandId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid brandId",
        });
      }

      filter.brandId =
        brandId;
    }

    // --------------------------------------------------------
    // ACTIVE
    // --------------------------------------------------------

    if (
      isActive !== undefined
    ) {
      filter.isActive =
        String(isActive) ===
        "true";
    }

    // --------------------------------------------------------
    // AVAILABILITY
    // --------------------------------------------------------

    if (availability) {
      const values =
        normalizeArray(
          availability
        );

      const invalid =
        values.filter(
          (value) =>
            !AVAILABILITY_OPTIONS.includes(
              value
            )
        );

      if (invalid.length) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid availability",
          allowed:
            AVAILABILITY_OPTIONS,
        });
      }

      filter.availability = {
        $in: values,
      };
    }

    // --------------------------------------------------------
    // RATING
    // --------------------------------------------------------

    const ratingValue =
      rating !== undefined
        ? rating
        : minRating;

    if (
      ratingValue !== undefined &&
      ratingValue !== ""
    ) {
      const minimumRating =
        Number(ratingValue);

      if (
        Number.isNaN(
          minimumRating
        ) ||
        minimumRating < 0 ||
        minimumRating > 5
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Rating must be between 0 and 5",
        });
      }

      filter.rating = {
        $gte: minimumRating,
      };
    }

    // --------------------------------------------------------
    // VARIANT FILTERS
    // --------------------------------------------------------

    const variantMatch = {};

    if (size) {
      const sizes =
        normalizeArray(size)
          .map(normalizeSize);

      variantMatch.sizes = {
        $elemMatch: {
          size: {
            $in: sizes,
          },
        },
      };
    }

    if (fabric) {
      variantMatch.fabric = {
        $regex:
          String(fabric),
        $options: "i",
      };
    }

    if (color) {
      const colors =
        normalizeArray(color)
          .map((value) =>
            String(value)
              .trim()
              .toUpperCase()
          );

      variantMatch.color = {
        $in: colors,
      };
    }

    if (sleeveStyle) {
      variantMatch.sleeveStyle = {
        $regex:
          String(sleeveStyle),
        $options: "i",
      };
    }

    if (pocket) {
      variantMatch.pocket = {
        $regex:
          String(pocket),
        $options: "i",
      };
    }

    if (
      Object.keys(
        variantMatch
      ).length
    ) {
      filter.variants = {
        $elemMatch:
          variantMatch,
      };
    }

    // --------------------------------------------------------
    // PRICE
    // --------------------------------------------------------

    if (price) {
      switch (price) {
        case "under_1000":
          filter["variants.price"] = {
            $lt: 1000,
          };
          break;

        case "1000_1500":
          filter["variants.price"] = {
            $gte: 1000,
            $lte: 1500,
          };
          break;

        case "1500_2000":
          filter["variants.price"] = {
            $gte: 1500,
            $lte: 2000,
          };
          break;

        case "above_2000":
          filter["variants.price"] = {
            $gt: 2000,
          };
          break;
      }
    }

    if (
      minPrice !== undefined ||
      maxPrice !== undefined
    ) {
      const priceFilter = {};

      if (
        minPrice !== undefined &&
        minPrice !== ""
      ) {
        priceFilter.$gte =
          Number(minPrice);
      }

      if (
        maxPrice !== undefined &&
        maxPrice !== ""
      ) {
        priceFilter.$lte =
          Number(maxPrice);
      }

      if (
        Object.keys(
          priceFilter
        ).length
      ) {
        filter["variants.price"] =
          priceFilter;
      }
    }

    // --------------------------------------------------------
    // PAGINATION
    // --------------------------------------------------------

    const pageNumber =
      Math.max(
        Number(page) || 1,
        1
      );

    const limitNumber =
      Math.min(
        Math.max(
          Number(limit) || 20,
          1
        ),
        100
      );

    const skip =
      (pageNumber - 1) *
      limitNumber;

    // --------------------------------------------------------
    // QUERY
    // --------------------------------------------------------

    const [
      products,
      total,
    ] = await Promise.all([
      Product.find(filter)
        .populate("categoryId")
        .populate("subCategoryId")
        .populate("brandId")
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(
          limitNumber
        ),

      Product.countDocuments(
        filter
      ),
    ]);

    return res.status(200).json({
      success: true,
      message:
        "Products fetched successfully",

      data: products,

      pagination: {
        currentPage:
          pageNumber,

        totalPages:
          Math.ceil(
            total /
              limitNumber
          ),

        totalProducts:
          total,

        limit:
          limitNumber,
      },

      filters: {
        availability:
          AVAILABILITY_OPTIONS,

        ratings:
          RATING_OPTIONS,
      },
    });
  } catch (error) {
    console.error(
      "GET ALL PRODUCTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch products",
    });
  }
};

// ============================================================
// GET PRODUCT BY ID
// ============================================================

const getProductById = async (
  req,
  res
) => {
  try {
    const {
      productId,
    } = req.params;

    if (
      !isValidObjectId(
        productId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid productId",
      });
    }

    const product =
      await Product.findOne({
        _id: productId,
        isDeleted: false,
      })
        .populate("categoryId")
        .populate("subCategoryId")
        .populate("brandId");

    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Product fetched successfully",
      data: product,
    });
  } catch (error) {
    console.error(
      "GET PRODUCT BY ID ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch product",
    });
  }
};

// ============================================================
// UPDATE PRODUCT
// ============================================================

const updateProduct = async (
  req,
  res
) => {
  try {
    const {
      productId,
    } = req.params;

    if (
      !isValidObjectId(
        productId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid productId",
      });
    }

    const product =
      await Product.findOne({
        _id: productId,
        isDeleted: false,
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found",
      });
    }

    // --------------------------------------------------------
    // BASIC FIELDS
    // --------------------------------------------------------

    if (
      req.body.name !==
      undefined
    ) {
      if (
        !String(
          req.body.name
        ).trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Product name cannot be empty",
        });
      }

      product.name =
        String(
          req.body.name
        ).trim();
    }

    if (
      req.body.categoryId !==
      undefined
    ) {
      if (
        req.body.categoryId &&
        !isValidObjectId(
          req.body.categoryId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid categoryId",
        });
      }

      product.categoryId =
        req.body.categoryId ||
        null;
    }

    if (
      req.body.subCategoryId !==
      undefined
    ) {
      if (
        req.body.subCategoryId &&
        !isValidObjectId(
          req.body.subCategoryId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid subCategoryId",
        });
      }

      product.subCategoryId =
        req.body.subCategoryId ||
        null;
    }

    if (
      req.body.brandId !==
      undefined
    ) {
      if (
        req.body.brandId &&
        !isValidObjectId(
          req.body.brandId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid brandId",
        });
      }

      product.brandId =
        req.body.brandId ||
        null;
    }

    // --------------------------------------------------------
    // PRODUCT INFORMATION
    // --------------------------------------------------------

    if (
      req.body.productType !==
      undefined
    ) {
      product.productType =
        req.body.productType;
    }

    if (
      req.body.fit !==
      undefined
    ) {
      product.fit =
        req.body.fit;
    }

    if (
      req.body.length !==
      undefined
    ) {
      product.length =
        req.body.length;
    }

    // --------------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------------

    if (
      req.body.description !==
      undefined
    ) {
      product.description =
        parseJSON(
          req.body.description,
          req.body.description
        );
    }

    // --------------------------------------------------------
    // FEATURES
    // --------------------------------------------------------

    if (
      req.body.features !==
      undefined
    ) {
      product.features =
        normalizeArray(
          req.body.features
        );
    }

    // --------------------------------------------------------
    // COMBO / BANNER
    // --------------------------------------------------------

    if (
      req.body.comboOffer !==
      undefined
    ) {
      product.comboOffer =
        req.body.comboOffer;
    }

    if (
      req.body.bannerType !==
      undefined
    ) {
      product.bannerType =
        req.body.bannerType;
    }

    // --------------------------------------------------------
    // RATING
    // --------------------------------------------------------

    if (
      req.body.rating !==
        undefined &&
      req.body.rating !== ""
    ) {
      const rating =
        Number(
          req.body.rating
        );

      if (
        Number.isNaN(rating) ||
        rating < 0 ||
        rating > 5
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Rating must be between 0 and 5",
        });
      }

      product.rating =
        rating;
    }

    // --------------------------------------------------------
    // REVIEW COUNT
    // --------------------------------------------------------

    if (
      req.body.reviewCount !==
        undefined &&
      req.body.reviewCount !== ""
    ) {
      const reviewCount =
        Number(
          req.body.reviewCount
        );

      if (
        Number.isNaN(
          reviewCount
        ) ||
        reviewCount < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid reviewCount",
        });
      }

      product.reviewCount =
        reviewCount;
    }

    // --------------------------------------------------------
    // ACTIVE
    // --------------------------------------------------------

    if (
      req.body.isActive !==
      undefined
    ) {
      product.isActive =
        String(
          req.body.isActive
        ) === "true";
    }

    // --------------------------------------------------------
    // VARIANTS
    // --------------------------------------------------------

    if (
      req.body.variants !==
      undefined
    ) {
      let variants =
        req.body.variants;

      if (
        typeof variants ===
        "string"
      ) {
        variants =
          parseJSON(
            variants,
            []
          );
      }

      if (
        !Array.isArray(
          variants
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Variants must be an array",
        });
      }

      const oldMedia = [];

      product.variants.forEach(
        (variant) => {
          if (
            Array.isArray(
              variant.media
            )
          ) {
            oldMedia.push(
              ...variant.media
            );
          }
        }
      );

      const preparedVariants =
        prepareVariants(
          variants,
          product.name
        );

      // ------------------------------------------------------
      // DUPLICATE COLORS
      // ------------------------------------------------------

      const colors =
        preparedVariants.map(
          (variant) =>
            variant.color
        );

      const duplicateColors =
        colors.filter(
          (color, index) =>
            colors.indexOf(
              color
            ) !== index
        );

      if (
        duplicateColors.length
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Duplicate colors are not allowed",
          duplicateColors: [
            ...new Set(
              duplicateColors
            ),
          ],
        });
      }

      // ------------------------------------------------------
      // NEW MEDIA
      // ------------------------------------------------------

      if (req.files?.length) {
        const mediaColors =
          normalizeArray(
            req.body.mediaColors
          );

        if (
          mediaColors.length !==
          req.files.length
        ) {
          req.files.forEach(
            deleteUploadedFile
          );

          return res.status(400).json({
            success: false,
            message:
              "mediaColors count must match uploaded media count",
          });
        }

        attachUploadedMediaByColor(
          {
            variants:
              preparedVariants,
            files:
              req.files,
            mediaColors,
          }
        );
      }

      // ------------------------------------------------------
      // DELETE REMOVED MEDIA
      // ------------------------------------------------------

      const newMediaURLs =
        new Set();

      preparedVariants.forEach(
        (variant) => {
          variant.media.forEach(
            (media) => {
              if (
                media.imageURL
              ) {
                newMediaURLs.add(
                  media.imageURL
                );
              }

              if (
                media.thumbnail
              ) {
                newMediaURLs.add(
                  media.thumbnail
                );
              }
            }
          );
        }
      );

      oldMedia.forEach(
        (oldMediaItem) => {
          if (
            oldMediaItem.imageURL &&
            !newMediaURLs.has(
              oldMediaItem.imageURL
            )
          ) {
            deleteMediaFile(
              oldMediaItem.imageURL
            );
          }

          if (
            oldMediaItem.thumbnail &&
            !newMediaURLs.has(
              oldMediaItem.thumbnail
            )
          ) {
            deleteMediaFile(
              oldMediaItem.thumbnail
            );
          }
        }
      );

      product.variants =
        preparedVariants;
    }

    // --------------------------------------------------------
    // MEDIA ONLY
    // --------------------------------------------------------

    else if (
      req.files?.length
    ) {
      const mediaColors =
        normalizeArray(
          req.body.mediaColors
        );

      if (
        mediaColors.length !==
        req.files.length
      ) {
        req.files.forEach(
          deleteUploadedFile
        );

        return res.status(400).json({
          success: false,
          message:
            "mediaColors count must match uploaded media count",
        });
      }

      attachUploadedMediaByColor(
        {
          variants:
            product.variants,
          files:
            req.files,
          mediaColors,
        }
      );
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message:
        "Product updated successfully",
      data: product,
    });
  } catch (error) {
    console.error(
      "UPDATE PRODUCT ERROR:",
      error
    );

    if (req.files?.length) {
      req.files.forEach(
        deleteUploadedFile
      );
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to update product",
    });
  }
};

// ============================================================
// DELETE PRODUCT
// ============================================================

const deleteProduct = async (
  req,
  res
) => {
  try {
    const {
      productId,
    } = req.params;

    if (
      !isValidObjectId(
        productId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid productId",
      });
    }

    const product =
      await Product.findOne({
        _id: productId,
        isDeleted: false,
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found",
      });
    }

    product.variants.forEach(
      (variant) => {
        deleteMediaArray(
          variant.media
        );
      }
    );

    product.isDeleted =
      true;

    product.isActive =
      false;

    await product.save();

    return res.status(200).json({
      success: true,
      message:
        "Product deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE PRODUCT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to delete product",
    });
  }
};

// ============================================================
// ADD VARIANT MEDIA
// ============================================================

const addVariantMedia = async (
  req,
  res
) => {
  try {
    const {
      productId,
      variantId,
    } = req.params;

    if (
      !isValidObjectId(
        productId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid productId",
      });
    }

    if (
      !isValidObjectId(
        variantId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid variantId",
      });
    }

    if (
      !req.files?.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one media file is required",
      });
    }

    const product =
      await Product.findOne({
        _id: productId,
        isDeleted: false,
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found",
      });
    }

    const variant =
      product.variants.id(
        variantId
      );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message:
          "Variant not found",
      });
    }

    if (
      variant.media.length +
        req.files.length >
      10
    ) {
      req.files.forEach(
        deleteUploadedFile
      );

      return res.status(400).json({
        success: false,
        message:
          "Maximum 10 media files are allowed for each color",
      });
    }

    const uploadedMedia =
      prepareUploadedMedia(
        req.files
      );

    variant.media.push(
      ...uploadedMedia
    );

    await product.save();

    return res.status(200).json({
      success: true,
      message:
        "Variant media added successfully",
      data: product,
    });
  } catch (error) {
    console.error(
      "ADD VARIANT MEDIA ERROR:",
      error
    );

    if (req.files?.length) {
      req.files.forEach(
        deleteUploadedFile
      );
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to add variant media",
    });
  }
};

// ============================================================
// DELETE VARIANT MEDIA
// ============================================================

const deleteVariantMedia =
  async (
    req,
    res
  ) => {
    try {
      const {
        productId,
        variantId,
        mediaId,
      } = req.params;

      if (
        !isValidObjectId(
          productId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid productId",
        });
      }

      if (
        !isValidObjectId(
          variantId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid variantId",
        });
      }

      if (
        !isValidObjectId(
          mediaId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid mediaId",
        });
      }

      const product =
        await Product.findOne({
          _id: productId,
          isDeleted: false,
        });

      if (!product) {
        return res.status(404).json({
          success: false,
          message:
            "Product not found",
        });
      }

      const variant =
        product.variants.id(
          variantId
        );

      if (!variant) {
        return res.status(404).json({
          success: false,
          message:
            "Variant not found",
        });
      }

      const media =
        variant.media.id(
          mediaId
        );

      if (!media) {
        return res.status(404).json({
          success: false,
          message:
            "Media not found",
        });
      }

      if (
        media.imageURL
      ) {
        deleteMediaFile(
          media.imageURL
        );
      }

      if (
        media.thumbnail
      ) {
        deleteMediaFile(
          media.thumbnail
        );
      }

      media.deleteOne();

      await product.save();

      return res.status(200).json({
        success: true,
        message:
          "Variant media deleted successfully",
        data: product,
      });
    } catch (error) {
      console.error(
        "DELETE VARIANT MEDIA ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to delete variant media",
      });
    }
  };

// ============================================================
// BULK EXCEL UPLOAD
// ============================================================

const bulkUploadProducts = async (
  req,
  res
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          "Excel file is required",
      });
    }

    const workbook =
      XLSX.readFile(
        req.file.path
      );

    const sheetName =
      workbook.SheetNames[0];

    const worksheet =
      workbook.Sheets[
        sheetName
      ];

    const rows =
      XLSX.utils.sheet_to_json(
        worksheet,
        {
          defval: "",
        }
      );

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message:
          "Excel file is empty",
      });
    }

    // --------------------------------------------------------
    // GROUP BY PRODUCT NAME
    // --------------------------------------------------------

    const groupedProducts =
      {};

    rows.forEach((row) => {
      const productName =
        String(
          row["Product Name"] ||
            ""
        ).trim();

      if (!productName) {
        return;
      }

      if (
        !groupedProducts[
          productName
        ]
      ) {
        groupedProducts[
          productName
        ] = [];
      }

      groupedProducts[
        productName
      ].push(row);
    });

    const createdProducts =
      [];

    const errors = [];

    // --------------------------------------------------------
    // PROCESS EACH PRODUCT
    // --------------------------------------------------------

    for (
      const productName of
      Object.keys(
        groupedProducts
      )
    ) {
      try {
        const productRows =
          groupedProducts[
            productName
          ];

        const firstRow =
          productRows[0];

        // ----------------------------------------------------
        // BUILD VARIANTS
        // ----------------------------------------------------

        const variants = [];

        productRows.forEach(
          (row) => {
            const color =
              String(
                row["Color"] ||
                  "DEFAULT"
              )
                .trim()
                .toUpperCase();

            let variant =
              variants.find(
                (item) =>
                  item.color ===
                  color
              );

            if (!variant) {
              variant = {
                color,

                media: [],

                fabric:
                  row[
                    "Fabric"
                  ] || "",

                feel: "",

                lining:
                  row[
                    "Lining"
                  ] || "",

                sleeveStyle:
                  row[
                    "Sleeve Type"
                  ] || "",

                finishing: "",

                pocket:
                  row[
                    "Pocket"
                  ] || "",

                quantity: 0,

                price:
                  Number(
                    row[
                      "MRP"
                    ]
                  ) || 0,

                discountPrice:
                  Number(
                    row[
                      "Selling Price"
                    ]
                  ) || 0,

                offer: {
                  type:
                    row[
                      "Offer Type"
                    ] || "none",

                  value:
                    Number(
                      row[
                        "Offer Value"
                      ]
                    ) || 0,

                  startDate:
                    row[
                      "Offer Start Date"
                    ] || null,

                  endDate:
                    row[
                      "Offer End Date"
                    ] || null,
                },

                sizes: [],

                isActive: true,
              };

              // ------------------------------------------------
              // IMAGE URLS
              // ------------------------------------------------

              const imageColumns = [
                "Image URL 1",
                "Image URL 2",
                "Image URL 3",
              ];

              imageColumns.forEach(
                (column) => {
                  const imageURL =
                    String(
                      row[
                        column
                      ] || ""
                    ).trim();

                  if (imageURL) {
                    variant.media.push(
                      {
                        type:
                          "image",

                        imageURL,

                        thumbnail:
                          null,
                      }
                    );
                  }
                }
              );

              variants.push(
                variant
              );
            }

            // ------------------------------------------------
            // SIZE
            // ------------------------------------------------

            const size =
              normalizeSize(
                row["Size"]
              );

            if (size) {
              const existingSize =
                variant.sizes.find(
                  (item) =>
                    item.size ===
                    size
                );

              const stockQuantity =
                Number(
                  row[
                    "Stock Qty"
                  ]
                ) || 0;

              if (
                existingSize
              ) {
                existingSize.stockQuantity +=
                  stockQuantity;
              } else {
                variant.sizes.push(
                  {
                    size,

                    stockQuantity,

                    sku:
                      String(
                        row[
                          "SKU"
                        ] || ""
                      ).trim() ||
                      generateSKU(
                        productName,
                        color,
                        size
                      ),

                    barcode:
                      generateBarcode(),

                    isActive:
                      true,
                  }
                );
              }
            }
          }
        );

        // ------------------------------------------------------
        // CALCULATE QUANTITY
        // ------------------------------------------------------

        variants.forEach(
          (variant) => {
            variant.quantity =
              calculateVariantQuantity(
                variant.sizes
              );

            // If Selling Price is same as MRP,
            // discountPrice should be null.
            if (
              variant.discountPrice ===
              variant.price
            ) {
              variant.discountPrice =
                null;
            }
          }
        );

        // ------------------------------------------------------
        // DESCRIPTION
        // ------------------------------------------------------

        const description = {
          about:
            firstRow[
              "About / Description"
            ] || "",

          itemDetails:
            firstRow[
              "About / Description"
            ] || "",
        };

        // ------------------------------------------------------
        // CREATE PRODUCT
        // ------------------------------------------------------

        const product =
          new Product({
            name:
              productName,

            categoryId:
              null,

            subCategoryId:
              null,

            brandId:
              null,

            productType:
              firstRow[
                "Product Type"
              ] || "",

            fit:
              firstRow[
                "Fit"
              ] || "",

            length:
              firstRow[
                "Length"
              ] || "",

            description,

            features: [],

            comboOffer:
              firstRow[
                "Combo Offer"
              ] || "",

            bannerType:
              firstRow[
                "Banner Type"
              ] || "",

            rating: 0,

            reviewCount: 0,

            variants,

            isActive: true,

            isDeleted: false,
          });

        await product.save();

        createdProducts.push({
          productId:
            product._id,

          name:
            product.name,

          variants:
            product.variants
              .length,
        });
      } catch (error) {
        errors.push({
          productName,
          message:
            error.message,
        });
      }
    }

    // --------------------------------------------------------
    // DELETE EXCEL FILE
    // --------------------------------------------------------

    try {
      if (
        fs.existsSync(
          req.file.path
        )
      ) {
        fs.unlinkSync(
          req.file.path
        );
      }
    } catch (error) {
      console.error(
        "EXCEL DELETE ERROR:",
        error.message
      );
    }

    return res.status(201).json({
      success: true,

      message:
        "Bulk product upload completed",

      summary: {
        totalRows:
          rows.length,

        totalProducts:
          Object.keys(
            groupedProducts
          ).length,

        createdProducts:
          createdProducts.length,

        failedProducts:
          errors.length,
      },

      createdProducts,

      errors,
    });
  } catch (error) {
    console.error(
      "BULK UPLOAD ERROR:",
      error
    );

    if (
      req.file?.path &&
      fs.existsSync(
        req.file.path
      )
    ) {
      fs.unlinkSync(
        req.file.path
      );
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to upload products",
    });
  }
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  addVariantMedia,
  deleteVariantMedia,
  bulkUploadProducts,
};