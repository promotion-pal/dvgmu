"use client";

import { useFetchState } from "@/features/fetch";
import { PromCommonFormProps } from "@/features/lib/form";
import { userServiceClient } from "@/shared/api/user";
import type { UserCreateRequest } from "@fesmu/contract/dormitory/service/user.service_pb";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserCreateSchema, userSchema } from "./user.schema";
import { User } from "@fesmu/contract/dormitory/entity/user.entity_pb";

const useUser = () => {
  const listState = useFetchState<User>();

  const fetch = async () => {
    listState.setLoading(true);
    listState.setError(false);

    try {
      const response = await userServiceClient.userFetch({});
      listState.setList(response.users);
    } catch (error) {
      console.error("Ошибка при получении списка пользователей:", error);
      listState.setError(true);
    } finally {
      listState.setLoading(false);
    }
  };

  return {
    fetch,

    list: listState.list,
    error: listState.error,
    empty: listState.empty,
    loading: listState.loading,
  };
};

const useUserForm = ({ refresh, onCloseModal }: PromCommonFormProps) => {
    const form = useForm({
        resolver: zodResolver(userSchema),
        defaultValues: {
        },
    });

    const handleSubmit = form.handleSubmit(async (value: UserCreateSchema) => {
        try {
      const response = await userServiceClient.userCreate({
        phone: value.phone ?? "",
        lastName: value.lastName ?? "",
        firstName: value.firstName ?? "",
        patronymic: value.patronymic ?? "",
      });

      if (!response.success) {
        console.error("Не удалось создать пользователя:", response.message);
        return null;
      }

      await refresh();
      return response.id;
    } catch (error) {
      console.error("Ошибка при создании пользователя:", error);
      return null;
    }
    });


    return {
        form,
        handleSubmit
    }
}


export { useUser, useUserForm };
