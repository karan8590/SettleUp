const VIBRATION_KEY = "lendledger_vibration";

export const HAPTIC_PATTERNS = {
  RECORD_PAYMENT: [8, 40, 15],
  PAYMENT_COMPLETE: [10, 30, 10, 30, 80],
  ADD_BORROWING: [12],
  DELETE_UNDO: [5, 20, 5, 20, 5],
  ERROR_FAILED: [30, 20, 30, 20, 30],
  BUTTON_TAP: [4],
  BOTTOM_SHEET_OPEN: [6],
  BOTTOM_SHEET_CLOSE: [4],
  TAB_SWITCH: [5],
  SEARCH_BAR_FOCUS: [3],
} as const;

export function vibrate(pattern: number | number[]) {
  if (typeof window === "undefined" || !navigator.vibrate) return;
  
  const enabled = localStorage.getItem(VIBRATION_KEY);
  if (enabled === "false") return;
  
  navigator.vibrate(pattern);
}
