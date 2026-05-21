export type KpSentLeadUpdate = {
  status: "kp_sent";
  kpSentDate: Date;
  followup1Date: Date;
  followupStatus: "planned";
};

export function createKpSentLeadUpdate(now: Date): KpSentLeadUpdate {
  const followupDate = new Date(now);
  followupDate.setUTCDate(followupDate.getUTCDate() + 7);

  return {
    status: "kp_sent",
    kpSentDate: now,
    followup1Date: followupDate,
    followupStatus: "planned"
  };
}
