const axios = require("axios");

const reverseGeocode = async (
  latitude,
  longitude
) => {
  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          latlng: `${latitude},${longitude}`,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      }
    );

    if (
      response.data.status !== "OK" &&
      response.data.status !== "ZERO_RESULTS"
    ) {
      throw new Error(
        response.data.error_message ||
          `Google Geocoding failed: ${response.data.status}`
      );
    }

    return response.data;
  } catch (error) {
    console.error(
      "GOOGLE REVERSE GEOCODING ERROR:",
      error.response?.data ||
        error.message
    );

    throw error;
  }
};

module.exports = {
  reverseGeocode,
};