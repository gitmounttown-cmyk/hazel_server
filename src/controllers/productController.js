const Product = require("../models/productModel");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

// *============================================================*
// *CONSTANTS*
// *============================================================*

const AVAILABILITY_OPTIONS = [
  "In Stock",
  "Out of Stock",
];

const RATING_OPTIONS = [0, 1, 2, 3, 4, 5];

const SIZE_MAP = {
  XS: "XS",
  S: "S",
  M: "M",
  L: "L",
  XL: "XL",
  XXL: "XXL",
  "2XL": "2XL",
  XXXL: "3XL",
  "3XL": "3XL",
};

// *============================================================*
// *HELPERS*
// *============================================================*

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// *============================================================*
// *PARSE JSON*
// *============================================================*

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

// *============================================================*
// *NORMALIZE ARRAY*
// *============================================================*

const normalizeArray = (value) => {
  if (
    value === undefined ||
    value === null
  ) {
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

// *============================================================*
// *RANDOM NUMBER*
// *============================================================*

const generateRandomNumber = (length = 6) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;

  return Math.floor(
    Math.random() * (max - min + 1) + min
  );
};

// *============================================================*
// *COLOR CODE*
// *============================================================*

const createColorCode = (color) => {
  return String(color || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 4);
};

// *============================================================*
// *PRODUCT CODE*
// *============================================================*

const createProductCode = () => {
  return `HZP-${generateRandomNumber(6)}`;
};

// *============================================================*
// *SKU*
// *============================================================*

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

// *============================================================*
// *BARCODE*
// *============================================================*

const generateBarcode = () => {
  return `890${Date.now()}${generateRandomNumber(4)}`;
};

// *============================================================*
// *QUANTITY*
// *============================================================*

const calculateVariantQuantity = (sizes = []) => {
  return sizes.reduce(
    (total, size) =>
      total +
      (Number(size.stockQuantity) || 0),
    0
  );
};

// *============================================================*
// *NORMALIZE SIZE*
// *============================================================*

const normalizeSize = (value) => {
  const size = String(value || "")
    .trim()
    .toUpperCase();

  return SIZE_MAP[size] || size;
};

// *============================================================*
// *PREPARE UPLOADED MEDIA*
// *============================================================*

const prepareUploadedMedia = (files = []) => {
  return files.map((file) => {
    const isVideo =
      file.mimetype &&
      file.mimetype.startsWith("video/");

    return {
      type: isVideo
        ? "video"
        : "image",

      imageURL: `/uploads/products/${file.filename}`,

      thumbnail: null,
    };
  });
};

// *============================================================*
// *NORMALIZE MEDIA*
// *============================================================*

const normalizeMedia = (media = []) => {
  if (!Array.isArray(media)) {
    return [];
  }

  return media.map((item) => ({
    type:
      item.type || "image",

    imageURL:
      item.imageURL ||
      item.url ||
      null,

    thumbnail:
      item.thumbnail ||
      null,
  }));
};

// *============================================================*
// *DELETE UPLOADED FILE*
// *============================================================*

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

// *============================================================*
// *DELETE MEDIA FILE*
// *============================================================*

const deleteMediaFile = (imageURL) => {
  try {
    if (!imageURL) {
      return;
    }

    const cleanURL =
      imageURL.split("?")[0];

    const relativePath =
      cleanURL
        .replace(
          /^https?:\/\/[^/]+/i,
          ""
        )
        .replace(
          /^\/+/,
          ""
        );

    if (
      !relativePath.startsWith(
        "uploads/"
      )
    ) {
      return;
    }

    const uploadRoot =
      path.resolve(
        __dirname,
        "../uploads"
      );

    const filePath =
      path.resolve(
        __dirname,
        "..",
        relativePath
      );

    if (
      filePath.startsWith(
        uploadRoot
      ) &&
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

// *============================================================*
// *DELETE MEDIA ARRAY*
// *============================================================*

const deleteMediaArray = (
  mediaArray = []
) => {
  mediaArray.forEach((media) => {
    if (media?.imageURL) {
      deleteMediaFile(
        media.imageURL
      );
    }

    if (media?.thumbnail) {
      deleteMediaFile(
        media.thumbnail
      );
    }
  });
};

// *============================================================*
// *PREPARE VARIANTS*
// *============================================================*

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

      // --------------------------------------------------------
      // COLOR
      // --------------------------------------------------------

      if (!variant.color) {
        throw new Error(
          `Color is required for variant ${
            variantIndex + 1
          }`
        );
      }

      const color =
        String(variant.color)
          .trim()
          .toUpperCase();

      // --------------------------------------------------------
      // SIZES
      // --------------------------------------------------------

      let sizes =
        variant.sizes;

      if (
        typeof sizes === "string"
      ) {
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
          normalizeSize(
            size.size
          );

        if (!sizeValue) {
          throw new Error(
            `Size is required for color ${color}`
          );
        }

        return {
          _id: size._id,

          size: sizeValue,

          stockQuantity:
            Number(
              size.stockQuantity
            ) || 0,

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
            size.isActive !==
            undefined
              ? Boolean(
                  size.isActive
                )
              : true,
        };
      });

      // --------------------------------------------------------
      // MEDIA ALREADY INSIDE VARIANT
      // --------------------------------------------------------

      let media =
        variant.media;

      if (
        typeof media === "string"
      ) {
        media =
          parseJSON(
            media,
            []
          );
      }

      media =
        normalizeMedia(
          media
        );

      if (media.length > 10) {
        throw new Error(
          `Maximum 10 media files are allowed for color ${color}`
        );
      }

      // --------------------------------------------------------
      // QUANTITY
      // --------------------------------------------------------

      const quantity =
        calculateVariantQuantity(
          sizes
        );

      // --------------------------------------------------------
      // PRICE
      // --------------------------------------------------------

      const price =
        Number(
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

      // --------------------------------------------------------
      // DISCOUNT PRICE
      // --------------------------------------------------------

      let discountPrice =
        variant.discountPrice;

      if (
        discountPrice !==
          null &&
        discountPrice !==
          undefined &&
        discountPrice !== ""
      ) {
        discountPrice =
          Number(
            discountPrice
          );

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
          discountPrice >
          price
        ) {
          throw new Error(
            `discountPrice cannot be greater than price for color ${color}`
          );
        }
      } else {
        discountPrice = null;
      }

      // --------------------------------------------------------
      // OFFER
      // --------------------------------------------------------

      let offer =
        variant.offer;

      if (
        typeof offer === "string"
      ) {
        offer =
          parseJSON(
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

      // --------------------------------------------------------
      // RETURN VARIANT
      // --------------------------------------------------------

      return {
        _id: variant._id,

        color,

        media,

        fabric:
          variant.fabric ||
          "",

        feel:
          variant.feel ||
          "",

        lining:
          variant.lining ||
          "",

        sleeveStyle:
          variant.sleeveStyle ||
          "",

        finishing:
          variant.finishing ||
          "",

        pocket:
          variant.pocket ||
          "",

        quantity,

        price,

        discountPrice,

        offer,

        sizes,

        isActive:
          variant.isActive !==
          undefined
            ? Boolean(
                variant.isActive
              )
            : true,
      };
    }
  );
};

// *============================================================*
// *ATTACH UPLOADED MEDIA TO VARIANTS*
// *
// *NO mediaColors REQUIRED
// *============================================================*

const attachUploadedMediaToVariants = ({
  variants,
  files = [],
}) => {

  if (
    !files ||
    !files.length
  ) {
    return variants;
  }

  const uploadedMedia =
    prepareUploadedMedia(
      files
    );

  // ----------------------------------------------------------
  // CASE 1:
  // Only ONE variant/color
  //
  // Example:
  //
  // PINK
  //   1A.png
  //   1B.png
  //
  // All uploaded media go to PINK.
  // ----------------------------------------------------------

  if (
    variants.length === 1
  ) {
    const variant =
      variants[0];

    if (
      !Array.isArray(
        variant.media
      )
    ) {
      variant.media = [];
    }

    if (
      variant.media.length +
        uploadedMedia.length >
      10
    ) {
      throw new Error(
        `Maximum 10 media files are allowed for color ${variant.color}`
      );
    }

    variant.media.push(
      ...uploadedMedia
    );

    return variants;
  }

  // ----------------------------------------------------------
  // CASE 2:
  // Multiple variants/colors
  //
  // Since mediaColors is not being used,
  // the files are distributed sequentially.
  //
  // Example:
  //
  // variants:
  // PINK
  // BLUE
  //
  // files:
  // 1.png
  // 2.png
  // 3.png
  // 4.png
  //
  // Result:
  //
  // PINK -> 1.png, 3.png
  // BLUE -> 2.png, 4.png
  //
  // ----------------------------------------------------------

  uploadedMedia.forEach(
    (media, index) => {

      const variantIndex =
        index %
        variants.length;

      const variant =
        variants[
          variantIndex
        ];

      if (
        !Array.isArray(
          variant.media
        )
      ) {
        variant.media = [];
      }

      if (
        variant.media.length >= 10
      ) {
        throw new Error(
          `Maximum 10 media files are allowed for color ${variant.color}`
        );
      }

      variant.media.push(
        media
      );
    }
  );

  return variants;
};

// *============================================================*
// *CREATE PRODUCT*
// *============================================================*

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

    // *========================================================*
    // *PRODUCT NAME*
    // *========================================================*

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

    // *========================================================*
    // *CATEGORY ID*
    // *========================================================*

    if (
      categoryId &&
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

    // *========================================================*
    // *SUB CATEGORY ID*
    // *========================================================*

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

    // *========================================================*
    // *BRAND ID*
    // *========================================================*

    if (
      brandId &&
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

    // *========================================================*
    // *DESCRIPTION*
    // *========================================================*

    const parsedDescription =
      parseJSON(
        description,
        description || {}
      );

    // *========================================================*
    // *FEATURES*
    // *========================================================*

    const normalizedFeatures =
      normalizeArray(
        features
      );

    // *========================================================*
    // *RATING*
    // *========================================================*

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

    // *========================================================*
    // *REVIEW COUNT*
    // *========================================================*

    let productReviewCount = 0;

    if (
      reviewCount !==
        undefined &&
      reviewCount !== ""
    ) {

      productReviewCount =
        Number(
          reviewCount
        );

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

    // *========================================================*
    // *VARIANTS*
    // *========================================================*

    let variants =
      bodyVariants;

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

    if (
      variants.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one product variant is required",
      });
    }

    // *========================================================*
    // *PREPARE VARIANTS*
    // *========================================================*

    variants =
      prepareVariants(
        variants,
        name
      );

    // *========================================================*
    // *DUPLICATE COLORS*
    // *========================================================*

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

    // *========================================================*
    // *UPLOADED MEDIA*
    // *
    // *NO mediaColors*
    // *========================================================*

    if (
      req.files &&
      req.files.length
    ) {

      variants =
        attachUploadedMediaToVariants({
          variants,
          files:
            req.files,
        });
    }

    // *========================================================*
    // *CREATE PRODUCT*
    // *========================================================*

    const product =
      new Product({

        categoryId:
          categoryId ||
          null,

        subCategoryId:
          subCategoryId ||
          null,

        brandId:
          brandId ||
          null,

        name:
          String(
            name
          ).trim(),

        productType:
          productType ||
          "",

        fit:
          fit ||
          "",

        length:
          length ||
          "",

        description:
          parsedDescription,

        features:
          normalizedFeatures,

        comboOffer:
          comboOffer ||
          "",

        bannerType:
          bannerType ||
          "",

        rating:
          productRating,

        reviewCount:
          productReviewCount,

        variants,

        isActive:
          true,

        isDeleted:
          false,
      });

    // *========================================================*
    // *SAVE PRODUCT*
    // *========================================================*

    await product.save();

    // *========================================================*
    // *SUCCESS RESPONSE*
    // *========================================================*

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

    // *========================================================*
    // *DELETE UPLOADED FILES IF CREATE FAILED*
    // *========================================================*

    if (
      req.files &&
      req.files.length
    ) {

      req.files.forEach(
        deleteUploadedFile
      );
    }

    // *========================================================*
    // *VALIDATION ERROR*
    // *========================================================*

    if (
      error.name ===
      "ValidationError"
    ) {

      const errors =
        Object.values(
          error.errors
        ).map(
          (err) =>
            err.message
        );

      return res.status(400).json({

        success: false,

        message:
          "Product validation failed",

        errors,
      });
    }

    // *========================================================*
    // *DUPLICATE KEY ERROR*
    // *========================================================*

    if (
      error.code === 11000
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Duplicate product data",

        error:
          error.keyValue ||
          error.message,
      });
    }

    // *========================================================*
    // *GENERAL ERROR*
    // *========================================================*

    return res.status(500).json({

      success: false,

      message:
        error.message ||
        "Failed to create product",
    });
  }
};


