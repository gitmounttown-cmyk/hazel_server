const fs = require("fs");
const path = require("path");

// ==========================================================
// APPLICATION LOGGING
// ==========================================================

const logDir = path.join(__dirname, "logs");

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, "app.log");

const writeLog = (message) => {
  const timestamp = new Date().toISOString();

  fs.appendFileSync(
    logFile,
    `[${timestamp}] ${message}\n`,
    "utf8"
  );
};

// Capture normal console output
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  const message = args
    .map(arg => {
      if (arg instanceof Error) return arg.stack;
      if (typeof arg === "object") return JSON.stringify(arg);
      return String(arg);
    })
    .join(" ");

  writeLog(`INFO: ${message}`);
  originalLog(...args);
};

console.error = (...args) => {
  const message = args
    .map(arg => {
      if (arg instanceof Error) return arg.stack;
      if (typeof arg === "object") return JSON.stringify(arg);
      return String(arg);
    })
    .join(" ");

  writeLog(`ERROR: ${message}`);
  originalError(...args);
};

// ==========================================================
// START APPLICATION
// ==========================================================

require("dotenv").config();

console.log("========================================");
console.log("Hazel application starting");
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Working directory: ${process.cwd()}`);
console.log(`__dirname: ${__dirname}`);
console.log(`PORT: ${process.env.PORT || 5004}`);
console.log("========================================");

try {
  const app = require("./app");
  const connectDB = require("./src/config/db");

  const PORT = process.env.PORT || 5004;

  console.log("App loaded successfully");
  console.log("Connecting to MongoDB...");

  connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log("Hazel backend started successfully");
  });

} catch (error) {
  console.error("APPLICATION STARTUP FAILED");
  console.error(error);
}