import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToiletIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  BooleanQuestion,
  CommonQuestion,
  QuestionGratitude,
  RatingQuestion,
  TextareaQuestion,
} from "./question.form";

const meta = {
  title: "Shared/Question form",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj;

/** Один экран-обёртка с навигацией по страницам. */
export const Common: Story = {
  render: () => {
    const { control } = useForm({
      defaultValues: { purityRating: 3, hasSoap: true, comment: "" },
    });

    return (
      <CommonQuestion
        id={42}
        icon={<ToiletIcon className="w-12 h-12 text-accent" />}
        title="Оценка состояния туалета"
        description="Туалет №1, 3 этаж"
        pages={[
          <RatingQuestion
            key="purity"
            name="purityRating"
            control={control}
            title="🧹 Оцените чистоту"
            description="Насколько чистая туалетная комната?"
            labels={{ 1: "Очень грязно", 3: "Средне", 5: "Стерильно" }}
          />,
          <BooleanQuestion
            key="soap"
            name="hasSoap"
            control={control}
            title="🧼 Наличие мыла"
            description="Есть ли мыло?"
            options={{ true: "✅ Есть", false: "❌ Нет" }}
          />,
          <TextareaQuestion
            key="comment"
            name="comment"
            control={control}
            title="💬 Комментарий"
            description="Как мы можем стать лучше (необязательно)"
            placeholder="Ваш комментарий..."
          />,
        ]}
        onSubmit={() => alert("submit")}
      />
    );
  },
};

/** Оценка по шкале 1–5. */
export const Rating: Story = {
  render: () => {
    const { control } = useForm({ defaultValues: { rating: 4 } });
    return (
      <div className="p-8 max-w-md">
        <RatingQuestion
          name="rating"
          control={control}
          title="🛋️ Оцените комфорт"
          description="Насколько комфортно находиться в зале?"
          labels={{
            1: "Очень некомфортно",
            2: "Некомфортно",
            3: "Средне",
            4: "Комфортно",
            5: "Отлично",
          }}
        />
      </div>
    );
  },
};

/** Да / нет. */
export const Boolean: Story = {
  render: () => {
    const { control } = useForm({ defaultValues: { hasPaper: true } });
    return (
      <div className="p-8 max-w-md">
        <BooleanQuestion
          name="hasPaper"
          control={control}
          title="🧻 Наличие туалетной бумаги"
          description="Есть ли туалетная бумага?"
          options={{ true: "✅ Есть", false: "❌ Нет" }}
        />
      </div>
    );
  },
};

/** Свободный комментарий. */
export const Textarea: Story = {
  render: () => {
    const { control } = useForm({ defaultValues: { comment: "" } });
    return (
      <div className="p-8 max-w-md">
        <TextareaQuestion
          name="comment"
          control={control}
          title="💬 Комментарий"
          description="Как мы можем стать лучше (необязательно)"
          placeholder="Ваш комментарий..."
        />
      </div>
    );
  },
};

/** Экран благодарности после отправки. */
export const Gratitude: Story = {
  render: () => <QuestionGratitude />,
};
