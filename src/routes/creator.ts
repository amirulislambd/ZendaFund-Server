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


router.get(
  "/creator/withdrawals/overview",
  verifyToken,
  verifyCreator,
  async (req: AuthRequest, res) => {
    try {
      const email = req.user?.email;

      if (!email) {
        return res.status(401).json({
          message: "Unauthorized",
        });
      }

      const collections = await getCollections();

      /**
       * Total Approved Raised Credits
       */

      const raisedResult = await collections.contributions
        .aggregate([
          {
            $match: {
              creator_email: email,
              status: "approved",
            },
          },
          {
            $group: {
              _id: null,
              totalRaisedCredits: {
                $sum: "$Contribution_amount",
              },
            },
          },
        ])
        .toArray();

      /**
       * Total Approved Withdrawn Credits
       */

      const withdrawnResult = await collections.withdrawals
        .aggregate([
          {
            $match: {
              creator_email: email,
              status: "approved",
            },
          },
          {
            $group: {
              _id: null,
              totalWithdrawnCredits: {
                $sum: "$withdrawal_credit",
              },
            },
          },
        ])
        .toArray();

      const totalRaisedCredits = raisedResult[0]?.totalRaisedCredits ?? 0;

      const totalWithdrawnCredits =
        withdrawnResult[0]?.totalWithdrawnCredits ?? 0;

      const availableCredits = totalRaisedCredits - totalWithdrawnCredits;

      const withdrawableAmount = Number((availableCredits / 20).toFixed(2));

      const eligibleForWithdrawal = availableCredits >= 200;

      return res.status(200).json({
        success: true,

        stats: {
          totalRaisedCredits,
          totalWithdrawnCredits,
          availableCredits,
          withdrawableAmount,
          eligibleForWithdrawal,
        },
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Failed to load withdrawal overview",
      });
    }
  },
);

router.post(
  "/creator/withdrawals",
  verifyToken,
  verifyCreator,
  async (req: AuthRequest, res) => {
    try {
      const email = req.user?.email;

      if (!email) {
        return res.status(401).json({
          message: "Unauthorized",
        });
      }

      const { withdrawal_credit, payment_system, account_number } = req.body;

      const creditAmount = Number(withdrawal_credit);

      if (
        !creditAmount ||
        creditAmount <= 0 ||
        !payment_system ||
        !account_number
      ) {
        return res.status(400).json({
          message: "All fields are required",
        });
      }

      const collections = await getCollections();

      const creator = await collections.user.findOne({
        email,
      });

      if (!creator) {
        return res.status(404).json({
          message: "Creator not found",
        });
      }

      /**
       * Total Approved Contributions
       */

      const raisedResult = await collections.contributions
        .aggregate([
          {
            $match: {
              creator_email: email,
              status: "approved",
            },
          },
          {
            $group: {
              _id: null,
              totalRaisedCredits: {
                $sum: "$Contribution_amount",
              },
            },
          },
        ])
        .toArray();

      /**
       * Total Pending + Approved Withdrawals
       */

      const withdrawalResult = await collections.withdrawals
        .aggregate([
          {
            $match: {
              creator_email: email,
              status: {
                $in: ["pending", "approved"],
              },
            },
          },
          {
            $group: {
              _id: null,
              totalWithdrawalCredits: {
                $sum: "$withdrawal_credit",
              },
            },
          },
        ])
        .toArray();

      const totalRaisedCredits = raisedResult[0]?.totalRaisedCredits ?? 0;

      const totalWithdrawalCredits =
        withdrawalResult[0]?.totalWithdrawalCredits ?? 0;

      const availableCredits = totalRaisedCredits - totalWithdrawalCredits;

      /**
       * Minimum Withdrawal Rule
       */

      if (availableCredits < 200) {
        return res.status(400).json({
          message: "Minimum 200 available credits required for withdrawal",
        });
      }

      /**
       * Prevent Over Withdrawal
       */

      if (creditAmount > availableCredits) {
        return res.status(400).json({
          message: "Insufficient available credits",
        });
      }

      const withdrawalAmount = Number((creditAmount / 20).toFixed(2));

      const withdrawal = {
        creator_email: creator.email,
        creator_name: creator.name,

        withdrawal_credit: creditAmount,
        withdrawal_amount: withdrawalAmount,

        payment_system,
        account_number,

        withdraw_date: new Date(),

        status: "pending",
      };

      const result = await collections.withdrawals.insertOne(withdrawal);

      return res.status(201).json({
        success: true,
        message: "Withdrawal request submitted successfully",
        withdrawalId: result.insertedId,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Failed to create withdrawal request",
      });
    }
  },
);


export default router;
