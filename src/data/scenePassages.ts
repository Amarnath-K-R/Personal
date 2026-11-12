export const scenePassages = {
  top: { name: 'About & me', line: 'The person behind the questions.', tone: '#2855ff', mask: 'iris' },
  work: { name: 'Projects', line: 'Nine questions. One connected practice.', tone: '#8791a2', mask: 'iris' },
  publications: { name: 'Research', line: 'Methods become a record.', tone: '#45c958', mask: 'shutter' },
  moments: { name: 'Highlights', line: 'Highlights from the journey.', tone: '#1f51ff', mask: 'ribbon' },
} as const;

export type SceneId = keyof typeof scenePassages;
export type SceneCoverMask = (typeof scenePassages)[SceneId]['mask'];
