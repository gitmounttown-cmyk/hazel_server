const mongoose = require("mongoose");
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
const VariantSchema = new mongoose.Schema(
  {
    color: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
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
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
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
    offer: {
      type: OfferSchema,

      default: () => ({
        type: "none",
        value: 0,
        startDate: null,
        endDate: null,
      }),
    },
    sizes: {
      type: [SizeSchema],
      default: [],
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
const ProductSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      required: true,
    },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
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
    sleeveStyle: {
      type: String,
      enum: [
        "Puff Sleeves",
        "Ruched Sleeves",
      ],
      default: null,
    },
    availability: {
      type: String,
      enum: [
        "In Stock",
        "New Arrivals",
      ],
    },
    rating: {
      type: Number,
      enum: [0, 1, 2, 3, 4, 5],
      default: 0,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    variants: {
      type: [VariantSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
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