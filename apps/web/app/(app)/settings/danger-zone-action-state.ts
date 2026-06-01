export type ClearLeadTableActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialClearLeadTableActionState: ClearLeadTableActionState = {
  status: "idle",
  message: ""
};
