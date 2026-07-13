import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

import campaignRoutes from "./src/routes/campaigns";
import authRoutes from "./src/routes/auth";
import contributionRoutes from "./src/routes/contribution";
import paymentRoutes from "./src/routes/payments";

app.use("/api", campaignRoutes);
app.use("/api", authRoutes);
app.use("/api", contributionRoutes);
app.use("/api", paymentRoutes);

app.get("/", (req, res) => {
  res.send("ZendaFund API is running, MongoDB connected ✅");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
