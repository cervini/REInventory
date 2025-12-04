const adjectives = [
  "ancient", "brave", "calm", "divine", "eager", 
  "fierce", "green", "hollow", "iron", "jolly", 
  "keen", "lost", "misty", "neon", "odd", 
  "pale", "quiet", "royal", "silent", "twisted", 
  "unknown", "violet", "wild", "young", "zealous",
  "crimson", "dark", "frozen", "golden", "hidden",
];

const nouns = [
  "angel", "blade", "castle", "dragon", "eagle", 
  "flame", "ghost", "hammer", "island", "jewel", 
  "knight", "lion", "moon", "night", "owl", 
  "pearl", "queen", "raven", "star", "tower", 
  "unicorn", "viper", "wolf", "yeti", "zone",
  "forest", "gate", "haven", "ice", "jungle"
];

const verbs = [
  "walker", "hunter", "seeker", "keeper", "slayer", 
  "dancer", "dreamer", "weaver", "rider", "breaker",
  "caller", "finder", "guard", "maker", "watcher",
  "bearer", "bringer", "caster", "diver", "eater"
];

/**
 * Generates a human-readable string in the format "adjective-noun-verb".
 * Example: "ancient-red-dragon"
 */
export const generateJoinCode = () => {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const verb = verbs[Math.floor(Math.random() * verbs.length)];
  
  return `${adj}-${noun}-${verb}`;
};