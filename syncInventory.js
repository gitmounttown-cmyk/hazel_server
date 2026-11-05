require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./src/config/db");
const { syncAllProductInventory } = require("./src/services/inventoryService");

async function syncExistingProducts() {
  try {
    console.log("Connecting to database using db config...");
    await connectDB();
    console.log("Starting product inventory sync...");

    const result = await syncAllProductInventory();
    console.log(`Successfully synced ${result.syncedCount} products to Inventory!`);
  } catch (error) {
    console.error("Error syncing inventory:", error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

syncExistingProducts();
