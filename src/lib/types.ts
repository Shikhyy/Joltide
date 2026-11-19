export type MissionType = "answer" | "shard" | "vote";

export interface Mission {
  id: string;
  type: MissionType;
  title: string;
  prompt: string;
  /** server-only: accepted answer(s), normalised */
  answer?: string;
  /** shard missions: one fragment per participant slot (server-only until assigned) */
  shards?: string[];
  /** vote missions */
  options?: string[];
  hint?: string;
}

export interface Stage {
  id: string;
  title: string;
  story: string;
  /** distinct participants that must finish every mission to unlock the next stage */
  threshold: number;
  missions: Mission[];
}

/** The physical shape of an experience's city. Chosen by the AI designer, tweakable in Studio. */
export interface WorldParams {
  density: number; // 0.5..1   share of lots that get a tower
  height: number; // 0.5..1.8 tower height multiplier
  landmarks: number; // 0..0.25 chance a tower is a landmark spire
  fog: number; // 0.006..0.035
  rain: number; // 0..1
}

export interface Theme {
  accent: string;
  accent2: string;
  mood: "neon" | "ember" | "aurora" | "void" | "toxic";
  seed: number;
  world?: WorldParams;
}

export type ExperienceStatus = "DRAFT" | "LIVE" | "COMPLETED";

export interface Experience {
  id: string;
  title: string;
  tagline: string;
  description: string;
  theme: Theme;
  stages: Stage[];
  status: ExperienceStatus;
  currentStage: number;
  creatorId: string;
  creatorName: string;
  creatorKey: string; // never leaves the server
  source: "ai" | "template" | "manual" | "seed";
  streamUrl?: string;
  groupChannelId?: string;
  openChannelId?: string;
  createdAt: number;
  publishedAt?: number;
  clonedFrom?: string;
  /** private solo demo copy: unlisted, excluded from public stats */
  sandbox?: boolean;
  /** creator opted in to let others remix this experience (answers included) */
  listedAsTemplate?: boolean;
  remixCount?: number;
  /** scheduled launch: nothing can be solved before this time */
  startsAt?: number;
  /** a private crew run of a parent experience */
  run?: RunInfo;
}

export interface RunInfo {
  parentId: string;
  crewName: string;
  size: number;
  /** set when the crew is full; the heist clock runs from here */
  startedAt?: number;
  completedAt?: number;
}

export interface Member {
  userId: string;
  name: string;
  color: string;
  joinedAt: number;
  lastSeen: number;
  slot: number;
  isBot?: boolean;
  ref?: string;
}

export interface Submission {
  id: string;
  missionId: string;
  stageId: string;
  userId: string;
  content: string;
  correct: boolean;
  at: number;
}

export interface GameEvent {
  id: string;
  at: number;
  type: "joined" | "mission_complete" | "stage_unlocked" | "completed" | "vote" | "published" | "announcement";
  actor?: string;
  text: string;
  stageIndex?: number;
}

export interface Aggregate {
  exp: Experience;
  members: Member[];
  submissions: Submission[];
  events: GameEvent[];
}

/* ------------------------------ public views ------------------------------ */

export interface PublicMission {
  id: string;
  type: MissionType;
  title: string;
  prompt: string;
  options?: string[];
  hint?: string;
  done: boolean;
  /** shard missions: this player holds no fragment this time */
  noFragment?: boolean;
  /** shard missions: the fragment only *this* player holds */
  myShard?: string;
  shardCount?: number;
  tally?: Record<string, number>;
  myVote?: string;
}

export interface PublicStage {
  id: string;
  title: string;
  story: string;
  threshold: number;
  state: "LOCKED" | "ACTIVE" | "COMPLETED";
  finished: number; // participants who finished this stage
  missions: PublicMission[]; // empty while locked
  missionCount: number;
}

export interface ExperienceView {
  id: string;
  title: string;
  tagline: string;
  description: string;
  theme: Theme;
  status: ExperienceStatus;
  currentStage: number;
  creatorName: string;
  creatorId: string;
  source: Experience["source"];
  streamUrl?: string;
  groupChannelId?: string;
  openChannelId?: string;
  chatEnabled: boolean;
  sandbox: boolean;
  startsAt?: number;
  run?: RunInfo;
  members: { userId: string; name: string; color: string; online: boolean; done: number; role?: string }[];
  stages: PublicStage[];
  joined: boolean;
  recent: GameEvent[];
  publishedAt?: number;
}

export interface ExperienceCard {
  id: string;
  title: string;
  tagline: string;
  theme: Theme;
  status: ExperienceStatus;
  creatorName: string;
  participants: number;
  stages: number;
  currentStage: number;
  source: Experience["source"];
}
