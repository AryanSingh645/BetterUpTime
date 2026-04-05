import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const token =
            req.cookies?.token ||
            req.header("Authorization")?.replace("Bearer ", "");
        if (!token) {
            return res.status(400).json({
                message: "Missing access token",
                success: false,
            });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET!); 
        req.userId = (decoded as { userId: string })?.userId;
        next();
    } catch (error) {
        console.log("Error in middleware:", error);
        return res.status(403).json({
            message: "Error in verifying user.",
            success: false,
        });
    }
};
