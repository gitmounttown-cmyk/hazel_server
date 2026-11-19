
const path = require("path");
const fs = require("fs/promises");
const mongoose = require("mongoose");
const sharp = require("sharp");
require("dotenv").config();

// Models
const Product = require("../models/productModel");
const Banner = require("../models/bannerModel");
const Hero = require("../models/heroSlide");
const Category = require("../models/categoryModel");
const NewArrival = require("../models/newArrivalModel");

// This script is inside scripts/, so uploads is one level above.
// const UPLOAD_DIR = path.resolve(__dirname, "..", "uploads");
// const BACKUP_DIR = path.resolve(__dirname, "..", "image-backup");

const UPLOAD_DIR = path.resolve(__dirname, "..", "..", "uploads");
const BACKUP_DIR = path.resolve(__dirname, "..", "..", "image-backup");

const convertedImages = new Map();

console.log("Script location:", __dirname);
console.log("Uploads folder:", UPLOAD_DIR);
console.log("Backup folder:", BACKUP_DIR);

async function convertImage(imageURL) {
  if (
    typeof imageURL !== "string" ||
    !imageURL.startsWith("/uploads/")
  ) {
    return imageURL;
  }

  // Avoid converting the same image more than once.
  if (convertedImages.has(imageURL)) {
    return convertedImages.get(imageURL);
  }

  // Already WebP.
  if (path.extname(imageURL).toLowerCase() === ".webp") {
    convertedImages.set(imageURL, imageURL);
    return imageURL;
  }

  try {
    const relativePath = imageURL
      .replace(/^\/uploads\//, "")
      .replace(/\\/g, "/");

    const inputPath = path.resolve(UPLOAD_DIR, relativePath);
    const uploadsRoot = path.resolve(UPLOAD_DIR) + path.sep;

    // Prevent paths from escaping the uploads folder.
    if (!inputPath.startsWith(uploadsRoot)) {
      console.warn("Skipped unsafe image path:", imageURL);
      return imageURL;
    }

    await fs.access(inputPath);

    const parsed = path.parse(inputPath);

    // Keep the new WebP file beside the original.
    const outputPath = path.join(
      parsed.dir,
      `${parsed.name}.webp`
    );

    const outputURL = `/uploads/${relativePath.replace(
      /\.[^.]+$/,
      ".webp"
    )}`;

    // Create WebP with resized dimensions.
    await sharp(inputPath)
      .rotate()
      .resize({
        width: 1920,
        height: 1920,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 78,
        effort: 5,
      })
      .toFile(outputPath);

    const originalStats = await fs.stat(inputPath);
    const webpStats = await fs.stat(outputPath);

    // Keep the original if WebP is not smaller.
    if (webpStats.size >= originalStats.size) {
      await fs.unlink(outputPath).catch(() => {});
      console.log("Skipped (WebP not smaller):", imageURL);
      convertedImages.set(imageURL, imageURL);
      return imageURL;
    }

    // Back up the original before changing the database reference.
    const backupPath = path.join(BACKUP_DIR, relativePath);

    await fs.mkdir(path.dirname(backupPath), {
      recursive: true,
    });

    await fs.copyFile(inputPath, backupPath);

    const savedKB = (
      (originalStats.size - webpStats.size) /
      1024
    ).toFixed(2);

    console.log(
      `Converted: ${imageURL} -> ${outputURL} | Saved ${savedKB} KB`
    );

    convertedImages.set(imageURL, outputURL);
    return outputURL;
  } catch (error) {
    console.error("Image conversion failed:", imageURL, error.message);
    return imageURL;
  }
}

// 1. Product: variants[].media[].imageURL and thumbnail
async function migrateProductImages() {
  console.log("\nStarting Product images...");

  const cursor = Product.find().cursor();

  for await (const product of cursor) {
    let changed = false;

    for (const variant of product.variants || []) {
      for (const media of variant.media || []) {
        if (media.type !== "image") continue;

        if (media.imageURL) {
          const newURL = await convertImage(media.imageURL);

          if (newURL !== media.imageURL) {
            media.imageURL = newURL;
            changed = true;
          }
        }

        if (typeof media.thumbnail === "string" && media.thumbnail) {
          const newThumbnail = await convertImage(media.thumbnail);

          if (newThumbnail !== media.thumbnail) {
            media.thumbnail = newThumbnail;
            changed = true;
          }
        }
      }
    }

    if (changed) {
      product.markModified("variants");
      await product.save();
      console.log("Updated Product:", product._id);
    }
  }

  console.log("Product migration completed.");
}

// 2. Banner: imageURL
async function migrateBannerImages() {
  console.log("\nStarting Banner images...");

  const cursor = Banner.find().cursor();

  for await (const banner of cursor) {
    if (!banner.imageURL) continue;

    const newURL = await convertImage(banner.imageURL);

    if (newURL !== banner.imageURL) {
      banner.imageURL = newURL;
      await banner.save();
      console.log("Updated Banner:", banner._id);
    }
  }

  console.log("Banner migration completed.");
}

// 3. Hero: image
async function migrateHeroImages() {
  console.log("\nStarting Hero images...");

  const cursor = Hero.find().cursor();

  for await (const hero of cursor) {
    if (!hero.image) continue;

    const newURL = await convertImage(hero.image);

    if (newURL !== hero.image) {
      hero.image = newURL;
      await hero.save();
      console.log("Updated Hero:", hero._id);
    }
  }

  console.log("Hero migration completed.");
}

// 4. Category: imageURL
async function migrateCategoryImages() {
  console.log("\nStarting Category images...");

  const cursor = Category.find().cursor();

  for await (const category of cursor) {
    if (!category.imageURL) continue;

    const newURL = await convertImage(category.imageURL);

    if (newURL !== category.imageURL) {
      category.imageURL = newURL;
      await category.save();
      console.log("Updated Category:", category._id);
    }
  }

  console.log("Category migration completed.");
}

// 5. New Arrivals: products[].image
async function migrateNewArrivalImages() {
  console.log("\nStarting New Arrivals images...");

  const cursor = NewArrival.find().cursor();

  for await (const arrival of cursor) {
    let changed = false;

    for (const item of arrival.products || []) {
      if (!item.image) continue;

      const newURL = await convertImage(item.image);

      if (newURL !== item.image) {
        item.image = newURL;
        changed = true;
      }
    }

    if (changed) {
      arrival.markModified("products");
      await arrival.save();
      console.log("Updated New Arrival:", arrival._id);
    }
  }

  console.log("New Arrivals migration completed.");
}

async function runMigration() {
  try {
    await mongoose.connect(process.env.MONGODB_ATLAS);

    console.log("MongoDB connected.");
    console.log("Uploads folder:", UPLOAD_DIR);
    console.log("Backup folder:", BACKUP_DIR);

    await fs.mkdir(BACKUP_DIR, { recursive: true });

    await migrateProductImages();
    await migrateBannerImages();
    await migrateHeroImages();
    await migrateCategoryImages();
    await migrateNewArrivalImages();

    console.log("\nAll image migrations completed.");
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
  }
}

runMigration();
