
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// Main upload directory
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// All existing image folders
const uploadFolders = [
  "categories",
  "subcategories",
  "products",
  "new-arrivals",
  "trending-products",
  "banners",
  "profiles",
  "size-charts",
];

// Videos are intentionally excluded.

// Maximum image size: 500 KB
const MAX_SIZE = 500 * 1024;

const supportedExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
];


async function compressImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
    return;
  }

  const originalSize = fs.statSync(filePath).size;

  // Skip small images
  if (originalSize < 100 * 1024) return;

  // Create a new WebP filename
  const parsed = path.parse(filePath);
  const outputPath = path.join(
    parsed.dir,
    `${parsed.name}.webp`
  );

  try {
    await sharp(filePath)
      .rotate()
      .resize({
        width: 1200,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 78,
        effort: 5,
      })
      .toFile(outputPath);

    const newSize = fs.statSync(outputPath).size;

    const saved = originalSize - newSize;
    const percentage = (
      (saved / originalSize) * 100
    ).toFixed(2);

    console.log(
      `Original: ${(originalSize / 1024).toFixed(2)} KB`
    );

    console.log(
      `WebP: ${(newSize / 1024).toFixed(2)} KB`
    );

    console.log(`Saved: ${percentage}%`);

    console.log(`New file: ${outputPath}\n`);

  } catch (error) {
    console.error("Compression failed:", error.message);
  }
}


async function processFolder(folderPath) {
  if (!fs.existsSync(folderPath)) {
    console.log(`Folder not found: ${folderPath}`);
    return;
  }

  const files = fs.readdirSync(folderPath, {
    withFileTypes: true,
  });

  for (const file of files) {
    const fullPath = path.join(folderPath, file.name);

    if (file.isDirectory()) {
      await processFolder(fullPath);
    } else {
      await compressImage(fullPath);
    }
  }
}

async function startCompression() {
  console.log("Starting existing image compression...");

  for (const folder of uploadFolders) {
    const folderPath = path.join(UPLOAD_DIR, folder);

    console.log(`\nProcessing: ${folder}`);

    await processFolder(folderPath);
  }

  console.log("\nImage compression completed!");
}

startCompression().catch(console.error);
