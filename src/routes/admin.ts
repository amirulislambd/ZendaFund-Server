import { Router } from "express";
import { getCollections } from "../lib/mongodb";
import { AuthRequest, verifyAdmin, verifyToken } from "../middleware/auth";
import { ObjectId } from "mongodb";
const router = Router();

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /admin/dashboard-overview
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get(
  "/admin/dashboard-overview",
  verifyToken,
  verifyAdmin,
  async (req: AuthRequest, res) => {
    try {
      const collections = await getCollections();

      const totalSupporters = await collections.user.countDocuments({ role: "supporter" });
      const totalCreators = await collections.user.countDocuments({ role: "creator" });

      const creditsResult = await collections.user
        .aggregate([{ $group: { _id: null, totalCredits: { $sum: { $ifNull: ["$credits", 0] } } } }])
        .toArray();

      const paymentsResult = await collections.contributions
        .aggregate([
          { $match: { paymentMethod: "card" } },
          { $group: { _id: null, totalPaymentsProcessed: { $sum: "$Contribution_amount" } } },
        ])
        .toArray();

      return res.status(200).json({
        success: true,
        stats: {
          totalSupporters,
          totalCreators,
          totalAvailableCredits: creditsResult[0]?.totalCredits ?? 0,
          totalPaymentsProcessed: paymentsResult[0]?.totalPaymentsProcessed ?? 0,
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Failed to load admin dashboard overview" });
    }
  }
);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /admin/users  â€” paginated + searchable
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get("/admin/users", verifyToken, verifyAdmin, async (req: AuthRequest, res) => {
  try {
    const page  = Math.max(Number(req.query.page)  || 1,  1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const search = (req.query.search as string)?.trim() || "";
    const skip = (page - 1) * limit;

    const collections = await getCollections();

    const query: any = {};
    if (search) {
      query.$or = [
        { name:  { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const total = await collections.user.countDocuments(query);
    const users = await collections.user
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .project({ name: 1, email: 1, image: 1, role: 1, credits: 1, createdAt: 1 })
      .toArray();

    return res.status(200).json({
      success: true,
      data: users,
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
    console.error("Get Users Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load users" });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DELETE /admin/users/:id
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.delete(
  "/admin/users/:id",
  verifyToken,
  verifyAdmin,
  async (req: AuthRequest, res) => {
    try {
      const id = req.params.id as string;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid user id" });
      }

      const collections = await getCollections();

      // Prevent admin from deleting themselves
      if (req.user?._id.toString() === id) {
        return res.status(400).json({ success: false, message: "You cannot delete your own account" });
      }

      const result = await collections.user.deleteOne({ _id: new ObjectId(id) });

      if (!result.deletedCount) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Also clean up their sessions
      await collections.session.deleteMany({ userId: new ObjectId(id) });

      return res.status(200).json({ success: true, message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete User Error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete user" });
    }
  }
);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PATCH /admin/users/:id/role
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.patch(
  "/admin/users/:id/role",
  verifyToken,
  verifyAdmin,
  async (req: AuthRequest, res) => {
    try {
      const id = req.params.id as string;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid user id" });
      }

      const body = typeof req.body.body === "string" ? JSON.parse(req.body.body) : req.body;
      const { role } = body;

      const validRoles = ["admin", "creator", "supporter"];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role. Must be admin, creator, or supporter" });
      }

      const collections = await getCollections();

      const result = await collections.user.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role, updatedAt: new Date() } }
      );

      if (!result.matchedCount) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      return res.status(200).json({ success: true, message: `Role updated to ${role}` });
    } catch (error) {
      console.error("Update User Role Error:", error);
      return res.status(500).json({ success: false, message: "Failed to update role" });
    }
  }
);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /admin/campaigns  â€” paginated + searchable
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get("/admin/campaigns", verifyToken, verifyAdmin, async (req: AuthRequest, res) => {
  try {
    const page   = Math.max(Number(req.query.page)   || 1,  1);
    const limit  = Math.max(Number(req.query.limit)  || 10, 1);
    const search = (req.query.search as string)?.trim() || "";
    const skip   = (page - 1) * limit;

    const collections = await getCollections();

    const query: any = {};
    if (search) {
      query.$or = [
        { title:        { $regex: search, $options: "i" } },
        { creatorName:  { $regex: search, $options: "i" } },
        { creatorEmail: { $regex: search, $options: "i" } },
      ];
    }

    const total = await collections.campaigns.countDocuments(query);
    const campaigns = await collections.campaigns
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
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
    console.error("Get Admin Campaigns Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load campaigns" });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PATCH /admin/campaigns/:id/status  (approve / reject)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.patch(
  "/admin/campaigns/:id/status",
  verifyToken,
  verifyAdmin,
  async (req: AuthRequest, res) => {
    try {
      const id = req.params.id as string;
      if (!id || Array.isArray(id)) {
        return res.status(400).json({ success: false, message: "Invalid campaign id" });
      }
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid campaign id format" });
      }

      const body = typeof req.body.body === "string" ? JSON.parse(req.body.body) : req.body;
      const { status, rejectionMessage } = body;

      if (!status || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({ success: false, message: "Status must be approved or rejected" });
      }
      if (status === "rejected" && !rejectionMessage?.trim()) {
        return res.status(400).json({ success: false, message: "Rejection reason is required" });
      }

      const collections = await getCollections();
      const campaign = await collections.campaigns.findOne({ _id: new ObjectId(id) });
      if (!campaign) {
        return res.status(404).json({ success: false, message: "Campaign not found" });
      }

      const updateFields: Record<string, unknown> = { status, updatedAt: new Date() };
      if (status === "rejected") updateFields.rejectionMessage = rejectionMessage.trim();

      const result = await collections.campaigns.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
      );

      if (!result.modifiedCount) {
        return res.status(400).json({ success: false, message: "No changes were made" });
      }

      return res.status(200).json({ success: true, message: `Campaign ${status} successfully` });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Failed to update campaign status" });
    }
  }
);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PATCH /admin/campaigns/:id/suspend
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.patch(
  "/admin/campaigns/:id/suspend",
  verifyToken,
  verifyAdmin,
  async (req: AuthRequest, res) => {
    try {
      const id = req.params.id as string;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid campaign id" });
      }

      const collections = await getCollections();
      const campaign = await collections.campaigns.findOne({ _id: new ObjectId(id) });
      if (!campaign) {
        return res.status(404).json({ success: false, message: "Campaign not found" });
      }

      const result = await collections.campaigns.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "suspended", suspendedAt: new Date(), updatedAt: new Date() } }
      );

      if (!result.modifiedCount) {
        return res.status(400).json({ success: false, message: "Campaign already suspended or no changes made" });
      }

      return res.status(200).json({ success: true, message: "Campaign suspended successfully" });
    } catch (error) {
      console.error("Suspend Campaign Error:", error);
      return res.status(500).json({ success: false, message: "Failed to suspend campaign" });
    }
  }
);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DELETE /admin/campaigns/:id
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.delete(
  "/admin/campaigns/:id",
  verifyToken,
  verifyAdmin,
  async (req: AuthRequest, res) => {
    try {
      const id = req.params.id as string;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid campaign id" });
      }

      const collections = await getCollections();
      const result = await collections.campaigns.deleteOne({ _id: new ObjectId(id) });

      if (!result.deletedCount) {
        return res.status(404).json({ success: false, message: "Campaign not found" });
      }

      return res.status(200).json({ success: true, message: "Campaign deleted successfully" });
    } catch (error) {
      console.error("Delete Campaign Error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete campaign" });
    }
  }
);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /admin/reports  â€” paginated
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get("/admin/reports", verifyToken, verifyAdmin, async (req: AuthRequest, res) => {
  try {
    const page  = Math.max(Number(req.query.page)  || 1,  1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const skip  = (page - 1) * limit;

    const collections = await getCollections();

    const total   = await collections.reports.countDocuments();
    const reports = await collections.reports
      .find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return res.status(200).json({
      success: true,
      data: reports,
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
    console.error("Get Reports Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load reports" });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /admin/withdrawals
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get("/admin/withdrawals", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const collections = await getCollections();
    const withdrawals = await collections.withdrawals
      .find({ status: "pending" })
      .sort({ withdraw_date: -1 })
      .toArray();

    res.json({ success: true, withdrawals });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to load withdrawals" });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PATCH /admin/withdrawals/:id/approve
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.patch(
  "/admin/withdrawals/:id/approve",
  verifyToken,
  verifyAdmin,
  async (req: AuthRequest, res) => {
    try {
      const id = req.params.id as string;
      if (!id || Array.isArray(id)) {
        return res.status(400).json({ success: false, message: "Invalid withdrawal id" });
      }
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid withdrawal id format" });
      }

      const collections = await getCollections();
      const withdrawal = await collections.withdrawals.findOne({ _id: new ObjectId(id) });
      if (!withdrawal) {
        return res.status(404).json({ success: false, message: "Withdrawal request not found" });
      }
      if (withdrawal.status === "approved") {
        return res.status(400).json({ success: false, message: "Withdrawal already approved" });
      }

      const raisedResult = await collections.contributions
        .aggregate([
          { $match: { creator_email: withdrawal.creator_email, status: "approved" } },
          { $group: { _id: null, totalRaisedCredits: { $sum: "$Contribution_amount" } } },
        ])
        .toArray();

      const withdrawnResult = await collections.withdrawals
        .aggregate([
          { $match: { creator_email: withdrawal.creator_email, status: "approved" } },
          { $group: { _id: null, totalWithdrawnCredits: { $sum: "$withdrawal_credit" } } },
        ])
        .toArray();

      const totalRaisedCredits    = raisedResult[0]?.totalRaisedCredits ?? 0;
      const totalWithdrawnCredits = withdrawnResult[0]?.totalWithdrawnCredits ?? 0;
      const availableCredits      = Math.max(totalRaisedCredits - totalWithdrawnCredits, 0);

      if (availableCredits < withdrawal.withdrawal_credit) {
        return res.status(400).json({
          success: false,
          message: "Creator does not have enough available credits for this withdrawal",
        });
      }

      const result = await collections.withdrawals.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "approved", approved_at: new Date() } }
      );

      if (!result.modifiedCount) {
        return res.status(400).json({ success: false, message: "Failed to approve withdrawal" });
      }

      return res.status(200).json({ success: true, message: "Withdrawal approved successfully" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Failed to approve withdrawal" });
    }
  }
);

export default router;
