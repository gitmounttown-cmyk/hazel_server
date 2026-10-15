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

    // --- SIZE FILTER FIX ---
    if (req.query.size) {
      const sizesArray = req.query.size.split(",").map((s) => s.trim());
      // Target the subdocument property directly to prevent schema type collisions
      filter["variants.sizes.size"] = { $in: sizesArray };
    }

    if (req.query.fabric) {
      const fabricsArray = req.query.fabric.split(",").map((f) => f.trim());
      filter["variants.fabric"] = { $in: fabricsArray };
    }

    if (req.query.sleeve) {
      const sleevesArray = req.query.sleeve.split(",").map((s) => s.trim());
      filter["variants.sleeveStyle"] = { $in: sleevesArray };
    }

    // --- SORTING LOGIC ---
    let sortCriteria = { createdAt: -1 };
    const sortBy = req.query.sort;

    if (sortBy === "price_low") {
      sortCriteria = { "variants.price": 1 };
    } else if (sortBy === "price_high") {
      sortCriteria = { "variants.price": -1 };
    } else if (sortBy === "rating") {
      sortCriteria = { rating: -1 };
    } else if (sortBy === "newest") {
      sortCriteria = { createdAt: -1 };
    }

    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .populate("categoryId", "name")
      .populate("brandId", "name")
      .skip(skip)
      .limit(limit)
      .sort(sortCriteria)
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
// exports.createProduct = async (req, res) => {
//   try {
//     const { categoryId, brandId, name, description, variants, isActive } = req.body;

//     if (!name || !brandId) {
//       return res.status(400).json({
//         success: false,
//         message: "Product Name and Brand are required",
//       });
//     }

//     let parsedDescription = {};
//     if (description) {
//       parsedDescription = typeof description === "string" ? JSON.parse(description) : description;
//     }

//     let parsedVariants = [];
//     if (variants) {
//       parsedVariants = typeof variants === "string" ? JSON.parse(variants) : variants;
//     }

//     if (req.files && req.files.length > 0 && parsedVariants.length > 0) {
//       const uploadedMedia = req.files.map((file) => ({
//         imageURL: formatMediaPath(file),
//         type: file.mimetype.startsWith("video/") ? "video" : "image",
//       }));

//       if (!parsedVariants[0].media) parsedVariants[0].media = [];
//       parsedVariants[0].media.push(...uploadedMedia);
//     }

//     const newProduct = new Product({
//       categoryId: categoryId || null,
//       brandId,
//       name,
//       description: parsedDescription,
//       variants: parsedVariants,
//       isActive: isActive !== undefined ? isActive : true,
//     });

//     await newProduct.save();

//     const populatedProduct = await Product.findById(newProduct._id)
//       .populate("categoryId", "name")
//       .populate("brandId", "name");

//     return res.status(201).json({
//       success: true,
//       message: "Product created successfully",
//       data: populatedProduct,
//     });
//   } catch (error) {
//     console.error("Error in createProduct:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || "Failed to create product",
//     });
//   }
// };

