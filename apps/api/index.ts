import express from "express";
import { prisma } from "store/client";
import { AuthInput } from "./types.ts";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authMiddleware } from "./middleware.ts";

const app = express();

app.use(express.json());

app.post("/website", authMiddleware, async (req, res) => {
    try {
        const { id, url } = req.body;
        if (!id || !url) {
            return res.status(400).json({
                message: "Missing required fields: id and url",
                success: false,
            });
        }
        if(!req.userId){
            return res.status(401).json({
                message: "Unauthorized",
                success: false,
            });
        }
        const website = await prisma.website.create({
            data: {
                id,
                url,
                user_id: req.userId
            }
        })
        return res.status(201).json({
            message: "Website created successfully",
            success: true,
            id: website.id
        });
    } catch (error) {
        console.log("Error in creating the website:", error);
        return res.status(500).json({
            message: "Internal server error",
            success: false,
        });
    }
});

app.get("/status/:websiteId", async (req, res) => {
    try {
        const { websiteId } = req.params;
        if (!websiteId) {
            return res.status(400).json({
                message: "Missing required parameter: websiteId",
                success: false,
            });
        }
        const website = await prisma.website.findFirst({
            where: {
                id : websiteId,
            },
            include: {
                ticks: {
                    take: 1,
                    orderBy: {
                        createdAt: "desc",
                    },
                }
            }
        })
        if(!website){
            return res.status(404).json({
                message: "Website not found",
                success: false
            })
        }
        return res.status(200).json({
            website,
            message: "Website status fetched successfully",
            success: true
        })
    } catch (error) {
        console.log("Error in fetching the website status:", error);
        return res.status(500).json({
            message: "Internal server error",
            success: false,
        });
    }
});

app.post("/user/signup", async (req, res) => {
    try {
        const { username, password } = req.body;
        const isValidInput = AuthInput.safeParse({ username, password });
        if (!isValidInput.success) {
            return res.status(400).json({
                message: "Invalid input",
                success: false,
                errors: isValidInput.error,
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const createdUser = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
            },
        });
        return res.status(201).json({
            message: "User created successfully",
            success: true,
            user: {
                id: createdUser.id,
                username: createdUser.username,
            },
        });
    } catch (error: any) {
        console.log("Error in creating the user:", error);
        if (error.code === "P2002") {
            return res.status(400).json({
                message: "Username already exists",
                success: false,
            });
        }
        return res.status(500).json({
            message: "Internal server error",
            success: false,
        });
    }
});

app.post("/user/signin", async (req, res) => {
    try {
        const { username, password } = req.body;
        const isValidInput = AuthInput.safeParse({ username, password });
        if (!isValidInput.success) {
            return res.status(400).json({
                message: "Invalid input",
                success: false,
                errors: isValidInput.error,
            });
        }
        const user = await prisma.user.findFirst({
            where: {
                username,
            },
        });
        if (!user) {
            return res.status(401).json({
                message: "Invalid username",
                success: false,
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Invalid password",
                success: false,
            });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
            expiresIn: "1h",
        });
        return res
            .status(200)
            .cookie("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
            })
            .json({
                message: "User signed in successfully",
                success: true,
                token,
            });
    } catch (error: any) {
        console.log("Error in signing in the user:", error);
        return res.status(500).json({
            message: "Internal server error",
            success: false,
            error: error.message,
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API server is running on port ${PORT}`);
});
