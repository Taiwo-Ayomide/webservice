const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: "dpmam7lnk",
  api_key: "747415469397136",
  api_secret: "key70X0QomyGEVAJs4eZS2pRfis"
});

console.log("Connected to Cloudinary")


module.exports = cloudinary;