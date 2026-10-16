const OTP = require("../models/OTPModel");
const generateOTP = require("../utils/generateOTP");
const axios = require("axios");

const OTP_EXPIRY_MINUTES = 5;

exports.sendOTP = async ({
  mobileNumber,
  purpose = "LOGIN",
}) => {
  try {
    const otp = generateOTP();
    const expiresAt = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
    );

    // Clean up existing unverified OTPs for this number and purpose
    await OTP.deleteMany({
      mobileNumber,
      purpose: { $in: [purpose, "LOGIN", "RESEND_OTP"] },
      isVerified: false,
    });

    // Create new OTP document
    await OTP.create({
      mobileNumber,
      otp,
      purpose,
      expiresAt,
      attempts: 0,
      maxAttempts: 5,
      isVerified: false,
    });

    // Nettyfish API Configurations
    const apiUrl = "http://retailsms.nettyfish.com/api/mt/SendSMS";
    const username = process.env.NETTYFISH_USERNAME || "MOUNTTOWN";
    const password = process.env.NETTYFISH_PASSWORD || "Welcome@2026";
    const sender = process.env.NETTYFISH_SENDER_ID || "MOUNTO";
    const peId = "1701179180290264497"; // DLT Principal Entity ID

    // Format mobile number with country code
    const formattedMobile = mobileNumber.startsWith("91") ? mobileNumber : `91${mobileNumber}`;
    const raw10DigitMobile = formattedMobile.slice(-10);

    let message = "";
    let dltTemplateId = "";

    // Map exact DLT-approved templates from your Nettyfish portal
    if (purpose === "RESET_PASSWORD" || purpose === "RESEND_OTP") {
      // Template Name: "Reset otp new" (DLT ID: 1777179205319392360)[cite: 5]
      message = `Dear Applicant, Your OTP to reset the password for your Mounttown account registered with mobile number ${raw10DigitMobile} is ${otp}.Do not share OTP.`;
      dltTemplateId = "1777179205319392360";
    } else {
      // Template Name: "OTP Number" for Login (DLT ID: 1777179205331953179)[cite: 5]
      message = `Dear Applicant, The login OTP for your Mounttown account registered with mobile number ${raw10DigitMobile} is ${otp}. Do not share OTP with anyone.`;
      dltTemplateId = "1777179205331953179";
    }

    console.log("====================================");
    console.log(`[OTP DISPATCH - ${purpose}] Mobile: ${formattedMobile} | OTP: ${otp}`);
    console.log(`[DLT TEMPLATE ID]: ${dltTemplateId}`);
    console.log("====================================");

    try {
      const nettyfishRes = await axios.get(apiUrl, {
        params: {
          user: username,
          password: password,
          senderid: sender,
          channel: "Trans",
          peid: peId,
          dlttemplateid: dltTemplateId,
          DCS: 0,
          flashsms: 0,
          number: formattedMobile,
          text: message,
          route: 4,
        },
        timeout: 10000,
      });

      console.log("NETTYFISH API RESPONSE:", JSON.stringify(nettyfishRes.data, null, 2));
    } catch (smsError) {
      console.error(
        "NETTYFISH SMS GATEWAY ERROR:",
        smsError.response?.data || smsError.message
      );
    }

    return {
      success: true,
      message: "OTP sent successfully via SMS.",
      expiresAt,
    };
  } catch (error) {
    console.error("SEND OTP SERVICE ERROR:", error);
    throw error;
  }
};