/**
 * Site-wide microcopy. Short, warm and literal; no dashes, no hype.
 * Story facts belong in the content modules, not here.
 */
export const siteCopy = {
  brand: {
    name: "The Aspirants",
    wordmark: "THE ASPIRANTS",
    series: "Aspirant",
    tagline: "Someone is always waiting.",
    description:
      "A fan archive of Aspirant, a story set in an alternate universe of Mobile Legends: Bang Bang. Ten Aspirants, one academy, and the whole story, told by scrolling.",
  },

  loader: {
    line: "Someone is always waiting.",
    enter: "Enter the archive",
    skip: "Skip",
    loading: "Loading",
    ready: "Ready",
  },

  nav: {
    home: "Home",
    experience: "Experience",
    story: "Story",
    characters: "Characters",
    collection: "Collection",
    menu: "Menu",
    close: "Close menu",
    label: "Main",
  },

  controls: {
    skipToContent: "Skip to content",
    soundOn: "Sound on",
    soundOff: "Sound off",
    reduceMotion: "Reduce motion",
    fullMotion: "Full motion",
    play: "Play",
    pause: "Pause",
    stop: "Stop",
    next: "Next",
    previous: "Previous",
    open: "Open",
    close: "Close",
    backToTop: "Back to top",
    playVoice: "Play voice line",
    readInStory: "Read it in the story",
    keyboardNext: "Press N for next",
    keyboardMute: "Press M to mute",
  },

  footer: {
    lampOn: "The lamp is on.",
    next: "Next",
    nextHint: "Keep scrolling, or press N.",
    fanNotice:
      "A fan project. Not affiliated with or endorsed by Moonton. Mobile Legends: Bang Bang and its characters belong to their owners.",
    credits:
      "The story, art and audio belong to their creators. Fan art is shown with the artist's name and a link to the original.",
    removal: "If you made something shown here and want it taken down, tell us and it will go.",
  },

  notFound: {
    eyebrow: "Archive terminal",
    title: "This page is not in the archive.",
    body: "The link may be old, or the page may have moved. The lamp is still on at home.",
    action: "Back to home",
  },

  badges: {
    nonCanon: "Non-canon parody",
    notHosted: "Not hosted",
    notSpecified: "Not specified",
    later: "Later in the story",
    new: "New",
  },

  spoilers: {
    warning: "This part tells you what happens later in the story.",
    reveal: "Show what happens later",
    hide: "Hide it again",
  },

  home: {
    whatIs: "What is Aspirant",
    versus: "Off track, on track",
    beforeAfter: {
      before: "A peaceful world.",
      after: "A world that was weighed.",
      link: "See what changed",
    },
    theTen: "The ten",
    hallOfFame: "Hall of fame",
    doors: {
      experience: "Read the whole story",
      collection: "Open the collection",
    },
  },

  experience: {
    title: "The story",
    part: "Part",
    chapter: "Chapter",
    interlude: "Interlude",
    chapters: "Chapters",
    resume: "Resume where you left off",
    startOver: "Start from the beginning",
    loadingPart: "Loading the next part",
    theEnd: "The end, for now.",
  },

  story: {
    title: "The world",
    whereYouAre: "Where you are",
    beforeAndAfter: "Before and after",
    cycle: "The Cycle",
    hierarchy: "Who sends the Enders",
    couplingLab: "Aspirant power lab",
    couplingHint: "Bring the two crystals together.",
    timeOrder: "The story in time order",
    openQuestions: "What the story leaves open",
    openHint: "Tap to unseal. The story does not answer.",
    wordsToKnow: "Words to know",
    whoIsWho: "Who is who",
    searchGlossary: "Search the glossary",
  },

  character: {
    roster: "The ten",
    filters: {
      all: "All",
      byPair: "By pair",
      daybreak: "Daybreak",
      storm: "Storm",
    },
    stats: {
      age: "Age",
      birthday: "Birthday",
      mbti: "MBTI",
      role: "Role",
      weapon: "Weapon",
      partner: "Partner",
      noPartner: "None",
    },
    ageNote: "Ages are as at the Academy's first winter.",
    sections: {
      personality: "Personality",
      appearance: "Appearance",
      fighting: "Fighting style",
      background: "Background",
      motivation: "Motivation",
      flaws: "Flaws",
      relationships: "Relationships",
      forms: "Forms",
      voice: "Voice lines",
      media: "Media",
      inStory: "In the story",
      later: "Later in the story",
    },
    forms: {
      normal: "Aspirant form",
      ender: "Ender form",
    },
    voiceNote: "Japanese audio, with English translations.",
    nextInQueue: "Next in the queue",
  },

  collection: {
    title: "Collection",
    filters: {
      all: "All",
      films: "Films",
      music: "Music",
      comics: "Comics",
      art: "Art",
      fanArt: "Fan art",
      models: "3D",
      voice: "Voice",
    },
    searchVoice: "Search voice lines by character or text",
    empty: "Nothing here yet.",
    artBy: "Art by",
    viewOriginal: "View the original",
  },

  meta: {
    home: "Ten Aspirants, one academy, and a world that keeps a lamp lit.",
    experience: "The whole story of Aspirant, told by scrolling, in twelve parts.",
    story: "Where the story happens, who sends the Enders, and what the story leaves open.",
    characters: "Meet the ten Aspirants of Selrick Academy.",
    collection: "Films, music, comics, art, fan art and every voice line.",
  },
} as const;

export type SiteCopy = typeof siteCopy;