// *============================================================*
// *GET ALL PRODUCTS*
// *GET /api/products/all*
// *============================================================*

const getAllProducts = async (req, res) => {
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
      pocket,

      features,

      sleeveStyle,
      sleeve,

      availability,

      rating,
      minRating,

      price,
      minPrice,
      maxPrice,
      max_price_range,
    } = req.query;

    // *========================================================*
    // *BASE FILTER*
    // *========================================================*

    const filter = {
      isDeleted: false,
    };

    // *========================================================*
    // *SEARCH*
    // *========================================================*

    if (
      search &&
      String(search).trim()
    ) {
      filter.name = {
        $regex: String(search).trim(),
        $options: "i",
      };
    }

    // *========================================================*
    // *CATEGORY*
    // *========================================================*

    if (categoryId) {
      if (
        !isValidObjectId(categoryId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid categoryId",
        });
      }

      filter.categoryId = categoryId;
    }

    // *========================================================*
    // *SUB CATEGORY*
    // *========================================================*

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

    // *========================================================*
    // *BRAND*
    // *========================================================*

    if (brandId) {
      if (
        !isValidObjectId(brandId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid brandId",
        });
      }

      filter.brandId = brandId;
    }

    // *========================================================*
    // *ACTIVE*
    // *========================================================*

    if (
      isActive !== undefined
    ) {
      filter.isActive =
        String(isActive) === "true";
    }

    // *========================================================*
    // *FEATURES*
    // *
    // *Product model:
    // *
    // *features: ["Breathable", "Feeding Friendly"]
    // *
    // *No FEATURE_OPTIONS required.
    // *========================================================*

    if (features) {
      const requestedFeatures =
        normalizeArray(features)
          .map((feature) =>
            String(feature).trim()
          )
          .filter(Boolean);

      if (
        requestedFeatures.length
      ) {
        filter.features = {
          $in: requestedFeatures,
        };
      }
    }

    // *========================================================*
    // *VARIANT FILTERS*
    // *
    // *All of these fields are inside variants.*
    // *========================================================*

    const variantMatch = {};

    // *========================================================*
    // *SIZE*
    // *========================================================*

    if (size) {
      const sizes =
        normalizeArray(size).map(
          (value) =>
            normalizeSize(value)
        );

      if (sizes.length) {
        variantMatch.sizes = {
          $elemMatch: {
            size: {
              $in: sizes,
            },
          },
        };
      }
    }

    // *========================================================*
    // *FABRIC*
    // *========================================================*

    if (fabric) {
      variantMatch.fabric = {
        $regex: String(fabric).trim(),
        $options: "i",
      };
    }

    // *========================================================*
    // *COLOR*
    // *========================================================*

    if (color) {
      const colors =
        normalizeArray(color).map(
          (value) =>
            String(value)
              .trim()
              .toUpperCase()
        );

      if (colors.length) {
        variantMatch.color = {
          $in: colors,
        };
      }
    }

    // *========================================================*
    // *POCKET*
    // *========================================================*

    if (pocket) {
      variantMatch.pocket = {
        $regex: String(pocket).trim(),
        $options: "i",
      };
    }

    // *========================================================*
    // *SLEEVE STYLE*
    // *
    // *Your schema has:
    // *
    // *variants[].sleeveStyle
    // *
    // *NOT:
    // *
    // *product.sleeveStyle
    // *========================================================*

    const requestedSleeveStyle =
      sleeveStyle || sleeve;

    if (
      requestedSleeveStyle
    ) {
      const sleeveStyles =
        normalizeArray(
          requestedSleeveStyle
        )
          .map((value) =>
            String(value).trim()
          )
          .filter(Boolean);

      if (sleeveStyles.length) {
        variantMatch.sleeveStyle = {
          $in: sleeveStyles,
        };
      }
    }

    // *========================================================*
    // *PRICE FILTER*
    // *
    // *Price is inside variants.*
    // *========================================================*

    if (price) {
      switch (price) {
        case "under_1000":
          variantMatch.price = {
            $lt: 1000,
          };
          break;

        case "1000_1500":
          variantMatch.price = {
            $gte: 1000,
            $lte: 1500,
          };
          break;

        case "1500_2000":
          variantMatch.price = {
            $gte: 1500,
            $lte: 2000,
          };
          break;

        case "above_2000":
          variantMatch.price = {
            $gt: 2000,
          };
          break;

        default:
          break;
      }
    }

    // *========================================================*
    // *MIN / MAX PRICE*
    // *========================================================*

    if (
      minPrice !== undefined ||
      maxPrice !== undefined ||
      max_price_range !== undefined
    ) {
      const priceFilter = {};

      // --------------------------------------------------------
      // MIN PRICE
      // --------------------------------------------------------

      if (
        minPrice !== undefined &&
        minPrice !== ""
      ) {
        const minimum =
          Number(minPrice);

        if (
          Number.isNaN(minimum)
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid minPrice",
          });
        }

        priceFilter.$gte =
          minimum;
      }

      // --------------------------------------------------------
      // MAX PRICE
      // --------------------------------------------------------

      const maximumPrice =
        maxPrice !== undefined
          ? maxPrice
          : max_price_range;

      if (
        maximumPrice !== undefined &&
        maximumPrice !== ""
      ) {
        const maximum =
          Number(maximumPrice);

        if (
          Number.isNaN(maximum)
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid maxPrice",
          });
        }

        priceFilter.$lte =
          maximum;
      }

      // --------------------------------------------------------
      // ADD PRICE TO VARIANT FILTER
      // --------------------------------------------------------

      if (
        Object.keys(
          priceFilter
        ).length
      ) {
        variantMatch.price =
          priceFilter;
      }
    }

    // *========================================================*
    // *APPLY VARIANT FILTER*
    // *
    // *This ensures all variant conditions belong to the same
    // *variant.*
    // *========================================================*

    if (
      Object.keys(
        variantMatch
      ).length > 0
    ) {
      filter.variants = {
        $elemMatch: variantMatch,
      };
    }

    // *========================================================*
    // *AVAILABILITY*
    // *
    // *availability is stored at product level.*
    // *========================================================*

    if (availability) {
      const availabilityValues =
        normalizeArray(
          availability
        )
          .map((value) =>
            String(value).trim()
          )
          .filter(Boolean);

      const invalidAvailability =
        availabilityValues.filter(
          (value) =>
            !AVAILABILITY_OPTIONS.includes(
              value
            )
        );

      if (
        invalidAvailability.length
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid availability filter",
          allowedAvailability:
            AVAILABILITY_OPTIONS,
          invalidAvailability,
        });
      }

      if (
        availabilityValues.length
      ) {
        filter.availability = {
          $in: availabilityValues,
        };
      }
    }

    // *========================================================*
    // *RATING*
    // *
    // *rating is stored at product level.*
    // *========================================================*

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
        !RATING_OPTIONS.includes(
          minimumRating
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Rating filter must be 0, 1, 2, 3, 4 or 5",
          allowedRatings:
            RATING_OPTIONS,
        });
      }

      filter.rating = {
        $gte: minimumRating,
      };
    }

    // *========================================================*
    // *PAGINATION*
    // *========================================================*

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

    // *========================================================*
    // *DATABASE QUERY*
    // *========================================================*

    const [
      products,
      total,
    ] = await Promise.all([
      Product.find(filter)
        .populate(
          "categoryId"
        )
        .populate(
          "subCategoryId"
        )
        .populate(
          "brandId"
        )
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber),

      Product.countDocuments(
        filter
      ),
    ]);

    // *========================================================*
    // *RESPONSE*
    // *========================================================*

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

