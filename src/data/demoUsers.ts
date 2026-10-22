import type { AppUser } from "@/auth/permissions";

/**
 * SYNTHETIC DEMO DATA — not part of the supplied dataset.
 *
 * Mock users for the prototype's "Demo sign-in" menu. The dataset has no users, logins or
 * permissions, and no Resource Manager on staff, so all of this is our addition. It only says
 * who is signed in and what they may use. It never adds or changes assignments: which projects
 * someone sees still comes from the staffing data.
 */

export const demoUsers: AppUser[] = [
  {
    // Delivery Manager by title (P04). Given both app roles explicitly so one user can test both workspaces.
    id: "jordan",
    name: "Jordan Ellis",
    personId: "P04",
    appRoles: ["resource-manager", "delivery-manager"],
  },
  {
    // Delivery Manager by title (P05), Delivery Manager access only.
    id: "sofia",
    name: "Sofia Marquez",
    personId: "P05",
    appRoles: ["delivery-manager"],
  },
  {
    // Not in the dataset: the practice of 25 has no Resource Manager, so this person is invented.
    id: "rm-demo",
    name: "Demo User",
    personId: null,
    jobTitle: "Resource Manager (mock user)",
    appRoles: ["resource-manager"],
  },
];

export const DEFAULT_USER_ID = "jordan";
