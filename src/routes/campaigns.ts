import { Router } from "express";
import { getCollections } from "../lib/mongodb";
import { verifyToken, verifyCreator } from "../middleware/auth";

const router = Router();

router.post("/new/campaign", verifyToken, verifyCreator, async (req, res) => {
  try {
    const {
      category,
      campaign_title,
      deadline,
      funding_goal,
      minimum_contribution,
      campaign_story,
      reward_info,
      campaign_image_url,
    } = req.body;

    if (
      !category ||
      !campaign_title ||
      !deadline ||
      !funding_goal ||
      !minimum_contribution ||
      !campaign_story ||
      !reward_info ||
      !campaign_image_url
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const goal = Number(funding_goal);
    const minimumContribution = Number(minimum_contribution);
    if (Number.isNaN(goal) || Number.isNaN(minimumContribution)) {
      return res.status(400).json({ error: "Funding goal and minimum contribution must be numbers" });
    }

    const createdAt = new Date();
    const campaign = {
      category,
      title: campaign_title,
      deadline: new Date(deadline),
      goal,
      minimumContribution,
      description: campaign_story,
      rewardInfo: reward_info,
      imageUrl: campaign_image_url,
      status: "pending",
      raisedAmount: 0,
      createdAt,
      updatedAt: createdAt,
    };

    const collections = await getCollections();
    const result = await collections.campaigns.insertOne(campaign);

    res.status(201).json({ success: true, campaignId: result.insertedId, campaign });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

export default router;
