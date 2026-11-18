import type { Region } from '@/types';

/** 架空の自治体「みなと野市」の地区（SVG 座標 1000 x 680） */
export const CITY_NAME = 'みなと野市';

export const REGIONS: Region[] = [
  {
    id: 'R01',
    name: '山手地区',
    hazard: 'landslide',
    polygon: [[40, 40], [330, 40], [310, 250], [40, 270]],
    labelAt: [175, 150],
  },
  {
    id: 'R02',
    name: '北町',
    hazard: 'none',
    polygon: [[330, 40], [660, 40], [640, 230], [310, 250]],
    labelAt: [485, 140],
  },
  {
    id: 'R03',
    name: '東台',
    hazard: 'none',
    polygon: [[660, 40], [960, 60], [950, 300], [640, 230]],
    labelAt: [805, 160],
  },
  {
    id: 'R04',
    name: '西浜',
    hazard: 'none',
    polygon: [[40, 270], [310, 250], [300, 470], [40, 480]],
    labelAt: [170, 370],
  },
  {
    id: 'R05',
    name: '中央地区',
    hazard: 'none',
    polygon: [[310, 250], [640, 230], [620, 450], [300, 470]],
    labelAt: [465, 355],
  },
  {
    id: 'R06',
    name: '川辺地区',
    hazard: 'flood',
    polygon: [[640, 230], [950, 300], [940, 480], [620, 450]],
    labelAt: [790, 375],
  },
  {
    id: 'R07',
    name: '南が丘',
    hazard: 'none',
    polygon: [[40, 480], [300, 470], [450, 640], [60, 640]],
    labelAt: [205, 570],
  },
  {
    id: 'R08',
    name: '新田地区',
    hazard: 'flood',
    polygon: [[300, 470], [620, 450], [940, 480], [930, 640], [450, 640]],
    labelAt: [690, 560],
  },
];

export const REGION_BY_ID: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

export const regionName = (id: string) => REGION_BY_ID[id]?.name ?? id;
