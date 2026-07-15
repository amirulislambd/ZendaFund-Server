import { Request, Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import { getCollections } from "../lib/mongodb";

export interface AuthRequest extends Request {
  user?: {
    _id: ObjectId;
    email: string;
    role: string;
    banned?: boolean;
  };
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authorizationHeader = req.headers.authorization;
  console.log("Authorization header:", req.headers.authorization);

  if (!authorizationHeader) {
    return res.status(401).json({ error: "Unauthorized access" });
  }

  const token = authorizationHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized access" });
  }

  // console.log("Token received:", token);

  try {
    const collections = await getCollections();
    const session = await collections.session.findOne({ token });
    // console.log("Session found:", session);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const user = await collections.user.findOne({
      _id: new ObjectId(session.userId),
    });
    if (!user) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    if (user.banned && req.method !== "GET") {
      return res.status(403).json({
        error: "Your account has been restricted by an administrator.",
        blocked: true,
      });
    }

    req.user = {
      _id: user._id,
      email: user.email,
      role: String(user.role || "").toLowerCase(),
      banned: user.banned,
    };
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: "Unauthorized access" });
  }
};;

export const verifyAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = req.user;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden access" });
  }
  next();
};

export const verifyCreator = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = req.user;
  if (!user || user.role !== "creator") {
    return res.status(403).json({ error: "Forbidden access" });
  }
  next();
};

export const verifySupporter = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = req.user;
  if (!user || user.role !== "supporter") {
    return res.status(403).json({ error: "Forbidden access" });
  }
  next();
};