exports.createProduct = async (req, res) => {
  try {
    const {
      categoryId,
      brandId,
      name,
      description,
      variants,
      isActive,
    } = req.body;

    if (!name || !brandId) {
      return res.status(400).json({
        success: false,
        message: "Product Name and Brand are required",
      });
    }

    // Parse description
    const parsedDescription = description
      ? typeof description === "string"
        ? JSON.parse(description)
        : description
      : {};

    // Parse variants
    const parsedVariants = variants
      ? typeof variants === "string"
        ? JSON.parse(variants)
        : variants
      : [];

    if (!Array.isArray(parsedVariants)) {
      return res.status(400).json({
        success: false,
        message: "Invalid variants data",
      });
    }

    // Uploaded files from Multer
    const files = req.files || [];

    // Get mediaVariantIndex values from FormData
    let variantIndexes = req.body.mediaVariantIndex || [];

    if (!Array.isArray(variantIndexes)) {
      variantIndexes = [variantIndexes];
    }

    // Track the selected uploaded media index for each variant.
    // null means the user has not selected a new thumbnail.
    const selectedMediaIndexes = parsedVariants.map(() => null);

    // Track upload order separately for each variant.
    const pendingIndexes = parsedVariants.map(() => 0);

    // Attach uploaded files to their respective variants.
    files.forEach((file, fileIndex) => {
      const variantIndex = Number(
        variantIndexes[fileIndex] ?? 0
      );

      if (
        !Number.isInteger(variantIndex) ||
        variantIndex < 0 ||
        variantIndex >= parsedVariants.length
      ) {
        throw new Error(
          `Invalid variant index for uploaded file ${file.originalname}`
        );
      }

      const variant = parsedVariants[variantIndex];

      if (!Array.isArray(variant.media)) {
        variant.media = [];
      }

      if (variant.media.length >= 10) {
        throw new Error(
          `Maximum 10 media files are allowed for color ${
            variant.color || variantIndex + 1
          }`
        );
      }

      // Index among newly uploaded files for this variant.
      const uploadedIndex = pendingIndexes[variantIndex]++;

      // Add the uploaded media.
      variant.media.push({
        type: file.mimetype.startsWith("video/")
          ? "video"
          : "image",
        imageURL: formatMediaPath(file),
        thumbnail: null,
      });

      // Record which newly uploaded image was selected.
      if (
        variant.thumbnailPendingIndex !== null &&
        variant.thumbnailPendingIndex !== undefined &&
        variant.thumbnailPendingIndex !== "" &&
        Number.isInteger(Number(variant.thumbnailPendingIndex)) &&
        Number(variant.thumbnailPendingIndex) === uploadedIndex
      ) {
        selectedMediaIndexes[variantIndex] =
          variant.media.length - 1;
      }
    });

    // Remove frontend-only fields before constructing the document.
    parsedVariants.forEach((variant) => {
      delete variant.thumbnailPendingIndex;
      delete variant.removedMediaIds;
    });

    // Create the Mongoose document first.
    // Mongoose generates _id values for media subdocuments here.
    const newProduct = new Product({
      categoryId: categoryId || null,
      brandId,
      name,
      description: parsedDescription,
      variants: parsedVariants,
      isActive:
        isActive === undefined
          ? true
          : isActive === "true" || isActive === true,
    });

    // Resolve thumbnailId using the generated media subdocument IDs.
    newProduct.variants.forEach((variant, variantIndex) => {
      const selectedIndex = selectedMediaIndexes[variantIndex];

      // Use the newly uploaded image selected by the frontend.
      if (
        selectedIndex !== null &&
        variant.media &&
        variant.media[selectedIndex]
      ) {
        variant.thumbnailId =
          variant.media[selectedIndex]._id;
      } else {
        // Preserve an existing thumbnail if its media still exists.
        const existingThumbnail = variant.thumbnailId
          ? variant.media.find(
              (media) =>
                String(media._id) ===
                String(variant.thumbnailId)
            )
          : null;

        if (existingThumbnail) {
          variant.thumbnailId = existingThumbnail._id;
        } else {
          // Default to the first available media item.
          variant.thumbnailId =
            variant.media && variant.media.length > 0
              ? variant.media[0]._id
              : null;
        }
      }

      console.log(
        `Variant ${variantIndex} (${variant.color}) thumbnailId:`,
        variant.thumbnailId
          ? String(variant.thumbnailId)
          : null
      );
    });

    // Save after thumbnailId has been assigned.
    await newProduct.save();

    const populatedProduct = await Product.findById(
      newProduct._id
    )
      .populate("categoryId", "name")
      .populate("brandId", "name");

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: populatedProduct,
    });
  } catch (error) {
    console.error("Error in createProduct:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create product",
    });
  }
};



// UPDATE PRODUCT
// exports.updateProduct = async (req, res) => {
//   try {
//     const { productId } = req.params;
//     const { categoryId, brandId, name, description, variants, isActive } = req.body;

//     const product = await Product.findById(productId);
//     if (!product) {
//       return res.status(404).json({
//         success: false,
//         message: "Product not found",
//       });
//     }

//     if (name) product.name = name;
//     if (brandId) product.brandId = brandId;
//     if (categoryId !== undefined) product.categoryId = categoryId || null;
//     if (isActive !== undefined) product.isActive = isActive;

