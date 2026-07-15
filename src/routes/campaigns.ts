import { Router } from "express";
import { ObjectId, Sort } from "mongodb";
import { getCollections } from "../lib/mongodb";
import { verifyToken, verifyCreator, AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/campaigns", async (req, res) => {
  try {
    const {
      q,
      category,
      status,
      page = "1",
      limit = "12",
      sort = "newest",
      activeOnly,
    } = req.query;
    const pageNumber = Math.max(Number(page), 1);
    const pageSize = Math.max(Number(limit), 1);

    const filter: Record<string, any> = {};

    if (typeof status === "string" && status.trim()) {
      filter.status = status;
    } else {
      filter.status = "approved";
    }

    if (activeOnly === "true") {
      filter.deadline = { $gte: new Date() };
    }

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
    // console.log("campaign", campaign);
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

router.get(
  "/creator/campaigns/my-campaigns",
  verifyToken,
  verifyCreator,
  async (req: AuthRequest, res) => {
    try {
      const creatorEmail = req.user?.email;

      if (!creatorEmail) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.max(Number(req.query.limit) || 10, 1);
      const skip = (page - 1) * limit;

      const collections = await getCollections();

      const query = {
        creatorEmail,
      };

      const total = await collections.campaigns.countDocuments(query);

      const campaigns = await collections.campaigns
        .find(query)
        .sort({
          deadline: -1,
        })
        .skip(skip)
        .limit(limit)
        .project({
          title: 1,
          category: 1,
          goal: 1,
          raisedAmount: 1,
          deadline: 1,
          status: 1,
          createdAt: 1,
        })
        .toArray();

      return res.status(200).json({
        success: true,
        data: campaigns,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Failed to load campaigns",
      });
    }
  },
);

router.patch(
  "/campaigns/:id",
  verifyToken,
  verifyCreator,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const creatorEmail = req.user?.email;

      if (!id || Array.isArray(id) || !ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid campaign id" });
      }

      if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid campaign id" });
      }

      const collections = await getCollections();
      const campaign = await collections.campaigns.findOne({
        _id: new ObjectId(id),
      });

      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      if (campaign.creatorEmail !== creatorEmail) {
        return res.status(403).json({ message: "Forbidden" });
      }

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

      const updateFields: Record<string, any> = { updatedAt: new Date() };

      if (category) updateFields.category = category;
      if (campaign_title) updateFields.title = campaign_title;
      if (deadline) updateFields.deadline = new Date(deadline);
      if (funding_goal) updateFields.goal = Number(funding_goal);
      if (minimum_contribution)
        updateFields.minimumContribution = Number(minimum_contribution);
      if (campaign_story) updateFields.description = campaign_story;
      if (reward_info) updateFields.rewardInfo = reward_info;
      if (campaign_image_url) updateFields.imageUrl = campaign_image_url;

      await collections.campaigns.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields },
      );

      const updatedCampaign = await collections.campaigns.findOne({
        _id: new ObjectId(id),
      });

      return res.status(200).json({
        success: true,
        message: "Campaign updated",
        campaign: updatedCampaign,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Failed to update campaign" });
    }
  },
);

router.delete(
  "/creator/campaigns/:id",
  verifyToken,
  verifyCreator,
  async (req: AuthRequest, res) => {
    try {
      const campaignId = req.params.id;
      const creatorEmail = req.user?.email;

      if (!campaignId || Array.isArray(campaignId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid campaign id",
        });
      }

      if (!campaignId || !ObjectId.isValid(campaignId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid campaign id",
        });
      }

      const collections = await getCollections();

      // Check campaign ownership
      const campaign = await collections.campaigns.findOne({
        _id: new ObjectId(campaignId),
        creatorEmail,
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: "Campaign not found",
        });
      }

      // Get approved contributions
      const approvedContributions = await collections.contributions
        .find({
          campaign_id: campaignId,
          status: "approved",
        })
        .toArray();

      // Refund credits
      for (const contribution of approvedContributions) {
        await collections.user.updateOne(
          {
            email: contribution.Supporter_email,
          },
          {
            $inc: {
              credits: contribution.Contribution_amount,
            },
          },
        );
      }

      // Optional: keep contribution history
      await collections.contributions.updateMany(
        {
          campaign_id: campaignId,
          status: "approved",
        },
        {
          $set: {
            status: "refunded",
            refundedAt: new Date(),
          },
        },
      );

      // Delete campaign
      await collections.campaigns.deleteOne({
        _id: new ObjectId(campaignId),
      });

      return res.status(200).json({
        success: true,
        message: "Campaign deleted successfully.",
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Failed to delete campaign.",
      });
    }
  },
);