declare module "romcal" {
  type CalendarForOptions =
    | number
    | {
        year: number;
        country?: string;
        locale?: string;
        type?: "calendar" | "liturgical";
        [key: string]: unknown;
      };

  const romcal: {
    calendarFor: (options?: CalendarForOptions | boolean, skipConversion?: boolean) => unknown[];
  };

  export default romcal;
}

