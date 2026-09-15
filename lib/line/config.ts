export const LINE_CONFIG = {
  // Fallback values from environment only — do NOT hardcode real tokens here.
  // Primary config is loaded dynamically from Supabase system_options (id='line_config').
  CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
  USER_ID_OWN: process.env.LINE_USER_ID_OWN || "",
  USER_ID_APPROVER: process.env.LINE_USER_ID_APPROVER || "",

  // Group IDs
  GROUP_ID_TASK: process.env.LINE_GROUP_ID_TASK || "",
  GROUP_ID_SUMMARY: process.env.LINE_GROUP_ID_SUMMARY || "",
  GROUP_ID_PW: process.env.LINE_GROUP_ID_PW || "",
  GROUP_ID_PLAN: process.env.LINE_GROUP_ID_PLAN || "",
  GROUP_ID_FINANCE: process.env.LINE_GROUP_ID_FINANCE || "",
  GROUP_ID_PAID: process.env.LINE_GROUP_ID_PAID || "",
};
