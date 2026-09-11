require("dotenv").config();

const app = require("./app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5004;

// ==========================================================
// CONNECT DATABASE
// ==========================================================

connectDB();

// ==========================================================
// START SERVER
// ==========================================================

app.listen(PORT, () => {
  
  console.log(`Server running on port ${PORT}`);
  // console.log(`API: http://localhost:${PORT}`);
 
});