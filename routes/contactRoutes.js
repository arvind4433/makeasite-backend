import express from "express";
import { sendEmail } from "../services/emailService.js";
import logger from "../utils/logger.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { name, email, projectType, budget, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: "Name, email, and message are required" });
    }

    const adminEmail = "arvind889481@gmail.com";

    const emailContent = `
      <h3>🚀 New Project Inquiry Received</h3>
      <p>A new visitor submitted the Contact Us form on MakeASite:</p>
      <table style="width:100%; border-collapse:collapse; margin-top:15px; font-size:14px;">
        <tr style="background:#f3f4f6;">
          <td style="padding:10px; font-weight:bold; border:1px solid #e5e7eb;">Name</td>
          <td style="padding:10px; border:1px solid #e5e7eb;">${name}</td>
        </tr>
        <tr>
          <td style="padding:10px; font-weight:bold; border:1px solid #e5e7eb;">Email</td>
          <td style="padding:10px; border:1px solid #e5e7eb;"><a href="mailto:${email}">${email}</a></td>
        </tr>
        <tr style="background:#f3f4f6;">
          <td style="padding:10px; font-weight:bold; border:1px solid #e5e7eb;">Project Type</td>
          <td style="padding:10px; border:1px solid #e5e7eb;">${projectType || "Not specified"}</td>
        </tr>
        <tr>
          <td style="padding:10px; font-weight:bold; border:1px solid #e5e7eb;">Budget</td>
          <td style="padding:10px; border:1px solid #e5e7eb;">${budget || "Not specified"}</td>
        </tr>
        <tr style="background:#f3f4f6;">
          <td style="padding:10px; font-weight:bold; border:1px solid #e5e7eb;">Message / Details</td>
          <td style="padding:10px; border:1px solid #e5e7eb; white-space:pre-wrap;">${message}</td>
        </tr>
      </table>
      <p style="margin-top:20px; font-size:13px; color:#6b7280;">
        You can reply directly to the client at <a href="mailto:${email}">${email}</a> or connect with them via WhatsApp (+91 8894810531).
      </p>
    `;

    try {
      await sendEmail({
        to: adminEmail,
        subject: `New Lead: ${name} - ${projectType || "MakeASite Inquiry"}`,
        html: emailContent
      });
    } catch (err) {
      logger.warn(`Could not send email alert: ${err.message}`);
    }

    return res.status(200).json({
      success: true,
      message: "Message received successfully. We will reply shortly."
    });
  } catch (error) {
    logger.error("Error in contact route:", error);
    return res.status(500).json({ message: "Failed to send message. Please try again or reach out on WhatsApp." });
  }
});

export default router;
