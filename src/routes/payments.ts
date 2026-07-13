import { Router, Response } from "express";
import { getCollections } from "../lib/mongodb";
import { sendPaymentConfirmationEmail } from "../lib/stripe";
import { AuthRequest, verifySupporter, verifyToken } from "../middleware/auth";

const router = Router();

router.post(
  "/payments/confirm",
  verifyToken,
  verifySupporter,
  async (req, res) => {
    try {
      const { supporterEmail, credits, amountUsd, stripeSessionId } = req.body;

      if (!supporterEmail || !credits || !stripeSessionId) {
        return res
          .status(400)
          .json({ message: "Missing required payment fields" });
      }

      const collections = await getCollections();

      const existing = await collections.payments.findOne({ stripeSessionId });
      if (existing) {
        return res
          .status(200)
          .json({ message: "Already processed", payment: existing });
      }

      await collections.user.updateOne(
        { email: supporterEmail },
        { $inc: { credits } },
      );

      const payment = {
        supporterEmail,
        credits,
        amountUsd,
        stripeSessionId,
        status: "completed",
        createdAt: new Date(),
      };
      await collections.payments.insertOne(payment);

      await sendPaymentConfirmationEmail(supporterEmail, credits, amountUsd);

      res.status(201).json({ message: "Payment confirmed", payment });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to confirm payment" });
    }
  },
);

router.get(
  "/payments",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const email = req.user?.email;
      if (!email) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const collections = await getCollections();
      const payments = await collections.payments
        .find({ supporterEmail: email })
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json({ payments });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch payment history" });
    }
  },
);

export default router;