//     if (description) {
//       product.description = typeof description === "string" ? JSON.parse(description) : description;
//     }

//     if (variants) {
//       const parsedVariants = typeof variants === "string" ? JSON.parse(variants) : variants;

//       if (req.files && req.files.length > 0 && parsedVariants.length > 0) {
//         const uploadedMedia = req.files.map((file) => ({
//           imageURL: formatMediaPath(file),
//           type: file.mimetype.startsWith("video/") ? "video" : "image",
//         }));

//         if (!parsedVariants[0].media) parsedVariants[0].media = [];
//         parsedVariants[0].media.push(...uploadedMedia);
//       }

//       product.variants = parsedVariants;
//     }

//     await product.save();

//     const updatedProduct = await Product.findById(productId)
//       .populate("categoryId", "name")
//       .populate("brandId", "name");

//     return res.status(200).json({
//       success: true,
//       message: "Product updated successfully",
//       data: updatedProduct,
//     });
//   } catch (error) {
//     console.error("Error in updateProduct:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || "Failed to update product",
//     });
//   }
// };


exports.updateProduct = async (req, res) => {
  try {
    const {
      productId,
    } = req.params;

    const {
      categoryId,
      brandId,
      name,
      description,
      variants,
      isActive,
    } = req.body;

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Update basic fields
    if (name !== undefined) product.name = name;
    if (brandId !== undefined) product.brandId = brandId;

    if (categoryId !== undefined) {
      product.categoryId = categoryId || null;
    }

    if (isActive !== undefined) {
      product.isActive =
        isActive === true || isActive === "true";
    }

    if (description !== undefined) {
      product.description =
        typeof description === "string"
          ? JSON.parse(description)
          : description;
    }

    if (variants === undefined) {
      await product.save();

      const updatedProduct = await Product.findById(productId)
        .populate("categoryId", "name")
        .populate("brandId", "name");

      return res.status(200).json({
        success: true,
        message: "Product updated successfully",
        data: updatedProduct,
      });
    }

    const parsedVariants =
      typeof variants === "string"
        ? JSON.parse(variants)
        : variants;

    if (!Array.isArray(parsedVariants)) {
      return res.status(400).json({
        success: false,
        message: "Invalid variants data",
      });
    }

    const files = req.files || [];

    // Multer/FormData may provide a single value or an array.
    let variantIndexes = req.body.mediaVariantIndex || [];

    if (!Array.isArray(variantIndexes)) {
      variantIndexes = [variantIndexes];
    }

    // Group uploaded media by variant index.
    const uploadsByVariant = parsedVariants.map(() => []);

    files.forEach((file, fileIndex) => {
      const variantIndex = Number(
        variantIndexes[fileIndex] ?? 0
      );

      if (
        !Number.isInteger(variantIndex) ||
        variantIndex < 0 ||
        variantIndex >= parsedVariants.length
      ) {
        throw new Error(
          `Invalid mediaVariantIndex for ${file.originalname}`
        );
      }

      if (uploadsByVariant[variantIndex].length >= 10) {
        throw new Error(
          `Maximum 10 uploaded media files allowed for variant ${
            variantIndex + 1
          }`
        );
      }

      uploadsByVariant[variantIndex].push({
        type: file.mimetype.startsWith("video/")
          ? "video"
          : "image",
        imageURL: formatMediaPath(file),
        thumbnail: null,
      });
    });

    // Build each updated variant.
    const updatedVariants = parsedVariants.map(
      (submittedVariant, variantIndex) => {
        const existingVariant =
          submittedVariant._id
            ? product.variants.find(
                (variant) =>
                  String(variant._id) ===
                  String(submittedVariant._id)
              )
            : product.variants[variantIndex];

        // Existing media belonging to this variant.
        const oldMedia = existingVariant
          ? existingVariant.media || []
          : [];

        // Media IDs explicitly removed by the frontend.
        const removedMediaIds = Array.isArray(
          submittedVariant.removedMediaIds
        )
          ? submittedVariant.removedMediaIds.map(String)
          : [];

        // Preserve existing media except explicitly removed files.
        const keptMedia = oldMedia.filter(
          (media) =>
            !removedMediaIds.includes(String(media._id))
        );

        // Append new uploads for this variant.
        const newMedia = uploadsByVariant[variantIndex];

        const combinedMedia = [
          ...keptMedia.map((media) =>
            typeof media.toObject === "function"
              ? media.toObject()
              : media
          ),
          ...newMedia,
        ];

        if (combinedMedia.length > 10) {
          throw new Error(
            `Maximum 10 media files allowed for variant ${
              submittedVariant.color || variantIndex + 1
            }`
          );
        }

        const requestedThumbnailId =
          submittedVariant.thumbnailId;

        const pendingIndex =
          submittedVariant.thumbnailPendingIndex;

        let thumbnailId = null;

        // Case 1: User selected an existing image.
        if (
          requestedThumbnailId &&
          String(requestedThumbnailId) !== "null"
        ) {
          const matchingMedia = combinedMedia.find(
            (media) =>
              media._id &&
              String(media._id) ===
                String(requestedThumbnailId)
          );

          if (matchingMedia) {
            thumbnailId = matchingMedia._id;
          }
        }

        // Case 2: User selected a newly uploaded image.
        if (
          thumbnailId === null &&
          pendingIndex !== undefined &&
          pendingIndex !== null &&
          pendingIndex !== "" &&
          Number.isInteger(Number(pendingIndex))
        ) {
          const selectedUploadIndex = Number(pendingIndex);

          if (
            selectedUploadIndex >= 0 &&
            selectedUploadIndex < newMedia.length
          ) {
            // New media gets its MongoDB subdocument ID
            // when Mongoose casts the updated variant.
            const selectedUpload =
              combinedMedia[
                keptMedia.length + selectedUploadIndex
              ];

            if (selectedUpload) {
              thumbnailId = selectedUpload._id || null;

              // If this is a new media object without an ID,
              // it will be resolved after Mongoose casts it.
              if (!thumbnailId) {
                thumbnailId = {
                  __pendingUploadIndex: selectedUploadIndex,
                };
              }
            }
          }
        }

        // Case 3: Keep the previous thumbnail if it still exists.
        if (thumbnailId === null && existingVariant?.thumbnailId) {
          const previousThumbnail = combinedMedia.find(
            (media) =>
              media._id &&
              String(media._id) ===
                String(existingVariant.thumbnailId)
          );

          if (previousThumbnail) {
            thumbnailId = previousThumbnail._id;
          }
        }

        // Remove frontend-only properties.
        const {
          existingMedia,
          removedMediaIds: ignoredRemovedIds,
          thumbnailPendingIndex: ignoredPendingIndex,
          ...variantFields
        } = submittedVariant;

        return {
          ...variantFields,
          media: combinedMedia,
          thumbnailId,
        };
      }
    );

    // Assign the variants and let Mongoose generate IDs for new media.
    product.variants = updatedVariants;

    // Resolve any thumbnail that points to a newly added media item.
    product.variants.forEach((variant, variantIndex) => {
      const requestedThumbnail =
        updatedVariants[variantIndex].thumbnailId;

      if (
        requestedThumbnail &&
        typeof requestedThumbnail === "object" &&
        requestedThumbnail.__pendingUploadIndex !== undefined
      ) {
        const keptMediaCount = (
          product.variants[variantIndex].media || []
        ).length - uploadsByVariant[variantIndex].length;

        const mediaIndex =
          keptMediaCount +
          requestedThumbnail.__pendingUploadIndex;

        variant.thumbnailId =
          variant.media[mediaIndex]?._id || null;
      }

      // Validate the final thumbnail against this variant's media.
      const thumbnailExists =
        variant.thumbnailId &&
        variant.media.some(
          (media) =>
            String(media._id) ===
            String(variant.thumbnailId)
        );

      if (!thumbnailExists) {
        variant.thumbnailId =
          variant.media.length > 0
            ? variant.media[0]._id
            : null;
      }

      console.log(
        `Updated variant ${variantIndex} thumbnailId:`,
        variant.thumbnailId
          ? String(variant.thumbnailId)
          : null
      );
    });

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