// *============================================================*
// *GET PRODUCT BY ID*
// *GET /api/products/:productId
// *============================================================*

const getProductById = async (
  req,
  res
) => {
  try {
    const {
      productId,
    } = req.params;

    if (
      !isValidObjectId(productId)
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
        .populate(
          "categoryId"
        )
        .populate(
          "subCategoryId"
        )
        .populate(
          "brandId"
        );

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

// *============================================================*
// *UPDATE PRODUCT*
// *PUT /api/products/:productId
// *============================================================*

const updateProduct = async (
  req,
  res
) => {
  try {
    const {
      productId,
    } = req.params;

    if (
      !isValidObjectId(productId)
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

    // *========================================================*
    // *BASIC FIELDS*
    // *========================================================*

    if (
      req.body.name !== undefined
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
        req.body.subCategoryId;
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

    // *========================================================*
    // *DESCRIPTION*
    // *========================================================*

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

    // *========================================================*
    // *FEATURES*
    // *========================================================*

    if (
      req.body.features !==
      undefined
    ) {
      product.features =
        normalizeFeatures(
          req.body.features
        );
    }

    // *========================================================*
    // *SLEEVE STYLE*
    // *========================================================*

    if (
      req.body.sleeveStyle !==
      undefined
    ) {
      product.sleeveStyle =
        normalizeSleeveStyle(
          req.body.sleeveStyle
        );
    }

    // *========================================================*
    // *RATING*
    // *========================================================*

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
        !RATING_OPTIONS.includes(
          rating
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Rating must be 0, 1, 2, 3, 4 or 5",
        });
      }

      product.rating =
        rating;
    }

    // *========================================================*
    // *REVIEW COUNT*
    // *========================================================*

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

    // *========================================================*
    // *ACTIVE STATUS*
    // *========================================================*

    if (
      req.body.isActive !==
      undefined
    ) {
      product.isActive =
        String(
          req.body.isActive
        ) === "true";
    }

    // *========================================================*
    // *UPDATE VARIANTS*
    // *========================================================*

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

      if (!Array.isArray(variants)) {
        return res.status(400).json({
          success: false,
          message:
            "Variants must be an array",
        });
      }

      const oldVariants =
        product.variants;

      const oldMedia = [];

      oldVariants.forEach(
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
          product.name,
          oldVariants
        );

      // *======================================================*
      // *CHECK DUPLICATE COLORS*
      // *======================================================*

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

      // *======================================================*
      // *ATTACH NEW MEDIA*
      // *======================================================*

      if (req.files?.length) {
        const mediaColors =
          parseMediaColors(
            req.body.mediaColors,
            req.files.length
          );

        attachUploadedMediaByColor(
          {
            variants:
              preparedVariants,
            files: req.files,
            mediaColors,
          }
        );
      }

      // *======================================================*
      // *DELETE REMOVED MEDIA*
      // *======================================================*

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
          const imageURL =
            oldMediaItem.imageURL;

          const thumbnail =
            oldMediaItem.thumbnail;

          if (
            imageURL &&
            !newMediaURLs.has(
              imageURL
            )
          ) {
            deleteMediaFile(
              imageURL
            );
          }

          if (
            thumbnail &&
            !newMediaURLs.has(
              thumbnail
            )
          ) {
            deleteMediaFile(
              thumbnail
            );
          }
        }
      );

      product.variants =
        preparedVariants;
    } else if (
      req.files?.length
    ) {
      // *======================================================*
      // *MEDIA-ONLY UPDATE*
      // *======================================================*

      const mediaColors =
        parseMediaColors(
          req.body.mediaColors,
          req.files.length
        );

      attachUploadedMediaByColor({
        variants:
          product.variants,
        files: req.files,
        mediaColors,
      });
    }

    // *========================================================*
    // *SAVE*
    // *========================================================*

    // *pre-save recalculates quantity
    // *and availability.
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

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to update product",
    });
  }
};

