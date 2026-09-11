const Product = require("../models/productModel");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ============================================================
// FILE HELPERS
// ============================================================

const deleteUploadedFile = (file) => {
  if (!file || !file.path) {
    return;
  }

  try {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  } catch (error) {
    console.error(
      "Failed to delete uploaded file:",
      error.message
    );
  }
};

// ============================================================
// DELETE MEDIA FROM DISK
// ============================================================

const deleteMediaFile = (imageURL) => {
  if (!imageURL) {
    return;
  }

  try {
    const relativePath = String(imageURL)
      .replace(/^\/+/, "");

    const absolutePath = path.resolve(
      process.cwd(),
      relativePath
    );

    const uploadsRoot = path.resolve(
      process.cwd(),
      "uploads"
    );

    // Security check
    if (
      absolutePath !== uploadsRoot &&
      !absolutePath.startsWith(
        `${uploadsRoot}${path.sep}`
      )
    ) {
      console.error(
        "Blocked invalid media deletion path:",
        absolutePath
      );

      return;
    }

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    console.error(
      "Failed to delete media file:",
      error.message
    );
  }
};

// ============================================================
// DELETE MULTIPLE MEDIA
// ============================================================

const deleteMediaArray = (media = []) => {
  if (!Array.isArray(media)) {
    return;
  }

  media.forEach((item) => {
    if (item?.imageURL) {
      deleteMediaFile(item.imageURL);
    }
  });
};

// ============================================================
// RANDOM NUMBER
// ============================================================

const generateRandomNumber = (length = 4) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;

  return Math.floor(
    min +
      Math.random() *
        (max - min + 1)
  );
};

// ============================================================
// COLOR CODE
// ============================================================

const createColorCode = (color) => {
  return String(color || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 4)
    .toUpperCase();
};

// ============================================================
// PRODUCT CODE
// ============================================================

