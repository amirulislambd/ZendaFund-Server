import { Router } from "express";
import { getCollections } from "../lib/mongodb";
import { sendContributionConfirmationEmail } from "../lib/stripe";
import { AuthRequest, verifySupporter, verifyToken } from "../middleware/auth";

const router = Router();

router.post("/contribution", verifyToken, verifySupporter, async (req, res) => {
  try {
    const {
      campaign_id,
      campaign_title,
      Contribution_amount,
      Supporter_email,
      Supporter_name,
      creator_name,
      creator_email,
      current_date,
      status,
      paymentMethod,
      stripeSessionId,
    } = req.body;

    if (
      !campaign_id ||
      !campaign_title ||
      !Contribution_amount ||
      !Supporter_email ||
      !Supporter_name ||
      !paymentMethod
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const contributionDate = current_date ? new Date(current_date) : new Date();

    const amount = Number(Contribution_amount);

    const collections = await getCollections();

    let supporter: any = null;

    /**
     * ----------------------------------
     * CARD PAYMENT
     * ----------------------------------
     */

    if (paymentMethod === "card") {
      if (!stripeSessionId) {
        return res.status(400).json({
          message: "Missing Stripe Session Id",
        });
      }

      const existing = await collections.contributions.findOne({
        stripeSessionId,
      });

      if (existing) {
        return res.status(200).json({
          success: true,
          message: "Contribution already processed",
          contribution: existing,
        });
      }
    }

    /**
     * ----------------------------------
     * CREDIT PAYMENT
     * ----------------------------------
     */

    if (paymentMethod === "credits") {
      supporter = await collections.user.findOne({
        email: Supporter_email,
      });

      if (!supporter) {
        return res.status(404).json({
          message: "Supporter not found",
        });
      }

      if ((supporter.credits ?? 0) < amount) {
        return res.status(400).json({
          message: "Insufficient credits",
        });
      }

      await collections.user.updateOne(
        {
          email: Supporter_email,
        },
        {
          $inc: {
            credits: -amount,
          },
        },
      );
    }

    /**
     * ----------------------------------
     * SAVE CONTRIBUTION
     * ----------------------------------
     */

    const contribution = {
      campaign_id,
      campaign_title,

      Contribution_amount: amount,

      paymentMethod,

      stripeSessionId: stripeSessionId ?? null,

      Supporter_email,
      Supporter_name,

      creator_name,
      creator_email,

      current_date: contributionDate,

      status: status ?? "pending",
    };

    const result = await collections.contributions.insertOne(contribution);

    /**
     * ----------------------------------
     * EMAIL
     * ----------------------------------
     */

    const emailData = {
      toEmail: Supporter_email,
      supporterName: Supporter_name,
      campaignTitle: campaign_title,
      campaignId: campaign_id,
      amount,
      creatorName: creator_name,
      date: contributionDate,
      paymentMethod,

      ...(paymentMethod === "credits"
        ? {
            remainingCredits: supporter.credits - amount,
          }
        : {
            stripeSessionId,
          }),
    };

    sendContributionConfirmationEmail(emailData);

    return res.status(201).json({
      success: true,
      contributionId: result.insertedId,
      contribution,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to save contribution",
    });
  }
});

// / GET /api/contributions/my-contributions — only the logged-in Supporter's
// own contributions. Email comes from the verified token (req.user.email),
// never from a client-supplied query param, so a Supporter can't read
// another Supporter's contributions by editing the URL.
router.get(
  "/contributions/my-contributions",
  verifyToken,
  async (req: AuthRequest, res) => {
    try {
      const email = req.user?.email;
      const role = req.user?.role;

      if (!email) {
        return res.status(401).json({
          message: "Unauthorized",
        });
      }

      const { page = "1", limit = "10", status } = req.query;

      const pageNumber = Math.max(Number(page), 1);
      const pageSize = Math.max(Number(limit), 1);

      const collections = await getCollections();

      const filter: Record<string, any> = {};

      // Supporter
      if (role === "supporter") {
        filter.Supporter_email = email;
      }

      // Creator
      if (role === "creator") {
        filter.creator_email = email;
      }

      // Optional status filter
      if (typeof status === "string" && status.trim()) {
        filter.status = status.trim();
      }

      const total = await collections.contributions.countDocuments(filter);

      const contributions = await collections.contributions
        .find(filter)
        .sort({ current_date: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .toArray();

      res.status(200).json({
        contributions: contributions.map((c) => ({
          id: String(c._id),

          campaign_id: c.campaign_id,
          campaign_title: c.campaign_title,

          Contribution_amount: c.Contribution_amount,

          paymentMethod: c.paymentMethod ?? null,

          Supporter_email: c.Supporter_email,
          Supporter_name: c.Supporter_name,

          creator_email: c.creator_email,
          creator_name: c.creator_name,

          current_date: c.current_date,

          status: c.status,

          rejectReason: c.rejectReason ?? null,
        })),

        pagination: {
          page: pageNumber,
          limit: pageSize,
          total,
          pages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to load contributions",
      });
    }
  },
);



export default router;