// *============================================================*
// *DELETE PRODUCT*
// *DELETE /api/products/:productId
// *============================================================*

const deleteProduct = async (
  req,
  res
) => {
  try {
    const {
      productId,
    } = req.params;

    if (
      !isValidObjectId(productId)
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

    // *========================================================*
    // *DELETE MEDIA FILES*
    // *========================================================*

    product.variants.forEach(
      (variant) => {
        deleteMediaArray(
          variant.media
        );
      }
    );

    // *========================================================*
    // *SOFT DELETE*
    // *========================================================*

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

// *============================================================*
// *ADD VARIANT MEDIA*
// *POST /api/products/:productId/variants/:variantId/media
// *============================================================*

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

// *============================================================*
// *DELETE VARIANT MEDIA*
// *DELETE /api/products/:productId/variants/:variantId/media/:mediaId
// *============================================================*

const deleteVariantMedia =
  async (req, res) => {
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

      // *======================================================*
      // *DELETE PHYSICAL FILE*
      // *======================================================*

      if (media.imageURL) {
        deleteMediaFile(
          media.imageURL
        );
      }

      if (media.thumbnail) {
        deleteMediaFile(
          media.thumbnail
        );
      }

      // *======================================================*
      // *REMOVE MEDIA*
      // *======================================================*

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

// *============================================================*
// *EXPORT CONTROLLERS*
// *============================================================*

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  addVariantMedia,
  deleteVariantMedia,
};