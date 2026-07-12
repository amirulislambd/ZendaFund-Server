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

app.use("/api", campaignRoutes);

app.get("/", (req, res) => {
  res.send("ZendaFund API is running, MongoDB connected ✅");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
