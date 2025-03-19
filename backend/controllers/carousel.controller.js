import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { HttpStatus } from "../constants/status.code.js";
import { Carousel } from "../models/carousel.model.js";
import mongoose from "mongoose";
import { uploadOnCloudinary } from "../services/cloudinary.service.js";

export const createCarousel = async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title || !description || !req.file) {
            return res
                .status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code, "All fields are required"));
        }

        const uploadedImage = await uploadOnCloudinary(req.file.path);
        if (!uploadedImage) {
            return res
                .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
                .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Failed to upload image"));
        }

        const newCarousel = new Carousel({
            title,
            description,
            imageUrl: uploadedImage?.secure_url,
        });

        const savedCarousel = await newCarousel.save();
        return res
            .status(HttpStatus.CREATED.code)
            .json(new ApiResponse(HttpStatus.CREATED.code, savedCarousel, "Carousel item created successfully"));
    } catch (error) {
        console.error("Error creating carousel item:", error);
        return res
            .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
            .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while creating carousel item", error.message));
    }
};

export const getCarousels = async (req, res) => {
    try {
        const carousels = await Carousel.find();
        res
            .status(HttpStatus.OK.code)
            .json(new ApiResponse(HttpStatus.OK.code, carousels, "Carousel items fetched successfully"));
    } catch (error) {
        console.error("Error fetching carousel items:", error);
        res
            .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
            .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while fetching carousel items", error?.message));
    }
};

export const getCarouselById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res
                .status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid carousel ID format"));
        }

        const carousel = await Carousel.findById(id);
        if (!carousel) {
            return res
                .status(HttpStatus.NOT_FOUND.code)
                .json(new ApiError(HttpStatus.NOT_FOUND.code, "Carousel item not found"));
        }

        return res
            .status(HttpStatus.OK.code)
            .json(new ApiResponse(HttpStatus.OK.code, carousel, "Carousel item fetched successfully"));
    } catch (error) {
        console.error("Error fetching carousel item:", error);
        return res
            .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
            .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while fetching carousel item", error.message));
    }
};

export const updateCarousel = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res
                .status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid carousel ID format"));
        }

        const carousel = await Carousel.findById(id);
        if (!carousel) {
            return res
                .status(HttpStatus.NOT_FOUND.code)
                .json(new ApiError(HttpStatus.NOT_FOUND.code, "Carousel item not found"));
        }

        if (req.file) {
            const uploadedImage = await uploadOnCloudinary(req.file.path);
            if (!uploadedImage) {
                return res
                    .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
                    .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Failed to upload image"));
            }
            carousel.imageUrl = uploadedImage.secure_url;
        }

        carousel.title = title || carousel.title;
        carousel.description = description || carousel.description;

        const updatedCarousel = await carousel.save();
        res
            .status(HttpStatus.OK.code)
            .json(new ApiResponse(HttpStatus.OK.code, updatedCarousel, "Carousel item updated successfully"));
    } catch (error) {
        console.error("Error updating carousel item:", error);
        res
            .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
            .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while updating carousel item", error.message));
    }
};

export const deleteCarousel = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res
                .status(HttpStatus.BAD_REQUEST.code)
                .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid carousel ID format"));
        }

        const carousel = await Carousel.findById(id);
        if (!carousel) {
            return res
                .status(HttpStatus.NOT_FOUND.code)
                .json(new ApiError(HttpStatus.NOT_FOUND.code, "Carousel item not found"));
        }

        await carousel.deleteOne();
        return res
            .status(HttpStatus.OK.code)
            .json(new ApiResponse(HttpStatus.OK.code, null, "Carousel item deleted successfully"));
    } catch (error) {
        console.error("Error deleting carousel item:", error);
        return res
            .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
            .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while deleting carousel item", error.message));
    }
};
