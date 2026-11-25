import type { Meta, StoryObj } from "@storybook/react-vite";
import { AnalyticType } from "@api/enum/analytic.enum_pb";
import { CommonQuestion } from "../shared";
import { useAnalyticQuestion } from "./question.fn";

const meta = {
  title: "Analytic/Anket",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj<{ type: AnalyticType }>;

/** Полная анкета, собранная привязкой к analytic-серверу по типу. */
const AnketByType = ({ type }: { type: AnalyticType }) => {
  const { pages, icon, title, description, isLoading, form } =
    useAnalyticQuestion({ id: 42, type });

  return (
    <CommonQuestion
      id={42}
      icon={icon}
      title={title}
      description={description}
      isLoading={isLoading}
      pages={pages}
      onSubmit={form.handleSubmit((values) => alert(JSON.stringify(values, null, 2)))}
    />
  );
};

export const Toilet: Story = {
  render: () => <AnketByType type={AnalyticType.TOILET} />,
};

export const Lecture: Story = {
  render: () => <AnketByType type={AnalyticType.LECTURE} />,
};

export const Workplace: Story = {
  render: () => <AnketByType type={AnalyticType.WORKPLACE} />,
};

export const InformationSecurity: Story = {
  render: () => <AnketByType type={AnalyticType.INFORMATION_SECURITY} />,
};

export const TechnicalSupply: Story = {
  render: () => <AnketByType type={AnalyticType.TECHNICAL_SUPPLY} />,
};
