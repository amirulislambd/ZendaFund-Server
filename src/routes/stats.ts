import { Router,Response } from "express";
import { AuthRequest, verifySupporter, verifyToken } from "../middleware/auth";
import { getCollections } from "../lib/mongodb";

const router = Router();

router.get("/supporter/stats", verifyToken, verifySupporter, async (req: AuthRequest, res: Response) => {
    try {
      const email = req.user?.email;
      if (!email) {
        return res.status(401).json({ message: "Unauthorized" });
      }
  
      const collections = await getCollections();
  
      const [totalContributions, pendingContributions, approvedSum] = await Promise.all([
        collections.contributions.countDocuments({ Supporter_email: email }),
        collections.contributions.countDocuments({
          Supporter_email: email,
          status: "pending",
        }),
        collections.contributions
          .aggregate([
            { $match: { Supporter_email: email, status: "approved" } },
            { $group: { _id: null, total: { $sum: "$Contribution_amount" } } },
          ])
          .toArray(),
      ]);
  
      const totalAmountContributed = approvedSum[0]?.total ?? 0;
  
      res.status(200).json({
        totalContributions,
        pendingContributions,
        totalAmountContributed,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch supporter stats" });
    }
  });

  export default router;