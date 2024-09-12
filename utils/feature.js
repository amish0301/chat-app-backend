const { getBase64, getSockets } = require("../lib/helper");
const cloudinary = require("cloudinary").v2;
const uuid_v4 = require("uuid").v4;

const emitEvent = (req, event, users, data) => {
  const userSockets = getSockets(users);
  let io = req.app.get("io");
  io.to(userSockets).emit(event, data);
};

const deleteFilesFromCloudnary = async (pIds) => {
  try {
    const results = await cloudinary.api.delete_resources(pIds, {
      resource_type: ["image", "video", "raw"],
    });
    console.log(results);
    return results;
  } catch (err) {
    throw new Error("Error deleting files from cloudinary", err);
  }
};

const uploadFilesToCloudinary = async (files = []) => {
  const uploadPromises = files.map((file) => {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        getBase64(file),
        {
          resource_type: "auto",
          public_id: uuid_v4(),
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
    });
  });

  try {
    const results = await Promise.all(uploadPromises);

    const formattedResults = results.map((result) => ({
      public_id: result.public_id,
      url: result.secure_url,
    }));

    return formattedResults;
  } catch (err) {
    throw new Error("Error uploading files to cloudinary", err);
  }
};

module.exports = {
  emitEvent,
  deleteFilesFromCloudnary,
  uploadFilesToCloudinary,
};
