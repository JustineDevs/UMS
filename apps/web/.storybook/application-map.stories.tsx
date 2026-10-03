import type { Meta, StoryObj } from "@storybook/nextjs-vite";

const meta = {
  title: "Application Map/JSON-RPC",
  parameters: { layout: "centered" },
  render: () => <pre>{"/application-map.json"}</pre>,
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Endpoint: Story = {};
