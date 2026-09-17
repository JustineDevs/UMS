import { flag } from "flags/next";

export const adminCommandPaletteEnabled = flag<boolean>({
  key: "admin-command-palette",
  description: "Enable search across the admin workspace.",
  defaultValue: true,
  decide: () => process.env.ADMIN_COMMAND_PALETTE !== "false",
});
