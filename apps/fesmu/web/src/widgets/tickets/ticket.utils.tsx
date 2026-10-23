import { TicketStatus, TicketType } from "@dvgmu/tickets/enum/ticket.enum_pb";
import {
  LocationBuildType,
  LocationDormitoryType,
} from "@dvgmu/tickets/enum/location.enum_pb";

export const extractTicketType = [
  { value: TicketType.PLUMBER, label: "Сантехника" },
];

export const extractTicketStatus = [
  { value: TicketStatus.PENDING, label: "На рассмотрении" },
  { value: TicketStatus.APPROVED, label: "Одобрена" },
  { value: TicketStatus.REJECTED, label: "Отклонена" },
];

export const extractLocationDormitory = [
  { value: LocationDormitoryType.SECOND, label: "Общежитие № 2" },
  { value: LocationDormitoryType.THIRD, label: "Общежитие № 3" },
  { value: LocationDormitoryType.FOURTH, label: "Общежитие № 4" },
];

export const extractLocationBuild = [
  { value: LocationBuildType.LOCATION_BUILD_FIRST, label: "Корпус 1" },
  { value: LocationBuildType.LOCATION_BUILD_SECOND, label: "Корпус 2" },
  { value: LocationBuildType.LOCATION_BUILD_THIRD, label: "Корпус 3" },
  { value: LocationBuildType.LOCATION_BUILD_STUDY_CLASS, label: "Учебный класс" },
];
