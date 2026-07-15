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

      const availableCredits = Math.max(
        totalRaisedCredits - totalWithdrawnCredits,
        0,
      );

      const availableEarnings = Number((availableCredits / 20).toFixed(2));

      const eligibleForWithdrawal = availableCredits >= 200;

      return res.status(200).json({
        success: true,
        stats: {
          totalRaisedCredits,
          withdrawnCredits: totalWithdrawnCredits,
          availableCredits,
          availableEarnings,
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

      /**
       * Parse body
       */
      const body =
        typeof req.body.body === "string"
          ? JSON.parse(req.body.body)
          : req.body;

      const { withdrawal_credit, payment_system, account_number } = body;

      const creditAmount = Number(withdrawal_credit);

      /**
       * Basic Validation
       */
      if (!creditAmount || creditAmount <= 0 || !payment_system) {
        return res.status(400).json({
          message: "All required fields must be provided",
        });
      }

      /**
       * Stripe does not require account number
       */
      if (payment_system !== "Stripe" && !account_number) {
        return res.status(400).json({
          message: "Account number is required",
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
       * Creator must have at least 200 available credits
       */
      if (availableCredits < 200) {
        return res.status(400).json({
          message:
            "You need at least 200 available credits to request a withdrawal",
        });
      }

      /**
       * Minimum withdrawal request
       */
      if (creditAmount < 200) {
        return res.status(400).json({
          message: "Minimum withdrawal request is 200 credits",
        });
      }

      /**
       * Prevent over-withdrawal
       */
      if (creditAmount > availableCredits) {
        return res.status(400).json({
          message: "Insufficient available credits",
        });
      }

      /**
       * 20 Credits = 1 Dollar
       */
      const withdrawalAmount = Number((creditAmount / 20).toFixed(2));

      const withdrawal = {
        creator_email: creator.email,
        creator_name: creator.name,

        withdrawal_credit: creditAmount,
        withdrawal_amount: withdrawalAmount,

        payment_system,
        account_number: payment_system === "Stripe" ? null : account_number,

        withdraw_date: new Date(),

        status: "pending",

        approved_at: null,
        rejected_at: null,
        rejection_reason: null,
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

router.get(
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

      const { status, page = "1", limit = "10" } = req.query;

      const currentPage = Number(page);
      const pageSize = Number(limit);

      const collections = await getCollections();

      const query: any = {
        creator_email: email,
      };

      if (status) {
        query.status = status;
      }

      const total = await collections.withdrawals.countDocuments(query);

      const withdrawals = await collections.withdrawals
        .find(query)
        .sort({
          withdraw_date: -1,
        })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize)
        .toArray();

      return res.status(200).json({
        success: true,
        withdrawals,
        pagination: {
          page: currentPage,
          limit: pageSize,
          total,
          pages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Failed to load withdrawals",
      });
    }
  },
);

export default router;
