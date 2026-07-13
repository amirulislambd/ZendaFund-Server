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
}) => {
  try {
    const formattedDate = data.date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    await transporter.sendMail({
      from: `"ZendaFund" <${process.env.EMAIL_USER}>`,
      to: data.toEmail,
      subject: `You supported "${data.campaignTitle}" — thank you!`,
      text: `Contribution Confirmed\n\nHi ${data.supporterName},\n\nThank you for supporting ${data.campaignTitle}${
        data.creatorName ? ` by ${data.creatorName}` : ""
      }! Your generosity makes a real difference.\n\nCampaign: ${data.campaignTitle}\nAmount Contributed: ${data.amount.toLocaleString()} credits\nDate: ${formattedDate}\n\nView the campaign: ${process.env.NEXT_PUBLIC_BASE_URL}/explore/${data.campaignId}\n\nYou can track this and other contributions from your dashboard at any time.\n\nIf you have any questions, reply to this email.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          ${emailHeader}
          <h2 style="color: #10b981;">Contribution Confirmed 🎉</h2>
          <p>Hi ${data.supporterName},</p>
          <p>
            Thank you for supporting <strong>${data.campaignTitle}</strong>${
              data.creatorName ? ` by ${data.creatorName}` : ""
            }! Your generosity makes a real difference.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Campaign</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.campaignTitle}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Amount Contributed</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.amount.toLocaleString()} credits</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Date</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right;">${formattedDate}</td>
            </tr>
          </table>
          <div style="text-align: center; margin: 24px 0;">
            <a
              href="${process.env.NEXT_PUBLIC_BASE_URL}/explore/${data.campaignId}"
              style="display: inline-block; background: #10b981; color: white; padding: 10px 24px; border-radius: 999px; text-decoration: none; font-weight: 600;"
            >
              View Campaign
            </a>
          </div>
          <p style="color: #64748b; font-size: 14px;">
            You can track this and other contributions from your dashboard at any time.
          </p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
            If you have any questions, reply to this email.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send contribution confirmation email:", error);
  }
};