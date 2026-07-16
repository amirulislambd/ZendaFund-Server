# ZendaFund - Crowdfunding Platform

Welcome to **ZendaFund**, a comprehensive MERN stack crowdfunding platform. This platform empowers creators to raise funds for projects, causes, and products by collecting contributions from supporters. 

**Live Site URL:** [https://zendafund.vercel.app](https://zendafund.vercel.app) *(Replace with actual link)*  
**Client-Side Repository:** [GitHub Client Link](#) *(Replace with actual link)*  
**Server-Side Repository:** [GitHub Server Link](#) *(Replace with actual link)*

### Admin Credentials for Testing
- **Admin Email:** admin@zendafund.com
- **Admin Password:** Admin@12345

---

## 🌟 Key Features of ZendaFund

**🛡️ Authentication & Roles**
- **Role-Based Access Control:** Secure authentication with three distinct roles: `Supporter`, `Creator`, and `Admin`. Each role features a tailored, responsive dashboard and specific permissions.
- **Robust Security & Validation:** Secure authorization middleware, environment variable protection, and strict input validation on both client and server sides.

**🚀 Campaign Management**
- **Dynamic Campaign Creation:** Creators can seamlessly launch campaigns with rich descriptions, specific funding goals, minimum contribution limits, and strict deadlines.
- **ImgBB Image Integration:** High-quality image uploading system for campaign covers and user profile pictures using the ImgBB API.

**💰 Contributions & Payments**
- **Credit-Based Contribution System:** Supporters contribute to campaigns using platform credits.
- **Integrated Stripe Payments:** Supporters can easily purchase credit packages (e.g., 100 credits for $10) via a secure Stripe payment gateway.
- **Withdrawal Processing:** Creators can request payouts when they reach a minimum credit threshold (200 credits = $10). Earnings are dynamically calculated.

**⚙️ Admin Controls & Automation**
- **Admin Moderation:** Admins have full control to review, approve, or reject newly submitted campaigns and process creator withdrawal requests.
- **Automated Credit Tracking & Refunds:** The system autonomously manages credit deductions, creator earnings, and handles seamless refunds to supporters when a campaign is rejected or deleted.

**✨ Interactive User Experience**
- **Real-time Notifications:** Users receive automated pop-up notifications for key actions like campaign approvals, new contributions, and successful withdrawal processing.
- **Interactive Dashboards:** Role-specific dashboards presenting dynamic statistics (total earnings, active campaigns, pending contributions) at a glance.
- **Pagination & Data Tables:** Clean, paginated tables for efficiently managing contributions, withdrawal histories, and user registries.

---

## 💻 Technologies Used

- **Frontend:** React, Next.js, Tailwind CSS, Swiper Slider.
- **Backend:** Node.js, Express.js, TypeScript.
- **Database:** MongoDB.
- **Authentication:** better-auth (Secure session and token management).
- **Payments:** Stripe API.
- **Image Hosting:** ImgBB API.

---

## 🚀 Environment Variables (Backend)

To run the backend locally, create a `.env` file in the root directory with the following keys:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
STRIPE_SECRET=your_stripe_secret_key
IMGBB_KEY=your_imgbb_api_key
```

---

## 🛠️ Installation & Setup (Backend)

1. **Clone the repository:**
   ```bash
   git clone <server-repo-url>
   cd zendafun-server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run in development mode:**
   ```bash
   npm run dev
   ```

4. **Build and start for production:**
   ```bash
   npm run build
   npm start
   ```

---

## 📋 API & Architecture Roadmap
For a detailed breakdown of the backend development phases, specific APIs, and data models for this project, please refer to the [roadmap.md](./roadmap.md) file in this repository.
