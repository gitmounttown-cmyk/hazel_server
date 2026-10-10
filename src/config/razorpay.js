const Razorpay = require("razorpay");

if (!process.env.RAZORPAY_KEY_ID) {
  throw new Error("RAZORPAY_KEY_ID is missing in .env");
}

if (!process.env.RAZORPAY_KEY_SECRET) {
  throw new Error("RAZORPAY_KEY_SECRET is missing in .env");
}

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID.trim(),
  key_secret: process.env.RAZORPAY_KEY_SECRET.trim(),
});

console.log("=================================");
console.log("RAZORPAY CONFIG");
console.log("=================================");
console.log("Razorpay Key ID:", process.env.RAZORPAY_KEY_ID);
console.log(
  "Razorpay Secret Loaded:",
  Boolean(process.env.RAZORPAY_KEY_SECRET)
);
console.log("=================================");

module.exports = razorpayInstance;