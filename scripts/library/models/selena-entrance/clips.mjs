// The fourteen clips of the Entrance view: the room's id (scripts/library/models/entries.json),
// the bone action of the owner's file and its camera action. `city_action` is left out on
// purpose (the owner's call). The source spells three of them `intercation`.
export const PREFIX = "selena_silverbolt_raiko_entrance_";

export const CLIPS = [
  { id: "idle", action: "city_idle", camera: "cam_city_idle", loop: true },
  { id: "idle-standing", action: "city_idle_BP", camera: "cam_city_idle_BP", loop: true },
  { id: "phone-in", action: "city_intercation_in", camera: "cam_city_intercation_in" },
  { id: "phone-loop", action: "city_intercation04", camera: "cam_city_intercation04", loop: true },
  { id: "phone-out", action: "city_intercation_out", camera: "cam_city_intercation_out" },
  { id: "interaction-l-in", action: "city_interaction_L", camera: "cam_city_interaction_L" },
  {
    id: "interaction-l-loop",
    action: "city_interaction_L_loop",
    camera: "cam_city_interaction_L_loop",
    loop: true,
  },
  {
    id: "interaction-l-out",
    action: "city_interaction_back_L",
    camera: "cam_city_interaction_back_L",
  },
  { id: "interaction-r-in", action: "city_interaction_R", camera: "cam_city_interaction_R_" },
  {
    id: "interaction-r-loop",
    action: "city_interaction_R_loop",
    camera: "cam_city_interaction_R_loop",
    loop: true,
  },
  {
    id: "interaction-r-out",
    action: "city_interaction_back_R",
    camera: "cam_city_interaction_back_R",
  },
  { id: "interaction-1", action: "city_intercation01", camera: "cam_city_intercation01" },
  { id: "interaction-2", action: "city_intercation02", camera: "cam_city_intercation02" },
  { id: "interaction-3", action: "city_intercation03", camera: "cam_city_intercation03" },
];

export const DROPPED_CLIPS = ["city_action"];
