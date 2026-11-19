import type { Mission, Stage, Theme, WorldParams } from "./types";

export interface Template {
  id: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  theme: Theme;
  stages: Stage[];
  featured?: boolean;
}

let n = 0;
const uid = (p: string) => `${p}${(++n).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const mission = (m: Omit<Mission, "id">): Mission => ({ id: uid("m"), ...m });
export const stage = (s: Omit<Stage, "id">): Stage => ({ id: uid("s"), ...s });

export const NEON_THEME: Theme = { accent: "#ff3d81", accent2: "#3df0ff", mood: "neon", seed: 7 };

export const neonDistrict = (): Omit<Template, "id"> => ({
  title: "NEON DISTRICT",
  tagline: "The city has a secret. Find it together.",
  description:
    "A 72-hour community investigation in an original, fictional cyberpunk city. A courier vanished with something the whole district wants. Share fragments, crack codes, vote on the final move, and unlock the finale together. No one can solve it alone.",
  category: "Gaming · Mystery",
  theme: NEON_THEME,
  featured: true,
  stages: [
    stage({
      title: "First clues",
      story:
        "Dispatch log #0412 is all that's left of courier Vex. Read it. Then compare notes with the others in the room.",
      threshold: 2,
      missions: [
        mission({
          type: "answer",
          title: "The courier's alias",
          prompt:
            "The log lists Vex's last route: Neon Harbor → Echo Market → Obsidian Tower → Nine Gate. Take the first letter of each stop. What is the alias?",
          answer: "neon",
          hint: "Four stops, four letters.",
        }),
        mission({
          type: "shard",
          title: "The torn access code",
          prompt:
            "A vault code was torn in half. Each of you holds a different fragment. Share yours in the chat, then submit the full code: Fragment A first, then Fragment B.",
          shards: ["Fragment A: VAULT", "Fragment B: 7731"],
          answer: "vault7731",
          hint: "Type it as one code. Spaces and dashes don't matter.",
        }),
      ],
    }),
    stage({
      title: "The investigation",
      story:
        "The vault held a radio and a note. The signal is scrambled. Each of you can only hear half of the passphrase.",
      threshold: 2,
      missions: [
        mission({
          type: "answer",
          title: "Decode the whisper",
          prompt: "The radio whispers a single word in ROT13: ERIRNY. What does it say?",
          answer: "reveal",
          hint: "ROT13 shifts every letter by 13.",
        }),
        mission({
          type: "shard",
          title: "The split passphrase",
          prompt: "Two words open the archive door. Combine your fragments in order, A then B.",
          shards: ["Fragment A: ORBIT", "Fragment B: LANTERN"],
          answer: "orbitlantern",
        }),
      ],
    }),
    stage({
      title: "Community decision",
      story:
        "The archive is open. It holds proof against the Syndicate, and a way to erase the district's debts forever. You can't do both. The community decides.",
      threshold: 2,
      missions: [
        mission({
          type: "vote",
          title: "What do we do with the archive?",
          prompt: "Choose the direction of the finale.",
          options: ["Expose the Syndicate", "Burn the archive"],
        }),
      ],
    }),
    stage({
      title: "Finale: collective unlock",
      story:
        "Whatever you chose, the city is listening. One last phrase unlocks the district's skyline. It's the name of the place you've been fighting for.",
      threshold: 2,
      missions: [
        mission({
          type: "answer",
          title: "Say its name",
          prompt: "Two words. The first is a glowing gas. The second is a part of a city.",
          answer: "neon district",
          hint: "Look at the title of this experience.",
        }),
      ],
    }),
  ],
});

export const harborVault = (): Omit<Template, "id"> => ({
  title: "HARBOR VAULT",
  tagline: "Four roles. One vault. Beat the clock.",
  description:
    "An original heist for a crew of friends. The Harbor Exchange vault opens for a few minutes after 2 a.m. Case the docks, crack the loading bay, get through the vault door and pick your escape. Every crew member holds different pieces, so nobody can do it alone. Start a crew run to race other crews for the fastest time.",
  category: "Heist · Crew",
  theme: { accent: "#ff5a1f", accent2: "#ffc46b", mood: "ember", seed: 12 },
  featured: true,
  stages: [
    stage({
      title: "Case the harbor",
      story: "The Exchange vault sits under Pier 9. Before anyone moves, the crew needs two things: the vault's alias and the loading bay code.",
      threshold: 2,
      missions: [
        mission({
          type: "answer",
          title: "The night manifest",
          prompt: "The manifest lists five crates: Vessel, Anchor, Under-deck, Lantern, Tide. Take the first letter of each, in order. What word do they spell?",
          answer: "vault",
          hint: "Five crates, five letters.",
        }),
        mission({
          type: "shard",
          title: "Loading bay keypad",
          prompt: "Four digits open the loading bay. Each of you holds some of them. Share yours in the team room, then enter all four in order: A, B, C, D.",
          shards: ["Fragment A: 7", "Fragment B: 3", "Fragment C: 9", "Fragment D: 1"],
          answer: "7391",
          hint: "Digits only, no spaces needed.",
        }),
      ],
    }),
    stage({
      title: "The vault door",
      story: "You're inside. The vault door has a radio lock. The guard on the other side whispers the first half; the crew has to assemble the rest.",
      threshold: 2,
      missions: [
        mission({
          type: "answer",
          title: "The guard's whisper",
          prompt: "The guard whispers one word in ROT13: FRPERG. What is it?",
          answer: "secret",
          hint: "ROT13 shifts each letter 13 places.",
        }),
        mission({
          type: "shard",
          title: "Passphrase",
          prompt: "The door wants a three-word passphrase. Pieces are split across the crew. Combine A, B, C in order.",
          shards: ["Fragment A: TIDE", "Fragment B: LANTERN", "Fragment C: SAFE"],
          answer: "tidelanternsafe",
          hint: "If you hold no piece this time, help the others decode.",
        }),
      ],
    }),
    stage({
      title: "The getaway",
      story: "Alarms in under a minute. The crew votes on the route, then everyone confirms the ferry time.",
      threshold: 2,
      missions: [
        mission({ type: "vote", title: "Pick the escape route", prompt: "Where does the crew run?", options: ["Service tunnel", "Rooftop line", "Harbor ferry"] }),
        mission({
          type: "answer",
          title: "Ferry time",
          prompt: "The ferry leaves when the short hand points straight down and the long hand points straight up. What hour is it? (just the number)",
          answer: "6|600|six",
        }),
      ],
    }),
  ],
});

export const TEMPLATES: Template[] = [
  { id: "t-neon-district", ...neonDistrict() },
  { id: "t-harbor-vault", ...harborVault() },
  {
    id: "t-fan-theory",
    title: "Fan Theory Showdown",
    tagline: "Pick a side. Defend it. Let the crowd decide.",
    description:
      "A two-round fandom debate: crack the opening riddle together, then vote on the community's canon theory.",
    category: "Fandom · Debate",
    theme: { accent: "#ff5a1f", accent2: "#ffc46b", mood: "ember", seed: 21 },
    stages: [
      stage({
        title: "Round 1: the riddle",
        story: "Every theory starts with evidence. Solve the opener to open the floor.",
        threshold: 2,
        missions: [
          mission({
            type: "answer",
            title: "Warm-up riddle",
            prompt: "What has keys but can't open locks, and space but no room?",
            answer: "keyboard",
          }),
        ],
      }),
      stage({
        title: "Round 2: the vote",
        story: "The floor is open. Which theory becomes community canon?",
        threshold: 2,
        missions: [
          mission({
            type: "vote",
            title: "Canon theory",
            prompt: "Pick the theory you'd defend.",
            options: ["It was a time loop", "It was a simulation", "It was all a dream"],
          }),
        ],
      }),
    ],
  },
  {
    id: "t-speedrun-relay",
    title: "Speedrun Relay",
    tagline: "Split the route. Share the splits. Beat the clock.",
    description:
      "Each runner holds one split of a route. Compare notes in chat and assemble the full route to clear the stage.",
    category: "Gaming · Squad",
    theme: { accent: "#a3e635", accent2: "#22d3ee", mood: "toxic", seed: 33 },
    stages: [
      stage({
        title: "Route planning",
        story: "Every runner has a piece of the route. Nobody has all of it.",
        threshold: 2,
        missions: [
          mission({
            type: "shard",
            title: "Assemble the route",
            prompt: "Combine the splits in order: A then B.",
            shards: ["Split A: LEFT-LEFT", "Split B: JUMP-DASH"],
            answer: "leftleftjumpdash",
          }),
        ],
      }),
    ],
  },
  {
    id: "t-launch-hunt",
    title: "Launch Day Scavenger Hunt",
    tagline: "Hide clues across your channels. Reward the sharpest fans.",
    description:
      "A creator-run launch campaign: fans hunt for a secret phrase across your content, then unlock the reveal together.",
    category: "Creator · Launch",
    theme: { accent: "#5eead4", accent2: "#a78bfa", mood: "aurora", seed: 45 },
    stages: [
      stage({
        title: "The hunt",
        story: "A secret phrase is hidden in your launch content. First, prove you're paying attention.",
        threshold: 2,
        missions: [
          mission({
            type: "answer",
            title: "The secret phrase",
            prompt: "Replace this with the phrase hidden in your video. (Edit me in Studio!)",
            answer: "launch day",
          }),
        ],
      }),
      stage({
        title: "The reveal",
        story: "Fans unlocked it together. Time for the reveal.",
        threshold: 2,
        missions: [
          mission({
            type: "vote",
            title: "What should we reveal first?",
            prompt: "Pick the first reveal.",
            options: ["The trailer", "The release date"],
          }),
        ],
      }),
    ],
  },
];

export const MOODS: Theme["mood"][] = ["neon", "ember", "aurora", "void", "toxic"];
export const MOOD_COLORS: Record<Theme["mood"], [string, string]> = {
  neon: ["#ff3d81", "#3df0ff"],
  ember: ["#ff5a1f", "#ffc46b"],
  aurora: ["#5eead4", "#a78bfa"],
  void: ["#818cf8", "#f0abfc"],
  toxic: ["#a3e635", "#22d3ee"],
};

/** Deterministic city shape from a seed, so every world differs even without AI. */
export function deriveWorld(seed: number): WorldParams {
  const r = (n: number) => {
    const x = Math.sin(seed * 997 + n * 131) * 43758.5453;
    return x - Math.floor(x);
  };
  return { density: 0.72 + r(1) * 0.26, height: 0.8 + r(2) * 0.7, landmarks: 0.04 + r(3) * 0.12, fog: 0.011 + r(4) * 0.012, rain: 0.35 + r(5) * 0.65 };
}

const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
/** Accepts anything an AI might return and yields safe parameters. */
export function sanitizeWorld(w: Partial<Record<keyof WorldParams, unknown>> | undefined, seed: number): WorldParams {
  const d = deriveWorld(seed);
  return {
    density: clamp(w?.density, 0.5, 1, d.density),
    height: clamp(w?.height, 0.5, 1.8, d.height),
    landmarks: clamp(w?.landmarks, 0, 0.25, d.landmarks),
    fog: clamp(w?.fog, 0.006, 0.035, d.fog),
    rain: clamp(w?.rain, 0, 1, d.rain),
  };
}
