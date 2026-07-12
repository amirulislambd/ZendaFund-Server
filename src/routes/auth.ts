import { Router } from "express";
import { verifyToken, AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/me", verifyToken, (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.json({
    id: req.user._id,
    email: req.user.email,
    role: req.user.role,
    banned: req.user.banned || false,
  });
});

export default router;
