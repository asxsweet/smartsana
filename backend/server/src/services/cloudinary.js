const { v2: cloudinary } = require("cloudinary");
const { env } = require("../config/env");

const isConfigured =
  Boolean(env.cloudinaryCloudName) &&
  Boolean(env.cloudinaryApiKey) &&
  Boolean(env.cloudinaryApiSecret);

if (isConfigured) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
}

async function uploadSubmissionFile(dataUrl, fileName) {
  if (!isConfigured) {
    throw new Error("Cloudinary is not configured");
  }
  const uploaded = await cloudinary.uploader.upload(dataUrl, {
    folder: "smartsana/submissions",
    resource_type: "auto",
    use_filename: true,
    unique_filename: true,
    filename_override: fileName,
  });
  return {
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
    size: uploaded.bytes || 0,
    type: uploaded.resource_type || "raw",
  };
}

module.exports = { isConfigured, uploadSubmissionFile };
