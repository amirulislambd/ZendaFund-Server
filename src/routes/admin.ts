import { Router } from "express";
import { getCollections } from "../lib/mongodb";
import { AuthRequest, verifyAdmin, verifyToken } from "../middleware/auth";
import { ObjectId } from "mongodb";
const router = Router()

router.get(
    "/admin/dashboard-overview",
    verifyToken,
    verifyAdmin,
    async (req: AuthRequest, res) => {
      try {
        const collections = await getCollections();
  
        /**
         * Total Supporters
         */
        const totalSupporters =
          await collections.user.countDocuments({
            role: "supporter",
          });
  
        /**
         * Total Creators
         */
        const totalCreators =
          await collections.user.countDocuments({
            role: "creator",
          });
  
        /**
         * Total Available Credits
         */
        const creditsResult = await collections.user
          .aggregate([
            {
              $group: {
                _id: null,
                totalCredits: {
                  $sum: {
                    $ifNull: ["$credits", 0],
                  },
                },
              },
            },
          ])
          .toArray();
  
        /**
         * Total Payments Processed
         *
         * Stripe payment contributions only
         */
        const paymentsResult = await collections.contributions
          .aggregate([
            {
              $match: {
                paymentMethod: "card",
              },
            },
            {
              $group: {
                _id: null,
                totalPaymentsProcessed: {
                  $sum: "$Contribution_amount",
                },
              },
            },
          ])
          .toArray();
  
        const totalAvailableCredits =
          creditsResult[0]?.totalCredits ?? 0;
  
        const totalPaymentsProcessed =
          paymentsResult[0]?.totalPaymentsProcessed ?? 0;
  
        return res.status(200).json({
          success: true,
          stats: {
            totalSupporters,
            totalCreators,
            totalAvailableCredits,
            totalPaymentsProcessed,
          },
        });
      } catch (error) {
        console.error(error);
  
        return res.status(500).json({
          message:
            "Failed to load admin dashboard overview",
        });
      }
    },
  );


  router.patch(
    "/admin/campaigns/:id/status",
    verifyToken,
    verifyAdmin,
    async (req: AuthRequest, res) => {
      try {
        const id = req.params.id;
  
        if (!id || Array.isArray(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid campaign id",
          });
        }
  
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid campaign id format",
          });
        }
  
        const body =
          typeof req.body.body === "string"
            ? JSON.parse(req.body.body)
            : req.body;

        const { status, rejectionMessage } = body;

        if (!status || !["approved", "rejected"].includes(status)) {
          return res.status(400).json({
            success: false,
            message: "Status must be approved or rejected",
          });
        }

        if (status === "rejected" && !rejectionMessage?.trim()) {
          return res.status(400).json({
            success: false,
            message: "Rejection reason is required",
          });
        }

        const collections = await getCollections();

        const campaign = await collections.campaigns.findOne({
          _id: new ObjectId(id),
        });

        if (!campaign) {
          return res.status(404).json({
            success: false,
            message: "Campaign not found",
          });
        }

        const updateFields: Record<string, unknown> = {
          status,
          updatedAt: new Date(),
        };

        if (status === "rejected") {
          updateFields.rejectionMessage = rejectionMessage.trim();
        }

        const result = await collections.campaigns.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateFields },
        );
  
        if (!result.modifiedCount) {
          return res.status(400).json({
            success: false,
            message: "No changes were made",
          });
        }
  
        return res.status(200).json({
          success: true,
          message: `Campaign ${status} successfully`,
        });
      } catch (error) {
        console.error(error);
  
        return res.status(500).json({
          success: false,
          message: "Failed to update campaign status",
        });
      }
    },
  );
  

  router.get(
    "/admin/withdrawals",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
      try {
        const collections = await getCollections();

        const withdrawals = await collections.withdrawals
          .find({
            status: "pending",
          })
          .sort({
            withdraw_date: -1,
          })
          .toArray();

        res.json({
          success: true,
          withdrawals,
        });
      } catch (error) {
        console.error(error);

        res.status(500).json({
          success: false,
          message: "Failed to load withdrawals",
        });
      }
    },
  );

  router.patch(
    "/admin/withdrawals/:id/approve",
    verifyToken,
    verifyAdmin,
    async (req: AuthRequest, res) => {
      try {
        const id = req.params.id;

        if (!id || Array.isArray(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid withdrawal id",
          });
        }

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid withdrawal id format",
          });
        }

        const collections = await getCollections();

        const withdrawal = await collections.withdrawals.findOne({
          _id: new ObjectId(id),
        });

        if (!withdrawal) {
          return res.status(404).json({
            success: false,
            message: "Withdrawal request not found",
          });
        }

        if (withdrawal.status === "approved") {
          return res.status(400).json({
            success: false,
            message: "Withdrawal already approved",
          });
        }

        /**
         * Safety check — calculate the creator's available credits directly:
         * total approved contributions raised for their campaigns, minus
         * already-approved withdrawals. Derived fresh, not tied to a single
         * campaign's raisedAmount.
         */
        const raisedResult = await collections.contributions
          .aggregate([
            {
              $match: {
                creator_email: withdrawal.creator_email,
                status: "approved",
              },
            },
            {
              $group: {
                _id: null,
                totalRaisedCredits: { $sum: "$Contribution_amount" },
              },
            },
          ])
          .toArray();

        const withdrawnResult = await collections.withdrawals
          .aggregate([
            {
              $match: {
                creator_email: withdrawal.creator_email,
                status: "approved",
              },
            },
            {
              $group: {
                _id: null,
                totalWithdrawnCredits: { $sum: "$withdrawal_credit" },
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

        if (availableCredits < withdrawal.withdrawal_credit) {
          return res.status(400).json({
            success: false,
            message:
              "Creator does not have enough available credits for this withdrawal",
          });
        }

        /**
         * Approve withdrawal
         */
        const result = await collections.withdrawals.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              status: "approved",
              approved_at: new Date(),
            },
          },
        );

        if (!result.modifiedCount) {
          return res.status(400).json({
            success: false,
            message: "Failed to approve withdrawal",
          });
        }

        return res.status(200).json({
          success: true,
          message: "Withdrawal approved successfully",
        });
      } catch (error) {
        console.error(error);

        return res.status(500).json({
          success: false,
          message: "Failed to approve withdrawal",
        });
      }
    },
  );

  export default router