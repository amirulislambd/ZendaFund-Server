import { Router } from "express";
import { ObjectId, Sort } from "mongodb";
import { getCollections } from "../lib/mongodb";
import { verifyToken, verifyCreator } from "../middleware/auth";

const router = Router();

router.get("/campaigns", async (req, res) => {
  try {
    const {
      q,
      category,
      page = "1",
      limit = "12",
      sort = "newest",
      activeOnly,
    } = req.query;
    const pageNumber = Math.max(Number(page), 1);
    const pageSize = Math.max(Number(limit), 1);

    const filter: Record<string, any> = { status: "approved" };

    if (typeof category === "string" && category.trim()) {
      filter.category = category.trim();
    }

    if (typeof q === "string" && q.trim()) {
      const search = q.trim();
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { rewardInfo: { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions: Record<string, 1 | -1> = { createdAt: -1 };
    if (sort === "deadline") {
      sortOptions.deadline = 1;
    } else if (sort === "raised") {
      sortOptions.raisedAmount = -1;
    } else if (sort === "oldest") {
      sortOptions.createdAt = 1;
    }

    const collections = await getCollections();
    const total = await collections.campaigns.countDocuments(filter);
    const campaigns = await collections.campaigns
      .find(filter)
      .sort(sortOptions)
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .toArray();

    res.json({
      campaigns,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load campaigns" });
  }
});

router.get("/campaign/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const collections = await getCollections();
    const campaign = await collections.campaigns.findOne({
      _id: new ObjectId(id as string),
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    res.json({ campaign });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Invalid campaign id" });
  }
});

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
      creatorEmail,
      creatorName,
      creatorImage,
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
      return res.status(400).json({ message: "All fields are required" });
    }

    const goal = Number(funding_goal);
    const minimumContribution = Number(minimum_contribution);
    if (Number.isNaN(goal) || Number.isNaN(minimumContribution)) {
      return res.status(400).json({
        message: "Funding goal and minimum contribution must be numbers",
      });
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
      creatorEmail: creatorEmail ?? null,
      creatorName: creatorName ?? null,
      creatorImage: creatorImage ?? null,
      createdAt,
      updatedAt: createdAt,
    };
    console.log("campaign", campaign);
    const collections = await getCollections();
    const result = await collections.campaigns.insertOne(campaign);

    res
      .status(201)
      .json({ success: true, campaignId: result.insertedId, campaign });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create campaign" });
  }
});

export default router;
