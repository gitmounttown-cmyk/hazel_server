const mongoose = require("mongoose");

// ============================================================
// SIZE SCHEMA
// ============================================================

const SizeSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      enum: ["S", "M", "L", "XL", "2XL", "3XL"],
    },

    stockQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    sku: {
      type: String,
      trim: true,
      default: null,
    },

    barcode: {
      type: String,
      trim: true,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: true,
  }
);

// ============================================================
// MEDIA SCHEMA
// ============================================================

const MediaSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["image", "video"],
    },

    imageURL: {
      type: String,
      trim: true,
      default: null,
    },

    thumbnail: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    _id: true,
  }
);

// ============================================================
// OFFER SCHEMA
// ============================================================

const OfferSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["percentage", "fixed", "none"],
      default: "none",
    },

    value: {
      type: Number,
      default: 0,
      min: 0,
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

// ============================================================
// VARIANT SCHEMA
// ============================================================

const VariantSchema = new mongoose.Schema(
  {
    // ========================================================
    // COLOR
    // ========================================================

    color: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    // ========================================================
    // MEDIA
    // ========================================================

    media: {
      type: [MediaSchema],
      default: [],

      validate: {
        validator: function (media) {
          return media.length <= 10;
        },

        message:
          "Maximum 10 media files are allowed for each color",
      },
    },

    // ========================================================
    // PRODUCT DETAILS
    // ========================================================

    fabric: {
      type: String,
      trim: true,
      default: "",
    },

    feel: {
      type: String,
      trim: true,
      default: "",
    },

    lining: {
      type: String,
      trim: true,
      default: "",
    },

    // Keep this for backward compatibility
    sleeves: {
      type: String,
      trim: true,
      default: "",
    },

    finishing: {
      type: String,
      trim: true,
      default: "",
    },

    pocket: {
      type: String,
      trim: true,
      default: "",
    },

    // ========================================================
    // QUANTITY
    // ========================================================

    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ========================================================
    // PRICE
    // ========================================================

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    discountPrice: {
      type: Number,
      default: null,
      min: 0,
    },

    // ========================================================
    // OFFER
    // ========================================================

    offer: {
      type: OfferSchema,

      default: () => ({
        type: "none",
        value: 0,
        startDate: null,
        endDate: null,
      }),
    },

    // ========================================================
    // SIZES
    // ========================================================

    sizes: {
      type: [SizeSchema],
      default: [],
    },

    // ========================================================
    // VARIANT STATUS
    // ========================================================

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: true,
  }
);

// ============================================================
// PRODUCT SCHEMA
// ============================================================

const ProductSchema = new mongoose.Schema(
  {
    // ========================================================
    // CATEGORY
    // ========================================================

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    // ========================================================
    // SUB CATEGORY
    // ========================================================

    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      required: true,
    },

    // ========================================================
    // BRAND
    // ========================================================

    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
    },

    // ========================================================
    // PRODUCT NAME
    // ========================================================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    // ========================================================
    // DESCRIPTION
    // ========================================================

    description: {
      about: {
        type: String,
        trim: true,
        default: "",
      },

      itemDetails: {
        type: String,
        trim: true,
        default: "",
      },
    },

    // ========================================================
    // FEATURES
    // ========================================================
    // You can add more values later.

    features: {
      type: [
        {
          type: String,
          trim: true,
          enum: [
           "Side Pocket",
           "Cotton Lining",
           "Feeding Friendly",
           "Invisible Zipper",
           "Adjustable Rope",
           "Breathable"
          ],
        },
      ],

      default: [],
    },

    // ========================================================
    // SLEEVE STYLE
    // ========================================================

    sleeveStyle: {
      type: String,
      enum: [
        "Puff Sleeves",
        "Ruched Sleeves",
      ],

      default: null,
    },

    // ========================================================
    // AVAILABILITY
    // ========================================================

    availability: {
      type: String,
      enum: [
        "In Stock",
        "New Arrivals",
        
      ],
    },

    // ========================================================
    // RATING
    // ========================================================
    // Rating can be:
    // 0 = No rating
    // 1 = 1 star
    // 2 = 2 stars
    // 3 = 3 stars
    // 4 = 4 stars
    // 5 = 5 stars

    rating: {
      type: Number,

      enum: [0, 1, 2, 3, 4, 5],

      default: 0,
    },

    // ========================================================
    // REVIEW COUNT
    // ========================================================

    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ========================================================
    // VARIANTS
    // ========================================================

    variants: {
      type: [VariantSchema],
      default: [],
    },

    // ========================================================
    // ACTIVE STATUS
    // ========================================================

    isActive: {
      type: Boolean,
      default: true,
    },

    // ========================================================
    // DELETE STATUS
    // ========================================================

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },

  {
    timestamps: true,
  }
);

// ============================================================
// PRE SAVE
// ============================================================
// Calculate variant quantity
// Calculate product availability automatically
// ============================================================

ProductSchema.pre("save", function () {
  let totalQuantity = 0;

  if (Array.isArray(this.variants)) {
    this.variants.forEach((variant) => {
      if (Array.isArray(variant.sizes)) {
        variant.quantity = variant.sizes.reduce(
          (total, size) => {
            return (
              total +
              (Number(size.stockQuantity) || 0)
            );
          },
          0
        );
      } else {
        variant.quantity = 0;
      }

      totalQuantity += variant.quantity;
    });
  }

  // ==========================================================
  // AUTOMATIC AVAILABILITY
  // ==========================================================

  if (totalQuantity > 0) {
    this.availability = "In Stock";
  } else {
    this.availability = "Out of Stock";
  }
});

// ============================================================
// EXPORT
// ============================================================

module.exports = mongoose.model(
  "Product",
  ProductSchema
);