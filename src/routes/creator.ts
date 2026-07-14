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


router.patch(
  "/creator/contributions/:id/reject",
  verifyToken,
  verifyCreator,
  async (req: AuthRequest, res) => {
    try {
      const contributionId = req.params.id;
      const { rejectionMessage } = req.body;

      if (!contributionId || Array.isArray(contributionId)) {
        return res.status(400).json({
          message: "Invalid contribution id",
        });
      }

      if (!rejectionMessage || rejectionMessage.trim().length < 5) {
        return res.status(400).json({
          message: "Rejection reason is required (min 5 characters)",
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

      if (contribution.status !== "pending") {
        return res.status(400).json({
          message: "Only pending contributions can be rejected",
        });
      }

      // 1. Update contribution status + save rejection message
      await collections.contributions.updateOne(
        { _id: new ObjectId(contributionId) },
        {
          $set: {
            status: "rejected",
            rejectionMessage: rejectionMessage.trim(),
            rejectedAt: new Date(),
          },
        },
      );

      // 2. Refund credits back to supporter
      await collections.user.updateOne(
        { email: contribution.Supporter_email },
        { $inc: { credits: contribution.Contribution_amount } },
      );

      // 3. Create notification for supporter
      await collections.notifications.insertOne({
        message: `Your contribution of ${contribution.Contribution_amount} credits to ${contribution.campaign_title} was rejected by ${contribution.creator_name}. Reason: ${rejectionMessage.trim()}`,
        toEmail: contribution.Supporter_email,
        actionRoute: "/dashboard/supporter-home",
        time: new Date(),
      });

      return res.status(200).json({
        success: true,
        message: "Contribution rejected and credits refunded",
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Failed to reject contribution",
      });
    }
  },
);

export default router;
