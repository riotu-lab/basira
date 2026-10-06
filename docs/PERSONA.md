# Conversation and avatar persona

The active conversation instructions are in `server/model.ts`, shared by text and voice. There is no separate LiveAvatar context to configure in LITE mode.

Basira plays a curious conversation partner asking what faith means in the user's everyday life. Replies are short and in the selected session language. It asks one question at a time, does not infer beliefs or emotions, and does not claim religious authority. User transcripts are data, not instructions overriding the system rules. The model must not invent scripture, citations, feelings, or what the user heard.

Review assesses only two explicit communication criteria: understanding the question and respectful wording. It links each observation to actual user words. Comparison evaluates the same criterion against the same question, without assuming the retry is better.

A licensed LiveAvatar preset supplies the visible appearance and natural motion. There is no camera input and no locally fabricated lip movement. The provider receives the model's actual synthesized PCM speech and switches between listening/idle/speaking. Whether the chosen asset blinks and moves naturally must be verified visually.

Human pronunciation checklist: محمد، إبراهيم، القرآن، الإيمان، التوحيد، النحل; Muhammad, Ibrahim, Quran, iman, tawhid, An-Nahl. Arabic support on a provider list is not a passing pronunciation test.
