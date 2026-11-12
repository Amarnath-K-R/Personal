export const areas = {
  imaging: { label: 'Imaging', color: 'var(--blue)', hex: '#5a708c' },
  omics: { label: 'Omics', color: 'var(--green)', hex: '#6b7447' },
  clinical: { label: 'Clinical software', color: 'var(--rust)', hex: '#b45d42' },
  trust: { label: 'Trust & safety', color: 'var(--plum)', hex: '#77596f' },
} as const;

export const profile = {
  name: 'Amarnath K R',
  photo: '/manus-storage/AMARNATH_7829df70.jpg', // the portrait; the one image besides each highlight's main photo that Google Images may show
  emailAmrita: 'kr_amarnath@cb.amrita.edu',
  emailStanford: 'amkr@stanford.edu',
  bio: 'Computational scientist in biomedical AI. I work with Dr Michael P Snyder in the Department of Genetics at Stanford University, and I co authored a 2026 paper in Cell. At Amrita Institute of Medical Sciences, I build deep learning systems and clinical software for retinal imaging and hospital data.',
  now: 'Research Associate, Department of Ophthalmology, Amrita Institute of Medical Sciences, Kochi',
  with: 'Dr Michael P Snyder, Department of Genetics, Stanford University',
  studying: 'B.Tech in Computer Science, Amrita Engineering College, Amritapuri. 2022 to present',
  coordinates: '9.9312° N, 76.2673° E',
} as const;

// Destinations and researcher identifiers supplied in the user's résumé.
export const profileLinks = {
  stanford: 'https://profiles.stanford.edu/amarnath-k-r',
  linkedin: 'https://www.linkedin.com/in/amarnath-k-r',
  orcid: 'https://orcid.org/0009-0002-8044-8552',
  scopus: 'https://www.scopus.com/authid/detail.uri?authorId=59938215100',
  researchgate: 'https://www.researchgate.net/profile/Amarnath-K-R',
} as const;

// Public posts about Amarnath. Linked from the footer and listed in the page's structured data.
export const profilePosts = {
  facebook: 'https://www.facebook.com/AmritaComputerScience/posts/global-research-achievement-school-of-computing-amrita-vishwa-vidyapeethamcongra/1410653850871184/',
  instagram: 'https://www.instagram.com/p/DZEXdevj-Ec/',
} as const;

export const beliefs = [
  {
    title: 'Show where it looked',
    sentence: 'A model should always show where it looked, so a clinician can judge whether it makes sense.',
    slug: 'ckd-from-fundus',
  },
  {
    title: 'Assist, never replace',
    sentence: 'It must assist the doctor, and never replace the doctor.',
    slug: 'iksha',
  },
  {
    title: 'Report it plainly',
    sentence: 'When results fall short, the paper says so, in plain words.',
    slug: 'cad-preprocessing',
  },
  {
    title: 'Keep data home',
    sentence: 'Patient data never leaves the hospital machine.',
    slug: 'aidpulse',
  },
] as const;

// The About film's opening figures. Aggregate, sourced, never an individual's story.
export const filmFacts = [
  {
    value: '27%',
    line: 'of India’s doctors work in rural areas, where 66% of Indians live.',
    source: 'Karan et al., Human Resources for Health, 2021',
    url: 'https://doi.org/10.1186/s12960-021-00575-2',
  },
  {
    value: '1 in 5',
    line: 'Rural community health centres have about one in five of the specialists they need.',
    source: 'MoHFW, Health Dynamics of India 2022–23 (79.9% shortfall), reported by ThePrint',
    url: 'https://theprint.in/health/rural-india-has-an-80-shortfall-of-specialist-doctors-mp-gujarat-tamil-nadu-worst-off/2259874',
  },
  {
    value: '33 : 20',
    line: 'Children dying before five, per 1,000 born: 33 in rural India, 20 in its cities.',
    source: 'Registrar General of India, SRS Statistical Report 2023',
    url: 'https://censusindia.gov.in/nada/index.php/catalog/46172',
  },
] as const;