const createProductCode = (productName) => {
  return String(productName || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
};

// ============================================================
// GENERATE SKU
// ============================================================

const generateSKU = async (
  productName,
  color,
  size
) => {
  let sku;
  let exists = true;

  const productCode =
    createProductCode(productName);

  const colorCode =
    createColorCode(color);

  while (exists) {
    const randomNumber =
      generateRandomNumber(4);

    sku =
      `${productCode}-${colorCode}-${size}-${randomNumber}`;

    exists = await Product.exists({
      "variants.sizes.sku": sku,
    });
  }

  return sku;
};

// ============================================================
// GENERATE BARCODE
// ============================================================

const generateBarcode = async () => {
  let barcode;
  let exists = true;

  while (exists) {
    // 12 digit barcode
    barcode =
      "89" +
      crypto
        .randomBytes(5)
        .toString("hex")
        .replace(/\D/g, "")
        .padEnd(10, "0")
        .substring(0, 10);

    exists = await Product.exists({
      "variants.sizes.barcode": barcode,
    });
  }

  return barcode;
};

// ============================================================
// CALCULATE QUANTITY
// ============================================================

const calculateVariantQuantity = (
  sizes
) => {
  if (!Array.isArray(sizes)) {
    return 0;
  }

  return sizes.reduce(
    (total, size) => {
      return (
        total +
        (Number(size.stockQuantity) || 0)
      );
    },
    0
  );
};

// ============================================================
// PARSE JSON
// ============================================================

const parseJSON = (
  value,
  fallback
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

// ============================================================
// PREPARE UPLOADED MEDIA
// ============================================================

const prepareUploadedMedia = (
  files
) => {
  if (!Array.isArray(files)) {
    return [];
  }

  return files.map((file) => {
    const isVideo =
      file.mimetype &&
      file.mimetype.startsWith("video/");

    return {
      type: isVideo
        ? "video"
        : "image",

      imageURL:
        `/uploads/products/${file.filename}`,

      thumbnail: null,
    };
  });
};

// ============================================================
// NORMALIZE MEDIA
// ============================================================

const normalizeMedia = (
  media
) => {
  if (!Array.isArray(media)) {
    return [];
  }

  return media
    .filter(
      (item) =>
        item &&
        item.imageURL
    )
    .map((item) => ({
      _id:
        item._id ||
        new mongoose.Types.ObjectId(),

      type:
        item.type === "video"
          ? "video"
          : "image",

      imageURL: String(
        item.imageURL
      ),

      thumbnail:
        item.thumbnail || null,
    }));
};

// ============================================================
// PREPARE VARIANTS
// ============================================================

const prepareVariants = async (
  variants,
  productName,
  existingVariants = []
) => {
  if (!Array.isArray(variants)) {
    return [];
  }

  const preparedVariants = [];

  const allowedSizes = [
    "S",
    "M",
    "L",
    "XL",
    "2XL",
    "3XL",
  ];

  for (
    const variant of variants
  ) {
    const color = String(
      variant.color || ""
    )
      .trim()
      .toUpperCase();

    if (!color) {
      throw new Error(
        "Variant color is required"
      );
    }

    // --------------------------------------------------------
    // FIND EXISTING VARIANT
    // --------------------------------------------------------

    let existingVariant = null;

    if (variant._id) {
      existingVariant =
        existingVariants.id(
          variant._id
        );
    }

    if (!existingVariant) {
      existingVariant =
        existingVariants.find(
          (item) =>
            String(item.color)
              .trim()
              .toUpperCase() ===
            color
        );
    }

    // --------------------------------------------------------
    // MEDIA PRESERVATION
    // --------------------------------------------------------

    let media;

    if (
      Object.prototype.hasOwnProperty.call(
        variant,
        "media"
      )
    ) {
      media =
        normalizeMedia(
          variant.media
        );
    } else if (
      existingVariant
    ) {
      media =
        normalizeMedia(
          existingVariant.media
        );
    } else {
      media = [];
    }

    if (media.length > 10) {
      throw new Error(
        `Maximum 10 media files are allowed for ${color}`
      );
    }

    // --------------------------------------------------------
    // SIZES
    // --------------------------------------------------------

    const preparedSizes = [];

    const usedSizes = new Set();

    if (
      Array.isArray(
        variant.sizes
      )
    ) {
      for (
        const sizeData of
          variant.sizes
      ) {
        const size = String(
          sizeData.size || ""
        )
          .trim()
          .toUpperCase();

        if (!size) {
          continue;
        }

        if (
          !allowedSizes.includes(
            size
          )
        ) {
          throw new Error(
            `Invalid size "${size}". Allowed sizes: ${allowedSizes.join(
              ", "
            )}`
          );
        }

        if (
          usedSizes.has(size)
        ) {
          throw new Error(
            `Duplicate size "${size}" is not allowed for ${color}`
          );
        }

        usedSizes.add(size);

        const stockQuantity =
          Number(
            sizeData.stockQuantity
          ) || 0;

        if (stockQuantity < 0) {
          throw new Error(
            `Stock quantity cannot be negative for size ${size}`
          );
        }

        // ------------------------------------------------------
        // EXISTING SIZE
        // ------------------------------------------------------

        let existingSize = null;

        if (
          existingVariant &&
          sizeData._id
        ) {
          existingSize =
            existingVariant.sizes.id(
              sizeData._id
            );
        }

        if (!existingSize) {
          existingSize =
            existingVariant?.sizes?.find(
              (item) =>
                item.size ===
                size
            );
        }

        const sku =
          sizeData.sku ||
          existingSize?.sku ||
          (await generateSKU(
            productName,
            color,
            size
          ));

        const barcode =
          sizeData.barcode ||
          existingSize?.barcode ||
          (await generateBarcode());

        preparedSizes.push({
          _id:
            sizeData._id ||
            existingSize?._id ||
            new mongoose.Types.ObjectId(),

          size,

          stockQuantity,

          sku,

          barcode,

          isActive:
            sizeData.isActive !==
            undefined
              ? Boolean(
                  sizeData.isActive
                )
              : existingSize
              ? Boolean(
                  existingSize.isActive
                )
              : true,
        });
      }
    }

    // --------------------------------------------------------
    // QUANTITY
    // --------------------------------------------------------

    const quantity =
      calculateVariantQuantity(
        preparedSizes
      );

    // --------------------------------------------------------
    // PRICE
    // --------------------------------------------------------

    const price =
      Number(variant.price);

    if (
      Number.isNaN(price) ||
      price < 0
    ) {
      throw new Error(
        `Invalid price for ${color}`
      );
    }

    // --------------------------------------------------------
    // DISCOUNT PRICE
    // --------------------------------------------------------

    let discountPrice = null;

    if (
      variant.discountPrice !==
        undefined &&
      variant.discountPrice !==
        null &&
      variant.discountPrice !== ""
    ) {
      discountPrice = Number(
        variant.discountPrice
      );

      if (
        Number.isNaN(
          discountPrice
        ) ||
        discountPrice < 0
      ) {
        throw new Error(
          `Invalid discount price for ${color}`
        );
      }

      if (
        discountPrice > price
      ) {
        throw new Error(
          `Discount price cannot be greater than price for ${color}`
        );
      }
    }

    // --------------------------------------------------------
    // OFFER
    // --------------------------------------------------------

    const offer =
      variant.offer || {};

    const offerType =
      offer.type || "none";

    const offerValue =
      Number(
        offer.value
      ) || 0;

    const offerStartDate =
      offer.startDate ||
      null;

    const offerEndDate =
      offer.endDate ||
      null;

    if (
      ![
        "percentage",
        "fixed",
        "none",
      ].includes(offerType)
    ) {
      throw new Error(
        `Invalid offer type for ${color}`
      );
    }

    if (
      offerValue < 0
    ) {
      throw new Error(
        `Offer value cannot be negative for ${color}`
      );
    }

    if (
      offerType ===
        "percentage" &&
      offerValue > 100
    ) {
      throw new Error(
        `Percentage offer cannot exceed 100 for ${color}`
      );
    }

    if (
      offerType === "fixed" &&
      offerValue > price
    ) {
      throw new Error(
        `Fixed offer cannot be greater than price for ${color}`
      );
    }

    let parsedStartDate =
      null;

    let parsedEndDate =
      null;

    if (offerStartDate) {
      parsedStartDate =
        new Date(
          offerStartDate
        );

      if (
        Number.isNaN(
          parsedStartDate.getTime()
        )
      ) {
        throw new Error(
          `Invalid offer start date for ${color}`
        );
      }
    }

    if (offerEndDate) {
      parsedEndDate =
        new Date(
          offerEndDate
        );

      if (
        Number.isNaN(
          parsedEndDate.getTime()
        )
      ) {
        throw new Error(
          `Invalid offer end date for ${color}`
        );
      }
    }

    if (
      parsedStartDate &&
      parsedEndDate &&
      parsedStartDate >
        parsedEndDate
    ) {
      throw new Error(
        `Offer start date cannot be after end date for ${color}`
      );
    }

    // --------------------------------------------------------
    // PREPARED VARIANT
    // --------------------------------------------------------

    preparedVariants.push({
      _id:
        variant._id ||
        existingVariant?._id ||
        new mongoose.Types.ObjectId(),

      color,

      media,

      fabric:
        variant.fabric !==
        undefined
          ? String(
              variant.fabric
            ).trim()
          : existingVariant
          ? existingVariant.fabric
          : "",

      feel:
        variant.feel !==
        undefined
          ? String(
              variant.feel
            ).trim()
          : existingVariant
          ? existingVariant.feel
          : "",

      lining:
        variant.lining !==
        undefined
          ? String(
              variant.lining
            ).trim()
          : existingVariant
          ? existingVariant.lining
          : "",

      sleeves:
        variant.sleeves !==
        undefined
          ? String(
              variant.sleeves
            ).trim()
          : existingVariant
          ? existingVariant.sleeves
          : "",

      finishing:
        variant.finishing !==
        undefined
          ? String(
              variant.finishing
            ).trim()
          : existingVariant
          ? existingVariant.finishing
          : "",

      pocket:
        variant.pocket !==
        undefined
          ? String(
              variant.pocket
            ).trim()
          : existingVariant
          ? existingVariant.pocket
          : "",

      quantity,

      price,

      discountPrice,

      offer: {
        type: offerType,
        value: offerValue,
        startDate:
          parsedStartDate,
        endDate:
          parsedEndDate,
      },

      sizes:
        preparedSizes,

      isActive:
        variant.isActive !==
        undefined
          ? Boolean(
              variant.isActive
            )
          : existingVariant
          ? Boolean(
              existingVariant.isActive
            )
          : true,
    });
  }

  return preparedVariants;
};

// ============================================================
// VALIDATE ID
// ============================================================

const isValidObjectId = (
  id
) => {
  return mongoose.Types.ObjectId.isValid(
    id
  );
};

// ============================================================
// PARSE MEDIA COLORS
//
// Example:
//
// mediaColors = ["RED", "RED", "BLUE"]
//
// media files must be in same order:
// red1.jpg
// red2.jpg
// blue1.jpg
// ============================================================

const parseMediaColors = (
  value,
  fileCount
) => {
  if (
    value === undefined ||
    value === null
  ) {
    return [];
  }

  let parsed =
    value;

  if (
    typeof value === "string"
  ) {
    try {
      parsed =
        JSON.parse(value);
    } catch (error) {
      parsed = value
        .split(",")
        .map((item) =>
          item.trim()
        )
        .filter(Boolean);
    }
  }

  if (!Array.isArray(parsed)) {
    parsed = [parsed];
  }

  const colors =
    parsed.map((color) =>
      String(color)
        .trim()
        .toUpperCase()
    );

  if (
    colors.length !==
    fileCount
  ) {
    throw new Error(
      `mediaColors count (${colors.length}) must match uploaded media count (${fileCount})`
    );
  }

  return colors;
};

// ============================================================
// ATTACH UPLOADED MEDIA BY COLOR
// ============================================================

const attachUploadedMediaByColor = ({
  variants,
  files,
  mediaColors,
}) => {
  if (
    !Array.isArray(files) ||
    files.length === 0
  ) {
    return;
  }

  const uploadedMedia =
    prepareUploadedMedia(
      files
    );

  const colorMapping =
    mediaColors;

  if (
    !Array.isArray(
      colorMapping
    ) ||
    colorMapping.length !==
      uploadedMedia.length
  ) {
    throw new Error(
      "mediaColors must be supplied for every uploaded media file"
    );
  }

  uploadedMedia.forEach(
    (media, index) => {
      const color =
        colorMapping[index];

      const variant =
        variants.find(
          (item) =>
            item.color ===
            color
        );

      if (!variant) {
        throw new Error(
          `Uploaded media color "${color}" does not exist in product variants`
        );
      }

      if (
        variant.media.length >=
        10
      ) {
        throw new Error(
          `Maximum 10 media files are allowed for ${color}`
        );
      }

      variant.media.push(
        media
      );
    }
  );

  // Final validation
  variants.forEach(
    (variant) => {
      if (
        variant.media.length >
        10
      ) {
        throw new Error(
          `Maximum 10 media files are allowed for ${variant.color}`
        );
      }
    }
  );
};

// ============================================================
// CREATE PRODUCT
// POST /api/products/create
// ============================================================

exports.createProduct = async (
  req,
  res
) => {
  try {
    const {
      categoryId,
      subCategoryId,
      brandId,
      name,
      description,
      variants,
    } = req.body;

    // --------------------------------------------------------
    // VALIDATE SUB CATEGORY
    // --------------------------------------------------------

    if (!subCategoryId) {
      if (req.files) {
        req.files.forEach(
          deleteUploadedFile
        );
      }

      return res.status(400).json({
        success: false,
        message:
          "subCategoryId is required",
      });
    }

    if (
      !isValidObjectId(
        subCategoryId
      )
    ) {
      if (req.files) {
        req.files.forEach(
          deleteUploadedFile
        );
      }

      return res.status(400).json({
        success: false,
        message:
          "Invalid subCategory ID",
      });
    }

    // --------------------------------------------------------
    // BRAND
    // --------------------------------------------------------

    if (
      brandId &&
      !isValidObjectId(
        brandId
      )
    ) {
      if (req.files) {
        req.files.forEach(
          deleteUploadedFile
        );
      }

      return res.status(400).json({
        success: false,
        message:
          "Invalid brand ID",
      });
    }

    // --------------------------------------------------------
    // CATEGORY
    // --------------------------------------------------------

    if (
      categoryId &&
      !isValidObjectId(
        categoryId
      )
    ) {
      if (req.files) {
        req.files.forEach(
          deleteUploadedFile
        );
      }

      return res.status(400).json({
        success: false,
        message:
          "Invalid category ID",
      });
    }

    // --------------------------------------------------------
    // PRODUCT NAME
    // --------------------------------------------------------

    if (
      !name ||
      !String(name).trim()
    ) {
      if (req.files) {
        req.files.forEach(
          deleteUploadedFile
        );
      }

      return res.status(400).json({
        success: false,
        message:
          "Product name is required",
      });
    }

    // --------------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------------

    const parsedDescription =
      parseJSON(
        description,
        {
          about: "",
          itemDetails: "",
        }
      );

    // --------------------------------------------------------
    // VARIANTS
    // --------------------------------------------------------

    const parsedVariants =
      parseJSON(
        variants,
        []
      );

    if (
      !Array.isArray(
        parsedVariants
      )
    ) {
      if (req.files) {
        req.files.forEach(
          deleteUploadedFile
        );
      }

      return res.status(400).json({
        success: false,
        message:
          "variants must be an array",
      });
    }

    if (
      parsedVariants.length ===
      0
    ) {
      if (req.files) {
        req.files.forEach(
          deleteUploadedFile
        );
      }

      return res.status(400).json({
        success: false,
        message:
          "At least one product color variant is required",
      });
    }

    // --------------------------------------------------------
    // PREPARE VARIANTS
    // --------------------------------------------------------

    const preparedVariants =
      await prepareVariants(
        parsedVariants,
        String(name).trim()
      );

    // --------------------------------------------------------
    // DUPLICATE COLORS
    // --------------------------------------------------------

    const colors =
      preparedVariants.map(
        (variant) =>
          variant.color
      );

    const uniqueColors =
      new Set(colors);

    if (
      colors.length !==
      uniqueColors.size
    ) {
      if (req.files) {
        req.files.forEach(
          deleteUploadedFile
        );
      }

      return res.status(400).json({
        success: false,
        message:
          "Duplicate colors are not allowed in the same product",
      });
    }

    // --------------------------------------------------------
    // ATTACH MEDIA TO CORRECT COLOR
    // --------------------------------------------------------

    if (
      req.files &&
      req.files.length > 0
    ) {
      const mediaColors =
        parseMediaColors(
          req.body.mediaColors,
          req.files.length
        );

      attachUploadedMediaByColor({
        variants:
          preparedVariants,
        files: req.files,
        mediaColors,
      });
    }

    // --------------------------------------------------------
    // CREATE
    // --------------------------------------------------------

    const product =
      await Product.create({
        categoryId:
          categoryId || null,

        subCategoryId,

        brandId:
          brandId || null,

        name:
          String(name).trim(),

        description: {
          about:
            parsedDescription?.about ||
            "",

          itemDetails:
            parsedDescription?.itemDetails ||
            "",
        },

        variants:
          preparedVariants,

        isActive: true,

        isDeleted: false,
      });

    return res.status(201).json({
      success: true,
      message:
        "Product created successfully",
      data: product,
    });
  } catch (error) {
    console.error(
      "Create Product Error:",
      error
    );

    if (req.files) {
      req.files.forEach(
        deleteUploadedFile
      );
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to create product",
      error: error.message,
    });
  }
};

// ============================================================
// GET ALL PRODUCTS
// GET /api/products/all
// ============================================================

exports.getAllProducts = async (
  req,
  res
) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      categoryId,
      subCategoryId,
      brandId,
      isActive,
      size,
      variant,
      fabric,
      color,
      max_price,
      max_price_range,
      price_range_option,
      features,
      sleeve,
      availability,
      rating,
    } = req.query;

    const pageNumber =
      Math.max(
        Number(page) || 1,
        1
      );

    const limitNumber =
      Math.min(
        Math.max(
          Number(limit) || 10,
          1
        ),
        100
      );

    const skip =
      (pageNumber - 1) *
      limitNumber;

    // --------------------------------------------------------
    // BASE FILTER
    // --------------------------------------------------------

    const filter = {
      isDeleted: false,
    };

    // --------------------------------------------------------
    // SEARCH
    // --------------------------------------------------------

    if (
      search &&
      search.trim()
    ) {
      filter.name = {
        $regex:
          search.trim(),
        $options: "i",
      };
    }

    // --------------------------------------------------------
    // CATEGORY
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
            "Invalid category ID",
        });
      }

      filter.categoryId =
        categoryId;
    }

    // --------------------------------------------------------
    // SUB CATEGORY
    // --------------------------------------------------------

    if (subCategoryId) {
      if (
        !isValidObjectId(
          subCategoryId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid subCategory ID",
        });
      }

      filter.subCategoryId =
        subCategoryId;
    }

    // --------------------------------------------------------
    // BRAND
    // --------------------------------------------------------

    if (brandId) {
      if (
        !isValidObjectId(
          brandId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid brand ID",
        });
      }

      filter.brandId =
        brandId;
    }

    // --------------------------------------------------------
    // ACTIVE
    // --------------------------------------------------------

    if (
      isActive !==
      undefined
    ) {
      filter.isActive =
        isActive === "true";
    }

    // --------------------------------------------------------
    // SIZE
    // --------------------------------------------------------

    const targetSize =
      size || variant;

    if (targetSize) {
      const sizesArray =
        Array.isArray(
          targetSize
        )
          ? targetSize
          : [
              targetSize,
            ];

      filter.variants =
        filter.variants || {};

      filter.variants.$elemMatch =
        {
          sizes: {
            $elemMatch: {
              size: {
                $in: sizesArray.map(
                  (item) =>
                    String(
                      item
                    ).toUpperCase()
                ),
              },
            },
          },
        };
    }

    // --------------------------------------------------------
    // FABRIC
    // --------------------------------------------------------

    if (fabric) {
      const fabricsArray =
        Array.isArray(
          fabric
        )
          ? fabric
          : [fabric];

      filter.variants =
        filter.variants || {};

      filter.variants.$elemMatch =
        {
          ...(filter.variants.$elemMatch ||
            {}),
          fabric: {
            $in: fabricsArray,
          },
        };
    }

    // --------------------------------------------------------
    // COLOR
    // --------------------------------------------------------

    if (color) {
      const colorsArray =
        Array.isArray(
          color
        )
          ? color
          : [color];

      filter.variants =
        filter.variants || {};

      filter.variants.$elemMatch =
        {
          ...(filter.variants.$elemMatch ||
            {}),
          color: {
            $in: colorsArray.map(
              (item) =>
                String(
                  item
                ).toUpperCase()
            ),
          },
        };
    }

    // --------------------------------------------------------
    // FEATURES / POCKET
    // --------------------------------------------------------

    if (features) {
      const featuresArray =
        Array.isArray(
          features
        )
          ? features
          : [features];

      filter.variants =
        filter.variants || {};

      filter.variants.$elemMatch =
        {
          ...(filter.variants.$elemMatch ||
            {}),
          pocket: {
            $in: featuresArray,
          },
        };
    }

    // --------------------------------------------------------
    // SLEEVE
    // --------------------------------------------------------

    if (sleeve) {
      const sleeveArray =
        Array.isArray(
          sleeve
        )
          ? sleeve
          : [sleeve];

      filter.variants =
        filter.variants || {};

      filter.variants.$elemMatch =
        {
          ...(filter.variants.$elemMatch ||
            {}),
          sleeves: {
            $in: sleeveArray,
          },
        };
    }

    // --------------------------------------------------------
    // AVAILABILITY
    // --------------------------------------------------------

    if (availability) {
      filter.variants =
        filter.variants || {};

      if (
        availability ===
        "in-stock"
      ) {
        filter.variants.$elemMatch =
          {
            ...(filter.variants.$elemMatch ||
              {}),
            quantity: {
              $gt: 0,
            },
          };
      }

      if (
        availability ===
        "out-of-stock"
      ) {
        filter.variants.$elemMatch =
          {
            ...(filter.variants.$elemMatch ||
              {}),
            quantity: {
              $lte: 0,
            },
          };
      }
    }

    // --------------------------------------------------------
    // RATING
    // --------------------------------------------------------

    if (
      rating &&
      rating !== "any"
    ) {
      const minRating =
        Number(rating);

      if (
        !Number.isNaN(
          minRating
        )
      ) {
        filter.rating = {
          $gte: minRating,
        };
      }
    }

    // --------------------------------------------------------
    // PRICE
    // --------------------------------------------------------

    const priceOption =
      price_range_option ||
      ([
        "under_1000",
        "1000_1500",
        "1500_2000",
        "above_2000",
      ].includes(max_price)
        ? max_price
        : null);

    if (priceOption) {
      let priceCondition;

      if (
        priceOption ===
        "under_1000"
      ) {
        priceCondition = {
          $lt: 1000,
        };
      }

      if (
        priceOption ===
        "1000_1500"
      ) {
        priceCondition = {
          $gte: 1000,
          $lte: 1500,
        };
      }

      if (
        priceOption ===
        "1500_2000"
      ) {
        priceCondition = {
          $gte: 1500,
          $lte: 2000,
        };
      }

      if (
        priceOption ===
        "above_2000"
      ) {
        priceCondition = {
          $gt: 2000,
        };
      }

      if (priceCondition) {
        filter.variants =
          filter.variants || {};

        filter.variants.$elemMatch =
          {
            ...(filter.variants.$elemMatch ||
              {}),
            $or: [
              {
                price:
                  priceCondition,
              },
              {
                discountPrice:
                  priceCondition,
              },
            ],
          };
      }
    } else {
      const activeMaxPrice =
        max_price_range;

      if (
        activeMaxPrice &&
        !Number.isNaN(
          Number(
            activeMaxPrice
          )
        )
      ) {
        filter.variants =
          filter.variants || {};

        filter.variants.$elemMatch =
          {
            ...(filter.variants.$elemMatch ||
              {}),
            $or: [
              {
                price: {
                  $lte:
                    Number(
                      activeMaxPrice
                    ),
                },
              },
              {
                discountPrice: {
                  $lte:
                    Number(
                      activeMaxPrice
                    ),
                },
              },
            ],
          };
      }
    }

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
        .limit(limitNumber),

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
        total,

        page: pageNumber,

        limit: limitNumber,

        totalPages:
          Math.ceil(
            total /
              limitNumber
          ),
      },
    });
  } catch (error) {
    console.error(
      "Get Products Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch products",
      error: error.message,
    });
  }
};

