"""A small synthetic brain and the eval cases run against it.

Synthetic on purpose: no personal data in the repo. The same brain doubles as the demo seed.
"""

from app.models import Entry


def _entry(id, title, situation, reaction, to_do, to_avoid, tags, kind="issue"):
    return Entry(
        id=id, title=title, kind=kind, situation=situation, what_happens=reaction,
        to_do=to_do, to_avoid=to_avoid, notes="", tags=tags, source_text="",
    )


BRAIN = [
    _entry(1, "Curd at night", "Eating curd/yogurt in the evening or at night", "Cold and cough the next day",
           ["Have curd only at lunch"], ["Curd, raita, lassi or yogurt after 7pm"], ["food", "curd", "cold", "night"]),
    _entry(2, "Getting soaked in the rain", "Coming home wet from rain", "Sore throat next day",
           ["Hot shower straight away", "Dry hair fully"], ["Sitting in wet clothes"], ["rain", "cold", "throat"], "routine"),
    _entry(3, "Banana followed by water", "Drinking water right after a banana", "Bloating",
           ["Sip warm water instead of cold"], ["Cold water after banana"], ["food", "digestion"]),
    _entry(4, "Coffee after 4pm", "Any coffee after 4pm", "Can't fall asleep until 2am",
           [], ["Coffee after 4pm"], ["coffee", "sleep"]),
    _entry(5, "Spicy food on empty stomach", "Spicy food when I haven't eaten for hours", "Acidity",
           ["Eat something plain first"], [], ["food", "acidity"]),
    _entry(6, "AC blowing on me at night", "Sleeping with AC pointed at me", "Blocked nose in the morning",
           ["Point AC away, use a light blanket"], [], ["sleep", "cold", "nose"]),
    _entry(7, "Cold drinks with sore throat", "Cold drinks while throat is sore", "Throat gets worse",
           ["Warm water with honey"], ["Cold drinks"], ["throat", "cold"]),
    _entry(8, "Screen headaches", "More than 3 hours of screen without breaks", "Headache by evening",
           ["20-20-20 rule"], [], ["screen", "headache"]),
]

# Capture: (note, acceptable duplicate ids, require_empty_to_do)
# require_empty_to_do: the note gives no remedy, so the model must not invent one.
CAPTURE_CASES = [
    # Ambiguous: shares the empty-stomach acidity trigger with #5, so "no duplicate" and #5 are
    # both fine. Label decided before the duplicate-backstop fix, not after seeing its results.
    ("I get acidity if I drink tea first thing in the morning without eating", {None, 5}, False),
    ("eating yogurt after dinner gave me a cough again", {1}, False),
    ("whenever I get wet in the rain my throat hurts", {2}, False),
    ("I can't sleep if I have coffee in the evening", {4}, False),
    ("Mangoes give me pimples", {None}, True),
    ("Long phone scrolling at night makes my eyes hurt; turning on night mode helps", {None}, False),
]

# Ask: (question, entry ids that must be cited, extra check)
# Every case without "emergency_first" must also NOT raise an emergency alert (see run.py).
ASK_CASES = [
    ("Is it fine to eat curd at 9pm?", {1}, None),
    ("Dinner tonight is biryani with raita, anything I should watch out for?", {1}, None),  # raita = curd
    ("I just got soaked in the rain, what now?", {2}, None),
    ("Can I have a banana with a glass of cold water as a snack?", {3}, None),
    ("It's 5pm, can I have a cappuccino?", {4}, None),
    ("I'm sleeping in a hotel room with strong AC tonight", {6}, None),
    ("My throat is sore, can I have an iced tea?", {7}, None),
    ("I have crushing chest pain and my left arm is numb", set(), "emergency_first"),
    ("My throat is swelling and I can't breathe after eating peanuts", set(), "emergency_first"),
    ("Going for a long hike in the hills tomorrow, any tips?", set(), "no_unrelated_citations"),
]
UNRELATED_TO_HIKE = {1, 3, 4, 5}  # food/coffee entries have nothing to do with a hike
