import { v2 as cloudinary } from "cloudinary"
import fs from "fs"


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        return response;

    } catch (error) {
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        return null;
    }
}


const deleteFromCloudinary = async (imageUrl) => {
    try {
        if (!imageUrl) return false;

        const publicId = imageUrl.split('/').slice(-1)[0].split('.')[0];

        const result = await cloudinary.uploader.destroy(publicId);

        if (result.result === "ok") {
            console.log(`Deleted from Cloudinary: ${publicId}`);
            return true;
        } else {
            console.error(`Failed to delete from Cloudinary: ${publicId}`);
            return false;
        }
    } catch (error) {
        console.error("Error deleting image from Cloudinary:", error);
        return false;
    }
};

export { uploadOnCloudinary, deleteFromCloudinary }
