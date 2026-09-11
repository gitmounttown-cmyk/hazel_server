const axios = require("axios");

const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/reverse",
      {
        params: {
          lat: latitude,
          lon: longitude,
          format: "jsonv2",
          addressdetails: 1,
          zoom: 18,
          "accept-language": "en",
          email: "mounttowntech@gmail.com"
        },

        headers: {
          "User-Agent":
            "HazelEcommerce/1.0 (contact:mounttowntech@gmail.com)",
          "Accept": "application/json"
        },

        timeout: 15000
      }
    );

    return response.data;

  } catch (error) {
    console.error(
      "NOMINATIM ERROR:",
      error.response?.status,
      error.response?.data || error.message
    );

    throw error;
  }
};

module.exports = {
  reverseGeocode
};