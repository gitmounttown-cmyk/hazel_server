const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    let mongoURI;

    // Select database based on environment
    if (process.env.NODE_ENV === "production") {
      mongoURI = process.env.MONGODB_ATLAS;
    } else {
      mongoURI = process.env.MONGODB_LOCAL;
    }

    // Check MongoDB URI
    if (!mongoURI) {
      throw new Error("MongoDB connection string is missing");
    }

    // Connect MongoDB
    const conn = await mongoose.connect(mongoURI);

    console.log("MongoDB Connected Successfully!!");
    
  } catch (error) {
    console.error("MongoDB Connection Failed");
    console.error(error.message);

    process.exit(1);
  }
};

module.exports = connectDB;