// ============================================================
// GET PRODUCT BY ID
// GET /api/products/:productId
// ============================================================

exports.getProductById = async (
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
          "Invalid product ID",
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
      "Get Product Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch product",
      error: error.message,
    });
  }
};

// ============================================================
// UPDATE PRODUCT
// PUT /api/products/:productId
// ============================================================

exports.updateProduct = async (
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
      if (req.files) {
        req.files.forEach(
          deleteUploadedFile
        );
      }

      return res.status(400).json({
        success: false,
        message:
          "Invalid product ID",
      });
    }

    const product =
      await Product.findOne({
        _id: productId,
        isDeleted: false,
      });

    if (!product) {
      if (req.files) {
        req.files.forEach(
          deleteUploadedFile
        );
      }

      return res.status(404).json({
        success: false,
        message:
          "Product not found",
      });
    }

    const {
      categoryId,
      subCategoryId,
      brandId,
      name,
      description,
      variants,
      isActive,
    } = req.body;

    // --------------------------------------------------------
    // CATEGORY
    // --------------------------------------------------------

    if (
      categoryId !==
      undefined
    ) {
      if (
        categoryId &&
        !isValidObjectId(
          categoryId
        )
      ) {
        if (req.files) {
          req.files.forEach(
            deleteUploadedFile
          );
        }

        return res.status(400).json({
          success: false,
          message:
            "Invalid category ID",
        });
      }

      product.categoryId =
        categoryId || null;
    }

    // --------------------------------------------------------
    // SUB CATEGORY
    // --------------------------------------------------------

    if (
      subCategoryId !==
      undefined
    ) {
      if (
        !isValidObjectId(
          subCategoryId
        )
      ) {
        if (req.files) {
          req.files.forEach(
            deleteUploadedFile
          );
        }

        return res.status(400).json({
          success: false,
          message:
            "Invalid subCategory ID",
        });
      }

      product.subCategoryId =
        subCategoryId;
    }

    // --------------------------------------------------------
    // BRAND
    // --------------------------------------------------------

    if (
      brandId !==
      undefined
    ) {
      if (
        brandId &&
        !isValidObjectId(
          brandId
        )
      ) {
        if (req.files) {
          req.files.forEach(
            deleteUploadedFile
          );
        }

        return res.status(400).json({
          success: false,
          message:
            "Invalid brand ID",
        });
      }

      product.brandId =
        brandId || null;
    }

    // --------------------------------------------------------
    // NAME
    // --------------------------------------------------------

    if (
      name !==
      undefined
    ) {
      if (
        !String(name).trim()
      ) {
        if (req.files) {
          req.files.forEach(
            deleteUploadedFile
          );
        }

        return res.status(400).json({
          success: false,
          message:
            "Product name cannot be empty",
        });
      }

      product.name =
        String(name).trim();
    }

    // --------------------------------------------------------
    // ACTIVE
    // --------------------------------------------------------

    if (
      isActive !==
      undefined
    ) {
      product.isActive =
        isActive === true ||
        isActive === "true";
    }

    // --------------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------------

    if (
      description !==
      undefined
    ) {
      const parsedDescription =
        parseJSON(
          description,
          {
            about: "",
            itemDetails: "",
          }
        );

      product.description = {
        about:
          parsedDescription?.about ||
          "",

        itemDetails:
          parsedDescription?.itemDetails ||
          "",
      };
    }

    // --------------------------------------------------------
    // VARIANTS
    // --------------------------------------------------------

    if (
      variants !==
      undefined
    ) {
      const parsedVariants =
        parseJSON(
          variants,
          null
        );

      if (
        !Array.isArray(
          parsedVariants
        )
      ) {
        if (req.files) {
          req.files.forEach(
            deleteUploadedFile
          );
        }

        return res.status(400).json({
          success: false,
          message:
            "variants must be an array",
        });
      }

      if (
        parsedVariants.length ===
        0
      ) {
        if (req.files) {
          req.files.forEach(
            deleteUploadedFile
          );
        }

        return res.status(400).json({
          success: false,
          message:
            "At least one variant is required",
        });
      }

      // ------------------------------------------------------
      // KEEP ORIGINAL VARIANTS FOR FILE CLEANUP
      // ------------------------------------------------------

      const oldVariants =
        product.variants;

      // ------------------------------------------------------
      // PREPARE
      // ------------------------------------------------------

      const preparedVariants =
        await prepareVariants(
          parsedVariants,
          product.name,
          oldVariants
        );

      // ------------------------------------------------------
      // DUPLICATE COLORS
      // ------------------------------------------------------

      const colors =
        preparedVariants.map(
          (variant) =>
            variant.color
        );

      const uniqueColors =
        new Set(colors);

      if (
        colors.length !==
        uniqueColors.size
      ) {
        if (req.files) {
          req.files.forEach(
            deleteUploadedFile
          );
        }

        return res.status(400).json({
          success: false,
          message:
            "Duplicate colors are not allowed",
        });
      }

      // ------------------------------------------------------
      // MEDIA UPLOAD
      // ------------------------------------------------------

      if (
        req.files &&
        req.files.length > 0
      ) {
        const mediaColors =
          parseMediaColors(
            req.body.mediaColors,
            req.files.length
          );

        attachUploadedMediaByColor({
          variants:
            preparedVariants,
          files: req.files,
          mediaColors,
        });
      }

      // ------------------------------------------------------
      // DELETE OLD MEDIA THAT WAS REMOVED
      // ------------------------------------------------------

      const newVariantMap =
        new Map();

      preparedVariants.forEach(
        (variant) => {
          newVariantMap.set(
            String(
              variant._id
            ),
            variant
          );
        }
      );

      oldVariants.forEach(
        (oldVariant) => {
          const newVariant =
            newVariantMap.get(
              String(
                oldVariant._id
              )
            );

          // ----------------------------------------------------
          // VARIANT COMPLETELY REMOVED
          // ----------------------------------------------------

          if (!newVariant) {
            deleteMediaArray(
              oldVariant.media
            );

            return;
          }

          // ----------------------------------------------------
          // MEDIA REMOVED FROM EXISTING VARIANT
          // ----------------------------------------------------

          const newMediaUrls =
            new Set(
              (
                newVariant.media ||
                []
              ).map(
                (item) =>
                  String(
                    item.imageURL
                  )
              )
            );

          (
            oldVariant.media ||
            []
          ).forEach(
            (oldMedia) => {
              if (
                oldMedia.imageURL &&
                !newMediaUrls.has(
                  String(
                    oldMedia.imageURL
                  )
                )
              ) {
                deleteMediaFile(
                  oldMedia.imageURL
                );
              }
            }
          );
        }
      );

      product.variants =
        preparedVariants;
    } else if (
      req.files &&
      req.files.length > 0
    ) {
      // ------------------------------------------------------
      // MEDIA ONLY UPDATE
      //
      // mediaColors tells us which existing color receives
      // each uploaded file.
      // ------------------------------------------------------

      const mediaColors =
        parseMediaColors(
          req.body.mediaColors,
          req.files.length
        );

      const uploadedMedia =
        prepareUploadedMedia(
          req.files
        );

      for (
        let i = 0;
        i <
        uploadedMedia.length;
        i++
      ) {
        const color =
          mediaColors[i];

        const variant =
          product.variants.find(
            (item) =>
              String(
                item.color
              ).toUpperCase() ===
              color
          );

        if (!variant) {
          req.files.forEach(
            deleteUploadedFile
          );

          return res.status(404).json({
            success: false,
            message:
              `Variant color "${color}" not found`,
          });
        }

        if (
          variant.media.length >=
          10
        ) {
          req.files.forEach(
            deleteUploadedFile
          );

          return res.status(400).json({
            success: false,
            message:
              `Maximum 10 media files are allowed for ${color}`,
          });
        }

        variant.media.push(
          uploadedMedia[i]
        );
      }
    }

    // --------------------------------------------------------
    // SAVE
    // --------------------------------------------------------

    await product.save();

    return res.status(200).json({
      success: true,
      message:
        "Product updated successfully",
      data: product,
    });
  } catch (error) {
    console.error(
      "Update Product Error:",
      error
    );

    if (req.files) {
      req.files.forEach(
        deleteUploadedFile
      );
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to update product",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE PRODUCT
// DELETE /api/products/:productId
// ============================================================

exports.deleteProduct = async (
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
          "Invalid product ID",
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
    // DELETE PHYSICAL MEDIA
    // --------------------------------------------------------

    product.variants.forEach(
      (variant) => {
        deleteMediaArray(
          variant.media
        );
      }
    );

    // --------------------------------------------------------
    // SOFT DELETE
    // --------------------------------------------------------

    product.isDeleted = true;
    product.isActive = false;

    await product.save();

    return res.status(200).json({
      success: true,
      message:
        "Product deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Product Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete product",
      error: error.message,
    });
  }
};

// ============================================================
// ADD MEDIA TO VARIANT
// POST /api/products/:productId/variants/:variantId/media
// ============================================================

exports.addVariantMedia = async (
  req,
  res
) => {
  try {
    const {
      productId,
      variantId,
    } = req.params;

    // --------------------------------------------------------
    // VALIDATE IDS
    // --------------------------------------------------------

    if (
      !isValidObjectId(
        productId
      )
    ) {
      if (req.files) {
        req.files.forEach(
          deleteUploadedFile
        );
      }

      return res.status(400).json({
        success: false,
        message:
          "Invalid product ID",
      });
    }

    if (
      !isValidObjectId(
        variantId
      )
    ) {
      if (req.files) {
        req.files.forEach(
          deleteUploadedFile
        );
      }

      return res.status(400).json({
        success: false,
        message:
          "Invalid variant ID",
      });
    }

    // --------------------------------------------------------
    // FILES
    // --------------------------------------------------------

    if (
      !req.files ||
      req.files.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please upload at least one image or video",
      });
    }

    // --------------------------------------------------------
    // PRODUCT
    // --------------------------------------------------------

    const product =
      await Product.findOne({
        _id: productId,
        isDeleted: false,
      });

    if (!product) {
      req.files.forEach(
        deleteUploadedFile
      );

      return res.status(404).json({
        success: false,
        message:
          "Product not found",
      });
    }

    // --------------------------------------------------------
    // VARIANT
    // --------------------------------------------------------

    const variant =
      product.variants.id(
        variantId
      );

    if (!variant) {
      req.files.forEach(
        deleteUploadedFile
      );

      return res.status(404).json({
        success: false,
        message:
          "Product color variant not found",
      });
    }

    // --------------------------------------------------------
    // MAX 10
    // --------------------------------------------------------

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
          `Maximum 10 media files are allowed for ${variant.color}. ` +
          `Current: ${variant.media.length}, ` +
          `Trying to add: ${req.files.length}`,
      });
    }

    // --------------------------------------------------------
    // ADD MEDIA
    // --------------------------------------------------------

    const newMedia =
      prepareUploadedMedia(
        req.files
      );

    variant.media.push(
      ...newMedia
    );

    await product.save();

    return res.status(200).json({
      success: true,
      message:
        "Product media uploaded successfully",

      data: {
        productId:
          product._id,

        variantId:
          variant._id,

        color:
          variant.color,

        media:
          variant.media,
      },
    });
  } catch (error) {
    console.error(
      "Add Variant Media Error:",
      error
    );

    if (req.files) {
      req.files.forEach(
        deleteUploadedFile
      );
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to upload product media",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE VARIANT MEDIA
// DELETE /api/products/:productId/variants/:variantId/media/:mediaId
// ============================================================

exports.deleteVariantMedia = async (
  req,
  res
) => {
  try {
    const {
      productId,
      variantId,
      mediaId,
    } = req.params;

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (
      !isValidObjectId(
        productId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid product ID",
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
          "Invalid variant ID",
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
          "Invalid media ID",
      });
    }

    // --------------------------------------------------------
    // PRODUCT
    // --------------------------------------------------------

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
    // VARIANT
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // MEDIA
    // --------------------------------------------------------

    const mediaItem =
      variant.media.id(
        mediaId
      );

    if (!mediaItem) {
      return res.status(404).json({
        success: false,
        message:
          "Media not found",
      });
    }

    // --------------------------------------------------------
    // DELETE FILE
    // --------------------------------------------------------

    const imageURL =
      mediaItem.imageURL;

    deleteMediaFile(
      imageURL
    );

    // --------------------------------------------------------
    // REMOVE FROM MONGODB
    // --------------------------------------------------------

    mediaItem.deleteOne();

    await product.save();

    return res.status(200).json({
      success: true,
      message:
        "Product media deleted successfully",

      data: product,
    });
  } catch (error) {
    console.error(
      "Delete Variant Media Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete product media",
      error: error.message,
    });
  }
};