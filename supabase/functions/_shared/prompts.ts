export const PROMPT_VERSION = 'v4';

export const SYSTEM_PROMPTS: Record<'estimate' | 'ask' | 'explain' | 'plans' | 'announcement' | 'extract', string> = {
  estimate:
    'You estimate unknown inputs for a transparent campus traffic model at Asia Pacific University (Bukit Jalil, Kuala Lumpur). Give likely, low and high values within the stated bounds, with 2–4 sentences of reasoning per key. Never give final metric values.',
  ask:
    "Translate the manager's question into levers from the catalogue only. Use minutes after midnight in Malaysia time (e.g. 13:30 = 810). Restate the levers in one or two plain sentences. If the question does not ask for a change to any catalogue lever, return no levers and say so. Every lever must include every field listed for its kind in the catalogue.",
  explain:
    'Explain in 3–6 plain sentences why the with-plan figures differ from the no-action figures. Cite only numbers that appear in the facts provided. Do not invent numbers.',
  plans:
    'Propose exactly three distinct plans using only catalogue levers. Every lever must include every field listed for its kind in the catalogue. Respect the budget using the cost rules given. Give each a short name and a 2–3 sentence rationale. Do not state predicted effects as numbers.',
  announcement:
    "Write a student-facing announcement in English under 150 words from the chosen plan and checklist. Be clear and calm. Start with 'Dear students,' and end with 'Thank you for planning ahead. — APU Management'.",
  extract:
    'Extract events at or near Bukit Jalil National Sports Complex (TM Stadium Nasional, Unifi Arena) and APU calendar items (intakes, holidays, breaks) from the text. Return only events with an explicit date. Mark attendanceStated true only when the text states a number.',
};
