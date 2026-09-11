const mongoose = require("mongoose");

// *============================================================*
// *SIZE SCHEMA*
// *============================================================*

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

// *============================================================*
// *MEDIA SCHEMA*
// *============================================================*

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

// *============================================================*
// *OFFER SCHEMA*
// *============================================================*

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

// *============================================================*
// *VARIANT SCHEMA*
// *============================================================*

const VariantSchema = new mongoose.Schema(
  {
    // *----------------------------------------------------------*
    // *COLOR*
    // *----------------------------------------------------------*

    color: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    // *----------------------------------------------------------*
    // *MEDIA*
    // *----------------------------------------------------------*

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

    // *----------------------------------------------------------*
    // *PRODUCT DETAILS*
    // *----------------------------------------------------------*

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

    // *----------------------------------------------------------*
    // *TOTAL QUANTITY*
    // *----------------------------------------------------------*

    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    // *----------------------------------------------------------*
    // *PRICE*
    // *----------------------------------------------------------*

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

    // *----------------------------------------------------------*
    // *OFFER*
    // *----------------------------------------------------------*

    offer: {
      type: OfferSchema,

      default: () => ({
        type: "none",
        value: 0,
        startDate: null,
        endDate: null,
      }),
    },

    // *----------------------------------------------------------*
    // *SIZES*
    // *----------------------------------------------------------*

    sizes: {
      type: [SizeSchema],
      default: [],
    },

    // *----------------------------------------------------------*
    // *STATUS*
    // *----------------------------------------------------------*

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: true,
  }
);

// *============================================================*
// *PRODUCT SCHEMA*
// *============================================================*

const ProductSchema = new mongoose.Schema(
  {
    // *----------------------------------------------------------*
    // *CATEGORY*
    // *----------------------------------------------------------*

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: false,
      default: null,
    },

    // *----------------------------------------------------------*
    // *SUB CATEGORY*
    // *----------------------------------------------------------*

    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      required: true,
    },

    // *----------------------------------------------------------*
    // *BRAND*
    // *----------------------------------------------------------*

    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: false,
      default: null,
    },

    // *----------------------------------------------------------*
    // *PRODUCT NAME*
    // *----------------------------------------------------------*

    name: {
      type: String,
      required: true,
      trim: true,
    },

    // *----------------------------------------------------------*
    // *DESCRIPTION*
    // *----------------------------------------------------------*

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

    // *----------------------------------------------------------*
    // *RATING*
    // *----------------------------------------------------------*

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    // *----------------------------------------------------------*
    // *REVIEW COUNT*
    // *----------------------------------------------------------*

    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // *----------------------------------------------------------*
    // *VARIANTS*
    // *----------------------------------------------------------*

    variants: {
      type: [VariantSchema],
      default: [],
    },

    // *----------------------------------------------------------*
    // *ACTIVE STATUS*
    // *----------------------------------------------------------*

    isActive: {
      type: Boolean,
      default: true,
    },

    // *----------------------------------------------------------*
    // *DELETE STATUS*
    // *----------------------------------------------------------*

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// *============================================================*
// *PRE SAVE - SYNC VARIANT QUANTITY*
// *============================================================*

ProductSchema.pre("save", function () {
  if (Array.isArray(this.variants)) {
    this.variants.forEach((variant) => {
      if (Array.isArray(variant.sizes)) {
        variant.quantity = variant.sizes.reduce(
          (total, size) => {
            return total + (Number(size.stockQuantity) || 0);
          },
          0
        );
      } else {
        variant.quantity = 0;
      }
    });
  }
});

// *============================================================*
// *EXPORT*
// *============================================================*

module.exports = mongoose.model("Product", ProductSchema);