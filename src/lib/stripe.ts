import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

// No external image — some email clients block remote images by default,
// which was showing a broken-image icon. This header is pure HTML/CSS
// (a gradient circle badge + styled text), so it always renders.
const emailHeader = `
  <div style="background: #0f172a; border-radius: 16px; padding: 20px 24px; text-align: center; margin-bottom: 28px;">
    <table role="presentation" align="center" style="margin: 0 auto; border-collapse: collapse;">
      <tr>
        <td style="vertical-align: middle; padding-right: 10px;">
          <table role="presentation" style="border-collapse: collapse;">
            <tr>
              <td
                width="34"
                height="34"
                align="center"
                valign="middle"
                style="
                  width: 34px;
                  height: 34px;
                  border-radius: 10px;
                  background: linear-gradient(135deg, #34d399, #059669);
                  font-size: 18px;
                  font-weight: 800;
                  color: #f8fafc;
                  font-family: sans-serif;
                "
              >
                Z
              </td>
            </tr>
          </table>
        </td>
        <td style="vertical-align: middle;">
          <span style="font-size: 24px; font-weight: 700; letter-spacing: -0.01em; color: #f8fafc; font-family: sans-serif;">
            enda<span style="color: #34d399;">Fund</span>
          </span>
        </td>
      </tr>
    </table>
  </div>
`;

export const sendPaymentConfirmationEmail = async (
  toEmail: string,
  credits: number,
  amountUsd: number,
) => {
  try {
    await transporter.sendMail({
      from: `"ZendaFund" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Your ZendaFund credit purchase is confirmed",
      text: `Payment Successful\n\nThank you for your purchase!\n\nCredits Purchased: ${credits.toLocaleString()}\nAmount Paid: $${amountUsd.toFixed(2)}\n\nYour credits have been added to your account and are ready to use to support campaigns.\n\nIf you have any questions, reply to this email.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          ${emailHeader}
          <h2 style="color: #10b981;">Payment Successful</h2>
          <p>Thank you for your purchase! Here are the details:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Credits Purchased</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right;">${credits.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Amount Paid</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right;">$${amountUsd.toFixed(2)}</td>
            </tr>
          </table>
          <p style="color: #64748b; font-size: 14px;">
            Your credits have been added to your account and are ready to use to support campaigns.
          </p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
            If you have any questions, reply to this email.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send confirmation email:", error);
  }
};

export const sendContributionConfirmationEmail = async (data: {
  toEmail: string;
  supporterName: string;
  campaignTitle: string;
  campaignId: string;
  amount: number;
  creatorName?: string;
  date: Date;

  paymentMethod?: "card" | "credits";
  remainingCredits?: number;

  stripeSessionId?: string;
}) => {
  try {
    const formattedDate = data.date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const paymentMethodText =
      data.paymentMethod === "credits" ? "Wallet Credits" : "Card (Stripe)";

    await transporter.sendMail({
      from: `"ZendaFund" <${process.env.EMAIL_USER}>`,
      to: data.toEmail,

      subject: `You supported "${data.campaignTitle}" — Thank You!`,

      text: `
  Contribution Confirmed
  
  Hi ${data.supporterName},
  
  Thank you for supporting "${data.campaignTitle}"${
    data.creatorName ? ` by ${data.creatorName}` : ""
  }.
  
  Campaign:
  ${data.campaignTitle}
  
  Contribution:
  ${data.amount}
  
  Payment Method:
  ${paymentMethodText}
  
  ${
    data.paymentMethod === "credits"
      ? `Remaining Credits: ${data.remainingCredits}`
      : `Transaction ID: ${data.stripeSessionId ?? "N/A"}`
  }
  
  Status:
  Pending Approval
  
  Date:
  ${formattedDate}
  
  View Campaign:
  ${process.env.NEXT_PUBLIC_BASE_URL}/explore/${data.campaignId}
  `,

      html: `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto">
  
        ${emailHeader}
  
        <h2 style="color:#10b981">
        Contribution Confirmed 🎉
        </h2>
  
        <p>
        Hi <strong>${data.supporterName}</strong>,
        </p>
  
        <p>
        Thank you for supporting
        <strong>${data.campaignTitle}</strong>
  
        ${data.creatorName ? `by <strong>${data.creatorName}</strong>` : ""}.
        </p>
  
        <table
        style="
        width:100%;
        border-collapse:collapse;
        margin-top:20px;
        ">
  
        <tr>
        <td style="padding:10px;color:#64748b">
        Campaign
        </td>
  
        <td
        style="
        padding:10px;
        text-align:right;
        font-weight:bold;
        ">
        ${data.campaignTitle}
        </td>
        </tr>
  
        <tr>
        <td style="padding:10px;color:#64748b">
        Contribution
        </td>
  
        <td
        style="
        padding:10px;
        text-align:right;
        font-weight:bold;
        ">
        ${data.amount}
        </td>
        </tr>
  
        <tr>
        <td style="padding:10px;color:#64748b">
        Payment Method
        </td>
  
        <td
        style="
        padding:10px;
        text-align:right;
        font-weight:bold;
        ">
        ${paymentMethodText}
        </td>
        </tr>
  
        ${
          data.paymentMethod === "credits"
            ? `
        <tr>
        <td style="padding:10px;color:#64748b">
        Remaining Credits
        </td>
  
        <td
        style="
        padding:10px;
        text-align:right;
        font-weight:bold;
        ">
        ${data.remainingCredits}
        </td>
        </tr>
        `
            : `
        <tr>
        <td style="padding:10px;color:#64748b">
        Transaction ID
        </td>
  
        <td
        style="
        padding:10px;
        text-align:right;
        font-size:12px;
        ">
        ${data.stripeSessionId ?? "N/A"}
        </td>
        </tr>
        `
        }
  
        <tr>
        <td style="padding:10px;color:#64748b">
        Status
        </td>
  
        <td
        style="
        padding:10px;
        text-align:right;
        color:#f59e0b;
        font-weight:bold;
        ">
        Pending Approval
        </td>
        </tr>
  
        <tr>
        <td style="padding:10px;color:#64748b">
        Date
        </td>
  
        <td
        style="
        padding:10px;
        text-align:right;
        ">
        ${formattedDate}
        </td>
        </tr>
  
        </table>
  
        <div style="text-align:center;margin-top:30px">
  
        <a
        href="${process.env.NEXT_PUBLIC_BASE_URL}/explore/${data.campaignId}"
        style="
        display:inline-block;
        background:#10b981;
        color:white;
        padding:12px 28px;
        border-radius:999px;
        text-decoration:none;
        font-weight:bold;
        ">
        View Campaign
        </a>
  
        </div>
  
        <p
        style="
        margin-top:30px;
        color:#64748b;
        font-size:14px;
        ">
        You can track this contribution anytime from your dashboard.
        </p>
  
        </div>
        `,
    });
  } catch (error) {
    console.error("Failed to send contribution confirmation email:", error);
  }
};

export const sendGenericEmail = async (
  toEmail: string,
  subject: string,
  text: string,
  html?: string,
) => {
  try {
    await transporter.sendMail({
      from: `"ZendaFund" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("Failed to send generic email:", error);
  }
};