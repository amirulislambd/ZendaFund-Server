import { Router } from "express";
import { getCollections } from "../lib/mongodb";

const router = Router();

// GET /api/testimonials — public, no auth required (shown on the landing
// page). Returns the most recent unique supporters (one contribution per
// supporter, their latest), each paired with the campaign they supported
// and their profile photo. Everything in a single aggregation pipeline so
// this stays a lightweight, single round-trip query.
router.get("/testimonials", async (req, res) => {
  try {
    const limitParam = req.query.limit;
    const limit = Math.min(Math.max(Number(limitParam) || 10, 1), 20);

    const collections = await getCollections();

    const testimonials = await collections.contributions
      .aggregate([
        { $match: { status: "approved" } },
        { $sort: { current_date: -1 } },

        // One entry per supporter — keep only their most recent contribution.
        {
          $group: {
            _id: "$Supporter_email",
            campaign_id: { $first: "$campaign_id" },
            campaign_title: { $first: "$campaign_title" },
            Contribution_amount: { $first: "$Contribution_amount" },
            Supporter_name: { $first: "$Supporter_name" },
            Supporter_email: { $first: "$Supporter_email" },
            current_date: { $first: "$current_date" },
          },
        },
        { $sort: { current_date: -1 } },
        { $limit: limit },

        // campaign_id is stored as a string, campaigns._id is an ObjectId —
        // convert to match.
        {
          $lookup: {
            from: "campaigns",
            let: { campaignId: "$campaign_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", { $toObjectId: "$$campaignId" }] } } },
              { $project: { imageUrl: 1 } },
            ],
            as: "campaign",
          },
        },

        {
          $lookup: {
            from: "user",
            localField: "Supporter_email",
            foreignField: "email",
            pipeline: [{ $project: { profilePic: 1, image: 1 } }],
            as: "supporter",
          },
        },

        {
          $project: {
            _id: 0,
            supporterName: "$Supporter_name",
            supporterImage: {
              $ifNull: [
                { $arrayElemAt: ["$supporter.profilePic", 0] },
                { $arrayElemAt: ["$supporter.image", 0] },
              ],
            },
            campaignId: "$campaign_id",
            campaignTitle: "$campaign_title",
            campaignImage: { $arrayElemAt: ["$campaign.imageUrl", 0] },
            contributionAmount: "$Contribution_amount",
          },
        },
      ])
      .toArray();

    res.json({ testimonials });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load testimonials" });
  }
});

export default router;