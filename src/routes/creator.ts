import { ObjectId } from "mongodb";
import { Router } from "express";
import { getCollections } from "../lib/mongodb";
import { AuthRequest, verifyCreator, verifyToken } from "../middleware/auth";

const router = Router();

router.patch(
  "/creator/contributions/:id/approve",
  verifyToken,
  verifyCreator,
  async (req: AuthRequest, res) => {
    try {
      const contributionId = req.params.id;

      if (!contributionId || Array.isArray(contributionId)) {
        return res.status(400).json({
          message: "Invalid contribution id",
        });
      }

      const collections = await getCollections();

      const contribution = await collections.contributions.findOne({
        _id: new ObjectId(contributionId),
      });

      if (!contribution) {
        return res.status(404).json({
          message: "Contribution not found",
        });
      }

      await collections.contributions.updateOne(
        {
          _id: new ObjectId(contributionId),
        },
        {
          $set: {
            status: "approved",
          },
        },
      );

      await collections.campaigns.updateOne(
        { _id: new ObjectId(contribution.campaign_id) },
        { $inc: { raisedAmount: contribution.Contribution_amount } },
      );
      return res.status(200).json({
        success: true,
        message: "Contribution approved",
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Failed to approve contribution",
      });
    }
  },
);

export default router;
