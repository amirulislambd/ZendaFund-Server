import { Router } from "express";
import { getCollections } from "../lib/mongodb";
import { sendContributionConfirmationEmail } from "../lib/stripe";

const router = Router();

router.post("/contribution", async (req, res) => {
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
      } = req.body;
  
      if (
        !campaign_id ||
        !campaign_title ||
        !Contribution_amount ||
        !Supporter_email ||
        !Supporter_name
      ) {
        return res.status(400).json({ message: "Missing required fields" });
      }
  
      const contributionDate = current_date ? new Date(current_date) : new Date();

      const contribution = {
        campaign_id,
        campaign_title,
        Contribution_amount: Number(Contribution_amount),
        Supporter_email,
        Supporter_name,
        creator_name,
        creator_email,
        current_date: contributionDate,
        status: status ?? "pending",
      };
  
      const collections = await getCollections();
      const result = await collections.contributions.insertOne(contribution);

      // Fire-and-forget: don't block or fail the request if the email fails.
      sendContributionConfirmationEmail({
        toEmail: Supporter_email,
        supporterName: Supporter_name,
        campaignTitle: campaign_title,
        campaignId: campaign_id,
        amount: Number(Contribution_amount),
        creatorName: creator_name,
        date: contributionDate,
      });

      res.status(201).json({ success: true, contributionId: result.insertedId, contribution });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to save contribution" });
    }
  });

export default router;