export const filmHope = {
  line: 'Rural infant deaths fell from 44 to 28 per 1,000 in a decade.',
  close: 'The distance can be closed.',
  source: 'Registrar General of India, SRS 2013 and 2023',
  url: 'https://censusindia.gov.in/nada/index.php/catalog/46172',
};


export const moteLines = [
  'A model should always show where it looked.',
  'It must assist the doctor, and never replace the doctor.',
  'Behind each photograph there is a person and a family.',
  'Your idea here? Write to me.',
  'Every held out test, scored once.',
  'Patient data never leaves the machine.',
] as const;

export type Publication = {
  title: string;
  role: string;
  status: string;
  detail: string;
  doi?: string;
  group: 'Published' | 'Accepted' | 'Under revision' | 'Submitted and in preparation';
};

export const publications: Publication[] = [
  {
    title: 'A Comparison of Deep Multiomics Profiles across Ethnicity, Geography, and Age',
    role: 'Co author',
    status: 'Published, Cell 2026',
    detail: 'Cell 189(10), 3004 to 3024. PubMed 42134306. Senior author Dr Michael P Snyder.',
    doi: '10.1016/j.cell.2026.04.032',
    group: 'Published',
  },
  {
    title: 'SE-Conformer for Breast Cancer Detection in Histopathology Images',
    role: 'Second author',
    status: 'Published, IEEE Access 2025',
    detail: 'With Lekha S Nair, Vice Chairperson, Amrita School of Computing.',
    doi: '10.1109/ACCESS.2025.3576825',
    group: 'Published',
  },
  {
    title: 'SEViT-GAN. Attention GAN for image inpainting',
    role: 'First author',
    status: 'Springer, LNNS 1786, 2026',
    detail: 'Presented at ICICV 2025, Italy.',
    doi: '10.1007/978-3-032-14757-8_44',
    group: 'Published',
  },
  {
    title: 'SpectroTemporal Attention Networks. Insect classification from sound',
    role: 'First author',
    status: 'Springer, LNNS 1748, 2026',
    detail: '',
    doi: '10.1007/978-3-032-12990-1_9',
    group: 'Published',
  },
  {
    title: 'AidPulse: Local Clinical Decision Support Across Five Departments',
    role: 'First author',
    status: 'Accepted, JMIR Medical Informatics',
    detail: '',
    group: 'Accepted',
  },
  {
    title: 'Safety by Design and the Grok Imagine Sexual Deepfake Crisis',
    role: 'Corresponding author',
    status: 'Accepted, AI and Ethics',
    detail: 'Co authored with Nived S Nambiar.',
    group: 'Accepted',
  },
  {
    title: 'CKD Detection from Fundus Photographs with RETFound',
    role: 'Second author',
    status: 'Under revision, PLOS Digital Health',
    detail: '',
    group: 'Under revision',
  },
  {
    title: 'Preprocessing and Augmentation for CAD Detection',
    role: 'First author',
    status: 'Under revision, Scientific Reports',
    detail: '',
    group: 'Under revision',
  },
  {
    title: 'From Physician to Prompt: GPT for Emergency Department Notes',
    role: 'First author',
    status: 'Prepared for JMIR AI',
    detail: 'With Dr Ekanath Rangan, Stanford School of Medicine.',
    group: 'Submitted and in preparation',
  },
  {
    title: 'CordDB. Analytics web application for doctors',
    role: '',
    status: 'Submitted to a Cell Press journal',
    detail: 'With AIMS and Stanford.',
    group: 'Submitted and in preparation',
  },
  {
    title: 'Bridge users and echo chambers. Graph neural networks',
    role: '',
    status: 'To be published in AICCSP 2026 proceedings',
    detail: '',
    group: 'Submitted and in preparation',
  },
];

export const publicationGroups = [
  { label: 'All', count: 11, key: 'all' },
  { label: 'Published', count: 4, key: 'Published' },
  { label: 'Accepted', count: 2, key: 'Accepted' },
  { label: 'Under revision', count: 2, key: 'Under revision' },
  { label: 'Submitted and in preparation', count: 3, key: 'Submitted and in preparation' },
] as const;

