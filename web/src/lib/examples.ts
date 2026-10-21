export type Template = { id: string; title: string; category: string; start: string };

export const CATEGORIES = ["All", "Friends", "Family", "College", "Work", "Plans", "Reactions", "Other"] as const;

// Starters for the visitor to continue. They are prompts, not model output.
export const TEMPLATES: Template[] = [
  { id: "plans", title: "Making plans", category: "Plans", start: "Kal milte hain, timing" },
  { id: "help", title: "Asking for help", category: "Friends", start: "Mujhe ek help chahiye" },
  { id: "reply", title: "Giving a reply", category: "Friends", start: "Haan yaar, main" },
  { id: "casual", title: "Casual chat", category: "Friends", start: "Kya kar raha hai abhi" },
  { id: "exam", title: "Exam and study", category: "College", start: "Aaj ka lecture kaisa" },
  { id: "notes", title: "Asking for notes", category: "College", start: "Bhai kal ke notes" },
  { id: "work", title: "Work update", category: "Work", start: "Is task ka update" },
  { id: "leave", title: "Asking for leave", category: "Work", start: "Sir mujhe kal chhutti" },
  { id: "family", title: "Family check in", category: "Family", start: "Ghar kab aa rahe ho" },
  { id: "mom", title: "Tell mom", category: "Family", start: "Mummy main aaj late" },
  { id: "react", title: "Reacting", category: "Reactions", start: "Wahh, yeh toh" },
  { id: "sorry", title: "Saying sorry", category: "Reactions", start: "Yaar sorry, mujhe" },
  { id: "weekend", title: "Weekend plan", category: "Plans", start: "Is weekend ka kya scene" },
  { id: "cancel", title: "Cancelling", category: "Plans", start: "Yaar aaj nahi ho payega" },
  { id: "thanks", title: "Saying thanks", category: "Other", start: "Thanks yaar, tune" },
  { id: "birthday", title: "Birthday wish", category: "Other", start: "Happy birthday bhai" },
];
