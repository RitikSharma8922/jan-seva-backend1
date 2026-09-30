export const TIMELINE_STEPS = [
  "Complaint Submitted",
  "Complaint Received",
  "Officer Assigned",
  "Work In Progress",
  "Problem Resolved",
];

// How many of the 5 steps should be marked "done" for a given status —
// mirrors the logic that used to live in the frontend's AppContext.
export function doneCountFor(status) {
  switch (status) {
    case "Resolved":
      return 5;
    case "In Progress":
      return 3;
    case "Rejected":
      return 2;
    default:
      return 1; // Pending
  }
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
