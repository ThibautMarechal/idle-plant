/**
 * Icônes dessinées. Le code du jeu continue d'écrire des émojis dans ses textes ; ce module les remplace
 * à l'affichage par de petits dessins au trait, dans le style bande dessinée du reste du jeu.
 * Les espèces ont chacune leur portrait, rendu une fois à partir de leur modèle 3D.
 */
import * as THREE from 'three';
import { FAMILIES, SPECIES } from './data';
import { buildPlant, buildPot, POT_TOP } from './plants3d';
import { finish } from './styles';

const INK = '#3b2a20';
const svg = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${inner}</svg>`;

const heart = (c: string) => `<path d="M12 20.5C5 15.5 3 12 3 8.5A4.5 4.5 0 0 1 12 6.5 4.5 4.5 0 0 1 21 8.5c0 3.5-2 7-9 12z" fill="${c}"/>`;
const star = (c: string) => `<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="${c}"/>`;
const medal = (c: string) => `<path d="M8 2.5l4 7 4-7z" fill="#e2574c"/><circle cx="12" cy="15" r="6" fill="${c}"/><circle cx="12" cy="15" r="3" stroke-width="1"/>`;
const flower = (c: string, heartColor = '#f8cf45') => `<g fill="${c}"><circle cx="12" cy="6.5" r="3.8"/><circle cx="17.2" cy="10.3" r="3.8"/><circle cx="15.2" cy="16.5" r="3.8"/><circle cx="8.8" cy="16.5" r="3.8"/><circle cx="6.8" cy="10.3" r="3.8"/></g><circle cx="12" cy="12" r="3" fill="${heartColor}"/>`;
const leaf = (c: string) => `<path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16z" fill="${c}"/><path d="M4 20L15 9M9 15v-4.5M9 15h4.5" stroke-width="1.1"/>`;
const hand = (c: string) => `<path d="M7.5 13V6.5a1.5 1.5 0 0 1 3 0V4.5a1.5 1.5 0 0 1 3 0v2a1.5 1.5 0 0 1 3 0V13l1.6-2.2a1.5 1.5 0 0 1 2.5 1.7L17.5 19c-1 2-3 3-5.5 3-4 0-6-2.5-6-6v-5.500a1 1 0 0 1 1.5-.9z" fill="${c}"/><path d="M10.5 6.5V12M13.5 6.500V12" stroke-width="1"/>`;
const speaker = '<path d="M3 9.500h4l5-4.500v14l-5-4.500H3z" fill="#f4ead2"/>';

const ICONS: Record<string, string> = {
  coin: '<circle cx="12" cy="12" r="9" fill="#f6c443"/><circle cx="12" cy="12" r="5.5" fill="#fbe08a" stroke-width="1"/>',
  pot: '<path d="M6.5 10h11L16 20.500H8z" fill="#c96f48"/><path d="M5 5.500h14l-1 4.500H6z" fill="#de8a62"/>',
  clay: '<path d="M3 16c0-4 3-8 9-8s9 4 9 8c0 3-4 4.5-9 4.500S3 19 3 16z" fill="#b98a6a"/><path d="M8 13c1-1 3-1.5 5-1M15 16.500c1 0 2-.5 2.5-1.5" stroke-width="1"/>',
  drop: '<path d="M12 3c3.5 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 2.5-6.5 6-11z" fill="#6fc3ea"/><path d="M9.5 14.500a2.5 2.5 0 0 0 2 2.5" stroke="#fff" stroke-width="1.3"/>',
  gem: '<path d="M7 4h10l4 5-9 11L3 9z" fill="#7fd6e8"/><path d="M3 9h18M9 9l3 11 3-11M7 4l2 5M17 4l-2 5" stroke-width="1"/>',
  star: star('#f8cf45'),
  staro: star('#efe6d2'),
  sparkle: '<path d="M11 3c1 5 3 7 8 8-5 1-7 3-8 9-1-6-3-8-8-9 5-1 7-3 8-8z" fill="#fbe08a"/><path d="M19 3v4M17 5h4" stroke="#f2a93b"/>',
  gift: '<rect x="4" y="10.5" width="16" height="10" rx="1" fill="#ee8f7b"/><rect x="3" y="6.5" width="18" height="4" rx="1" fill="#f3a896"/><path d="M12 6.500v14"/><path d="M12 6.500c-2-4-6-3-4.5-.5 1 1.2 3 .5 4.5.500zm0 0c2-4 6-3 4.5-.5-1 1.2-3 .5-4.5.500z" fill="#f6c443"/>',
  box: '<path d="M3 8l9-4 9 4v9l-9 4-9-4z" fill="#d9b382"/><path d="M3 8l9 4 9-4M12 12v9"/>',
  basket: '<path d="M4 11h16l-2 9.500H6z" fill="#d6a868"/><path d="M7 11c0-8 10-8 10 0"/><path d="M9 11.500v8.500M12 11.500v8.500M15 11.500v8.5" stroke-width="1"/>',
  cart: '<path d="M2.5 4H5l2.5 11h10.5"/><path d="M6 7.500h14.500l-2 7.500H7.700z" fill="#f3a896"/><circle cx="9.5" cy="19" r="1.7" fill="#fff"/><circle cx="17" cy="19" r="1.7" fill="#fff"/>',
  book: '<path d="M3 5c3-1.5 6-1.5 9 0v15c-3-1.5-6-1.5-9 0z" fill="#f4ead2"/><path d="M21 5c-3-1.5-6-1.5-9 0v15c3-1.5 6-1.5 9 0z" fill="#f4ead2"/><path d="M6 9h3M6 12h3M15 9h3M15 12h3" stroke-width="1"/>',
  cap: '<path d="M6 11.500V16c3 3 9 3 12 0v-4.5" fill="#6f80a3"/><path d="M2 9l10-5 10 5-10 5z" fill="#5a6b8c"/><path d="M21 9.500V15"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c2 0 2-1.5 1.5-2.5-.8-1.6.500-2.5 2-2.500H18a3 3 0 0 0 3-3c0-5.5-4-10-9-10z" fill="#ecd2a2"/><circle cx="7.5" cy="12" r="1.4" fill="#e2574c" stroke-width="1"/><circle cx="9.5" cy="7.5" r="1.4" fill="#f6c443" stroke-width="1"/><circle cx="14.5" cy="7" r="1.4" fill="#5aa9e6" stroke-width="1"/><circle cx="17.5" cy="11" r="1.4" fill="#6fbf6a" stroke-width="1"/>',
  flask: '<path d="M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" fill="#eaf6f4"/><path d="M7.6 15h8.800l1.8 3.300a1 1 0 0 1-1 1.500H6.800a1 1 0 0 1-1-1.500z" fill="#8fd18a" stroke-width="1"/><path d="M9 3h6"/>',
  dna: '<path d="M7 3c0 6 10 6 10 12s-10 3-10 6" stroke="#5aa9e6" stroke-width="2"/><path d="M17 3c0 6-10 6-10 12s10 3 10 6" stroke="#e2574c" stroke-width="2"/><path d="M9 6h6M9.5 9.500h5M9.5 14.500h5M9 18h6" stroke-width="1"/>',
  chart: '<rect x="3" y="3" width="18" height="18" rx="2" fill="#f4ead2"/><path d="M6 16l4-4 3 2.5 5-6.5" stroke="#3f9d6b" stroke-width="2.2"/>',
  lock: '<path d="M8 10.500V8a4 4 0 0 1 8 0v2.5"/><rect x="5" y="10.5" width="14" height="10" rx="2" fill="#f6c443"/><circle cx="12" cy="15.5" r="1.2" fill="#3b2a20"/>',
  flame: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-2.5 1-4 2.5-5.5 0 2 1 3 2 3C10 8 10.5 5 12 2z" fill="#f28c38"/><path d="M12 19.500a3 3 0 0 1-3-3c0-1.5 1.5-2.5 3-4.5 1.5 2 3 3 3 4.500a3 3 0 0 1-3 3z" fill="#f8cf45" stroke-width="1"/>',
  boot: '<path d="M8 3h6v9c0 1.5 5 1.5 6 4.500V20H5v-3c2-1.5 3-3 3-5z" fill="#b07a4f"/><path d="M5 17.500h15"/><path d="M11 6.500h3M11 9.500h3" stroke-width="1"/>',
  scissors: '<path d="M8.5 15.500L17 3M15.5 15.500L7 3"/><circle cx="6.5" cy="17.5" r="3" fill="#ee8f7b"/><circle cx="17.5" cy="17.5" r="3" fill="#ee8f7b"/>',
  bug: '<circle cx="5.5" cy="15" r="3.2" fill="#9bd05a"/><circle cx="10.5" cy="13.5" r="3.2" fill="#8cc44e"/><circle cx="15.5" cy="15" r="3.2" fill="#9bd05a"/><path d="M19 7.500l-1-3M21 8l1.5-2.5" stroke-width="1.2"/><circle cx="19.5" cy="11" r="3.2" fill="#b4de6e"/><circle cx="20.4" cy="10.6" r=".7" fill="#3b2a20" stroke="none"/>',
  museum: '<path d="M3 9l9-6 9 6z" fill="#f4ead2"/><path d="M5.5 9v9M10 9v9M14 9v9M18.5 9v9" stroke-width="2"/><rect x="3" y="18" width="18" height="3" fill="#e2d3b0"/>',
  door: '<path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16z" fill="#b98a5a"/><circle cx="15" cy="12.5" r="1" fill="#f6c443" stroke-width="1"/><path d="M4 21h16"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5" fill="#d8f0f7"/><path d="M15.5 15.500L21 21" stroke-width="2.6"/>',
  can: '<path d="M14 11l6.5-5M19 4.500l3 3"/><path d="M5.5 9.500C1.5 10 1.5 16 5.5 16.5"/><path d="M5.5 8.500h9v11.500h-9z" fill="#7fb7d6"/>',
  check: '<circle cx="12" cy="12" r="9.5" fill="#6fbf6a"/><path d="M7.5 12.500l3 3 6-7" stroke="#fff" stroke-width="2.3"/>',
  people: '<circle cx="16.5" cy="9" r="2.6" fill="#f3c9a0"/><path d="M12 20c0-4 1.5-6.5 4.5-6.500S21 16 21 20z" fill="#ee8f7b"/><circle cx="8.5" cy="8" r="3" fill="#f3c9a0"/><path d="M3 20c0-4 2.5-6.5 5.5-6.500S14 16 14 20z" fill="#7fb7d6"/>',
  swirl: '<path d="M12 12c0-1.5 2-1.5 2 0 0 2.5-4 2.5-4-.5 0-4 7-4 7 .5 0 5.5-10 5.5-10-.5 0-7 13-7 13 .5" stroke="#5aa9e6" stroke-width="2.2"/>',
  hand: hand('#f3c9a0'),
  glove: hand('#8fc45a'),
  house: '<path d="M3 11l9-7 9 7v9.500H3z" fill="#d8f0f7"/><path d="M3 11h18M12 4v16.500M7.5 11v9.500M16.5 11v9.5" stroke-width="1"/>',
  planet: '<circle cx="12" cy="12" r="9" fill="#6fc3ea"/><path d="M6 8c2-2 5-1 5 1s-2 2-2 4-3 1-4-1zM14 13c2-1 5 0 4.5 2.500S15 19 14 17z" fill="#7fc96b" stroke-width="1"/>',
  lantern: '<path d="M9 5h6M12 2v3M9 20.500h6"/><rect x="7.5" y="6" width="9" height="12.5" rx="3" fill="#f8cf45"/><path d="M12 9.500c1.5 2 1.5 3.5 0 5-1.5-1.5-1.5-3 0-5z" fill="#f28c38" stroke-width="1"/>',
  gold: medal('#f8cf45'),
  silver: medal('#d9dee3'),
  bronze: medal('#d99a62'),
  question: '<circle cx="12" cy="12" r="9.5" fill="#efe6d2"/><path d="M9 9.500a3 3 0 1 1 4.5 2.600c-1 .6-1.5 1.2-1.5 2.4"/><circle cx="12" cy="17.5" r=".9" fill="#3b2a20" stroke="none"/>',
  sound: speaker + '<path d="M15.5 9a4 4 0 0 1 0 6M18 6.500a7.5 7.5 0 0 1 0 11"/>',
  mute: speaker + '<path d="M16 9.500l5 5M21 9.500l-5 5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2" fill="#f4ead2"/><path d="M3.5 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v2.500h-17z" fill="#e2574c"/><path d="M8 3v3.500M16 3v3.5"/><path d="M8 13.500h2M14 13.500h2M8 17h2" stroke-width="1.8"/>',
  sponge: '<rect x="3.5" y="8" width="17" height="10" rx="3" fill="#f8cf45"/><path d="M8 12v.1M13 14.500v.1M16.5 11.500v.1" stroke-width="2"/>',
  down: '<path d="M12 4v14M6 12.500l6 6 6-6" stroke-width="2.6"/>',
  target: '<circle cx="12" cy="12" r="9.5" fill="#fff"/><circle cx="12" cy="12" r="6" fill="#e2574c"/><circle cx="12" cy="12" r="2.5" fill="#fff"/>',
  fog: '<path d="M4 8h13M7 12h14M3 16h12M10 20h9" stroke="#8fa6b0" stroke-width="2.2"/>',
  bulb: '<path d="M12 2.500a6.5 6.5 0 0 0-4 11.600c.7.6 1 1.4 1 2.400h6c0-1 .3-1.8 1-2.400A6.5 6.5 0 0 0 12 2.500z" fill="#f8cf45"/><path d="M9.5 19.500h5M10.5 22h3"/>',
  heat: '<path d="M8 3c-2 3 2 4.5 0 8.500M12 3c-2 3 2 4.5 0 8.500M16 3c-2 3 2 4.5 0 8.5" stroke="#e2574c" stroke-width="2"/><path d="M4 15.500c0 5 16 5 16 0z" fill="#f4ead2"/>',
  sleep: '<path d="M4 5h7l-7 8h7M14 12h6l-6 7h6" stroke="#6f80a3" stroke-width="2"/>',
  sun: '<path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/><circle cx="12" cy="12" r="4.8" fill="#f8cf45"/>',
  thermo: '<path d="M10 4a2 2 0 0 1 4 0v9.500a4.5 4.5 0 1 1-4 0z" fill="#fff"/><circle cx="12" cy="17" r="2.4" fill="#e2574c" stroke="none"/><path d="M12 16V8" stroke="#e2574c" stroke-width="2"/>',
  warn: '<path d="M12 3l10 17.500H2z" fill="#f8cf45"/><path d="M12 9.500v5"/><circle cx="12" cy="17.5" r=".9" fill="#3b2a20" stroke="none"/>',
  moon: '<path d="M19.5 14.500A8.5 8.5 0 0 1 9.5 4.500a8.5 8.5 0 1 0 10 10z" fill="#8f97b8"/>',
  snow: '<path d="M12 2v20M3.5 7l17 10M3.5 17l17-10M9.5 3.500L12 6l2.5-2.500M9.5 20.500L12 18l2.5 2.5" stroke="#5db4de" stroke-width="1.8"/>',
  mushroom: '<path d="M9.500 13h5l.800 7.500h-6.600z" fill="#f4ecd8" stroke="#2b2118" stroke-width="1.4" stroke-linejoin="round"/><path d="M3 13.500C3 8 7 4 12 4s9 4 9 9.500z" fill="#d9503f" stroke="#2b2118" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8.500" cy="9" r="1.300" fill="#fff"/><circle cx="14" cy="7.500" r="1.100" fill="#fff"/><circle cx="16.500" cy="11" r="1.200" fill="#fff"/>',
  volcano: '<path d="M2.5 21L9 8h6l6.5 13z" fill="#7a6a66"/><path d="M9 8l1.500 3 1.500-2 1.500 2.500L15 8z" fill="#f0703a"/><path d="M12 5.500V2.500M8.500 5L7 3M15.500 5L17 3" stroke="#f0703a" stroke-width="1.6"/>',
  peak: '<path d="M2 20.500L9.500 5l4 7 2.500-3.500 6 12z" fill="#9fb4c4"/><path d="M9.500 5L7 10.200l2.500-1.200 1.500 1.500 1.300-1.500z" fill="#fff"/>',
  knife: '<path d="M4 20l9-9" stroke-width="3.2"/><path d="M4 20l9-9" stroke="#8a5f3c" stroke-width="1.4"/><path d="M12 12L20 3.500c1 3-1 8-5.500 11.5z" fill="#cfd8dc"/>',
  pick: '<path d="M8 21L15.500 7" stroke-width="3.2"/><path d="M8 21L15.500 7" stroke="#b07a4f" stroke-width="1.4"/><path d="M5.500 7.500C9 3.500 16 2.500 21 5c-4 0-9 1-13.500 4.500z" fill="#9fb4c4"/>',
  compass: '<circle cx="12" cy="12" r="9" fill="#f4ead2"/><path d="M12 5.500l2.200 6.500L12 18.500 9.800 12z" fill="#e2574c"/><path d="M12 12l2.200 0L12 18.500 9.800 12z" fill="#fff"/><circle cx="12" cy="12" r="1" fill="#3b2a20"/>',
  soil: '<path d="M3 13c2-4 16-4 18 0l-1.500 7h-15z" fill="#8a5f3c"/><path d="M5 13c3 2 11 2 14 0" stroke-width="1.2"/><circle cx="9" cy="16.500" r=".9" fill="#3b2a20"/><circle cx="14" cy="17" r=".9" fill="#3b2a20"/><path d="M12 11V5.500M12 8c-2-2-4-1.500-4.500 0 1.500 1 3 1 4.500 0zM12 7c2-2.500 4-2 4.500-.5-1.500 1-3 1-4.500.5z" fill="#6fbf6a"/>',
  pine: '<path d="M12 15v6.5" stroke-width="3"/><path d="M12 2l5 7h-2.500l4.5 6.500H5L9.5 9H7z" fill="#4f9d69"/>',
  lotus: '<path d="M3 17.500c3 3 15 3 18 0" stroke="#3f9d6b" stroke-width="2.2"/><path d="M4 9c4 0 7 3 8 7.5-4 0-8-2.5-8-7.500zM20 9c-4 0-7 3-8 7.5 4 0 8-2.5 8-7.500z" fill="#f7c2d6"/><path d="M12 5c3 3 3 8.5 0 11.5-3-3-3-8.5 0-11.500z" fill="#f3a8c4"/>',
  dunes: '<circle cx="17" cy="7" r="3.2" fill="#f8cf45"/><path d="M2 19.500c4-6.5 8-6.5 11-2 2-3 6-3 9 2z" fill="#ecd08f"/>',
  cactus: '<path d="M9.5 14H7a2 2 0 0 1-2-2V9.500M14.5 12H17a2 2 0 0 0 2-2V8" stroke-width="4.2"/><path d="M9.5 14H7a2 2 0 0 1-2-2V9.500M14.5 12H17a2 2 0 0 0 2-2V8" stroke-width="1.6" stroke="#6fbf8f"/><path d="M9.5 21V6a2.5 2.5 0 0 1 5 0v15z" fill="#6fbf8f"/><path d="M12 7v1M12 12v1M12 17v1" stroke-width="1"/>',
  herb: '<path d="M12 21.500V6"/><path d="M12 9C9 9 7 7 7 4c3 0 5 2 5 5zM12 9c3 0 5-2 5-5-3 0-5 2-5 5zM12 15.500c-3.5 0-6-2-6-5 3.5 0 6 2 6 5zM12 15.500c3.5 0 6-2 6-5-3.5 0-6 2-6 5z" fill="#8fc45a"/>',
  fern: leaf('#3f9d6b'),
  autumn: leaf('#e08a3c'),
  orchid: flower('#e29adb', '#fbe08a'),
  flower: flower('#fff3d6', '#f2a93b'),
  bouquet: flower('#f3a8c4'),
  palm: '<path d="M11 21.500c.5-5 .5-8 1.5-12.5" stroke-width="3.6"/><path d="M11 21.500c.5-5 .5-8 1.5-12.5" stroke-width="1.3" stroke="#b07a4f"/><path d="M12.5 9C10 5 6 4 3 6c3 0 6 1 9.5 3zM12.5 9c2-4 6-5.5 9-4-3 .5-6 1.5-9 4zM12.5 9c-3-1-7 0-8.5 4.5 3-2.5 5-3.5 8.5-4.500zM12.5 9c3-1 7 .5 8 4.5-2.5-2.5-5-3.5-8-4.500z" fill="#2f9e7a"/>',
  flytrap: '<path d="M12 21.500v-7" stroke="#3f9d6b" stroke-width="2.4"/><path d="M12 14.500C6 14.5 4 9.5 5 5l3 2.5 1-3.5 3 3 3-3 1 3.500L19 5c1 4.5-1 9.5-7 9.500z" fill="#c0504d"/>',
  tree: '<path d="M12 21.500v-7" stroke-width="3"/><path d="M12 3a5 5 0 0 1 4.8 3.600A4.5 4.5 0 0 1 16 15.500H8a4.5 4.5 0 0 1-.8-8.900A5 5 0 0 1 12 3z" fill="#7a9a4a"/>',
  sprout: '<path d="M12 21.500v-9.5"/><path d="M12 12.500C12 8.5 9 6.5 5 6.500c0 4 3 6 7 6zM12 10.500c0-4 3-6 7-6 0 4-3 6-7 6z" fill="#8fd16a"/>',
  seed: '<path d="M12 4c5 3 7 7 6 11-1 3-3 5-6 5s-5-2-6-5c-1-4 1-8 6-11z" fill="#b07a4f"/><path d="M10 9c-1.5 2-2 4-1.5 6" stroke="#e2b98a" stroke-width="1.2"/>',
  hgreen: heart('#6fbf6a'),
  hgold: heart('#f8cf45'),
  hwhite: heart('#fff'),
};

/** Émoji écrit dans les textes du jeu → dessin. Les séquences sont notées sans sélecteur de variante. */
const OF: Record<string, string> = {
  '🪙': 'coin', '🏺': 'pot', '🧱': 'clay', '💧': 'drop', '💦': 'drop', '💎': 'gem', '⭐': 'star', '☆': 'staro', '✨': 'sparkle',
  '🎁': 'gift', '📦': 'box', '📥': 'box', '🧺': 'basket', '🛒': 'cart', '📖': 'book', '🎓': 'cap', '🎨': 'palette', '🧪': 'flask',
  '🧬': 'dna', '📈': 'chart', '🔒': 'lock', '🔥': 'flame', '🥾': 'boot', '✂': 'scissors', '🐛': 'bug', '🐞': 'bug', '🏛': 'museum',
  '🚪': 'door', '🔍': 'search', '🚿': 'can', '✅': 'check', '👥': 'people', '🌀': 'swirl', '🖐': 'hand', '✋': 'hand', '👆': 'hand',
  '🧤': 'glove', '🏡': 'house', '🌍': 'planet', '🏮': 'lantern', '🥇': 'gold', '🥈': 'silver', '🥉': 'bronze', '❔': 'question',
  '🔊': 'sound', '🔇': 'mute', '📅': 'calendar', '🧽': 'sponge', '⬇': 'down', '🎯': 'target', '🌫': 'fog', '💡': 'bulb', '♨': 'heat',
  '😴': 'sleep', '☀': 'sun', '🌡': 'thermo', '⚠': 'warn', '🌑': 'moon', '❄': 'snow', '🌲': 'pine', '🪷': 'lotus', '🏜': 'dunes',
  '🌵': 'cactus', '🌿': 'herb', '🍃': 'fern', '🍂': 'autumn', '🌸': 'orchid', '🌼': 'flower', '💐': 'bouquet', '🌴': 'palm', '🟫': 'soil', '🔪': 'knife', '⛏': 'pick', '🧭': 'compass', '🌋': 'volcano', '🍄': 'mushroom', '🏔': 'peak',
  '🪰': 'flytrap', '🌳': 'tree', '🌱': 'sprout', '🌰': 'seed', '💚': 'hgreen', '💛': 'hgold', '🤍': 'hwhite',
};

/** Chaque espèce s'écrit avec un caractère privé, remplacé à l'affichage par son portrait. */
const PUA = 0xe000;
export const SPECIES_MARK: Record<string, string> = Object.fromEntries(SPECIES.map((sp, i) => [sp.id, String.fromCharCode(PUA + i)]));

const images = new Map<string, HTMLImageElement>();
/** Portraits prêts : `p12` en pot (interface), `q12` à nu (mini-jeux). */
const shots = new Map<string, HTMLCanvasElement>();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, (ch) => '\\' + ch);
const RX = new RegExp(`(?:[\\uE000-\\uE0FF]|${Object.keys(OF).sort((a, b) => b.length - a.length).map(esc).join('|')})\\uFE0F?`, 'gu');

function keyOf(token: string): string | null {
  const c = token.charCodeAt(0);
  if (c >= PUA && c < PUA + SPECIES.length) return 'p' + (c - PUA);
  return OF[token.replace('️', '')] ?? null;
}
const isShot = (key: string) => /^[pq]\d+$/.test(key);
/** En attendant son portrait, une espèce porte le dessin de sa famille. */
const standIn = (key: string) => OF[FAMILIES[SPECIES[Number(key.slice(1))].family].icon.replace('️', '')] ?? 'sprout';

/** Remplit une pastille : le portrait s'il est prêt, sinon le dessin au trait. */
function fill(el: HTMLElement, key: string): void {
  const text = el.dataset.t ?? '';
  const shot = shots.get(key);
  if (shot) {
    const c = document.createElement('canvas');
    c.width = shot.width;
    c.height = shot.height;
    c.getContext('2d')?.drawImage(shot, 0, 0);
    el.replaceChildren(c, text);
    el.dataset.ok = '1';
  } else {
    el.innerHTML = svg(ICONS[isShot(key) ? standIn(key) : key]);
    el.append(text);
  }
}

function swap(node: Text): void {
  const text = node.data;
  RX.lastIndex = 0;
  if (!RX.test(text)) return;
  const parent = node.parentElement;
  if (!parent || parent.closest('.ic, svg, script, style, textarea')) return;
  const frag = document.createDocumentFragment();
  let last = 0;
  RX.lastIndex = 0;
  for (let m = RX.exec(text); m; m = RX.exec(text)) {
    const key = keyOf(m[0]);
    if (!key) continue;
    if (m.index > last) frag.append(text.slice(last, m.index));
    const el = document.createElement('span');
    el.className = isShot(key) ? 'ic pl' : 'ic';
    el.dataset.k = key;
    el.dataset.t = m[0];
    fill(el, key);
    frag.append(el);
    last = m.index + m[0].length;
  }
  if (!last) return;
  if (last < text.length) frag.append(text.slice(last));
  node.replaceWith(frag);
}

function sweep(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) { swap(root as Text); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const found: Text[] = [];
  while (walker.nextNode()) found.push(walker.currentNode as Text);
  found.forEach(swap);
}

/** Rend une petite scène à part et écrit ses pixels (RGBA linéaire prémultiplié, de bas en haut) dans `out`. */
export type Snap = (scene: THREE.Scene, cam: THREE.Camera, rt: THREE.WebGLRenderTarget, out: Uint8Array) => void;

const SIZE = 144;
const toSrgb = new Uint8Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; toSrgb[i] = Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); }

/**
 * Portraits des espèces, rendus après le démarrage avec le moteur de la serre, quelques-uns à la fois.
 * Rien ici ne doit pouvoir bloquer le jeu : au moindre souci on s'arrête et les dessins de famille restent.
 */
function portraits(snap: Snap): void {
  const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 });
  const px = new Uint8Array(SIZE * SIZE * 4);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8c7a8, 1.3));
  const sun = new THREE.DirectionalLight(0xfff1d0, 1.5);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const box = new THREE.Box3();
  const mid = new THREE.Vector3();
  const dim = new THREE.Vector3();
  const one = (i: number, bare: boolean) => {
    const g = new THREE.Group();
    if (!bare) g.add(buildPot());
    const plant = buildPlant(SPECIES[i], 4, 1, 0);
    plant.position.y = bare ? 0 : POT_TOP;
    g.add(plant);
    finish(g);
    scene.add(g);
    box.setFromObject(g);
    box.getCenter(mid);
    box.getSize(dim);
    const r = Math.max(dim.x, dim.y, dim.z) * 0.5 * 1.12;
    const d = r / Math.tan((cam.fov * Math.PI) / 360);
    cam.position.set(mid.x + d * 0.35, mid.y + d * 0.32, mid.z + d * 0.88);
    cam.lookAt(mid);
    snap(scene, cam, rt, px);
    scene.remove(g);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const src = ((SIZE - 1 - y) * SIZE + x) * 4;
        const dst = (y * SIZE + x) * 4;
        const a = px[src + 3];
        const k = a ? 255 / a : 0;
        img.data[dst] = toSrgb[Math.min(255, Math.round(px[src] * k))];
        img.data[dst + 1] = toSrgb[Math.min(255, Math.round(px[src + 1] * k))];
        img.data[dst + 2] = toSrgb[Math.min(255, Math.round(px[src + 2] * k))];
        img.data[dst + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    shots.set((bare ? 'q' : 'p') + i, canvas);
  };
  let i = 0;
  const step = () => {
    try {
      const until = performance.now() + 8;
      while (i < SPECIES.length && performance.now() < until) {
        one(i, false);
        one(i, true);
        document.querySelectorAll<HTMLElement>(`.ic[data-k="p${i}"]:not([data-ok])`).forEach((el) => fill(el, 'p' + i));
        i++;
      }
    } catch (e) {
      console.warn('portraits', e);
      rt.dispose();
      return;
    }
    if (i < SPECIES.length) setTimeout(step, 60);
    else {
      rt.dispose();
      // Dernier passage : une pastille créée pendant le rendu peut avoir gardé le dessin d'attente.
      const sweep = () => document.querySelectorAll<HTMLElement>('.ic[data-k^="p"]:not([data-ok])').forEach((el) => { if (shots.has(el.dataset.k ?? '')) fill(el, el.dataset.k!); });
      sweep();
      setTimeout(sweep, 1500);
    }
  };
  setTimeout(step, 400);
}

let SNAP: Snap | null = null;
/**
 * Photographie un objet 3D vu de trois quarts face, sur fond transparent (le personnage et son équipement).
 * Renvoie null si le moteur n'est pas prêt : l'appelant garde alors son dessin.
 */
export function photo(obj: THREE.Object3D, size = 240): HTMLCanvasElement | null {
  if (!SNAP) return null;
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
  try {
    const px = new Uint8Array(size * size * 4);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8c7a8, 1.3));
    const sun = new THREE.DirectionalLight(0xfff1d0, 1.5);
    sun.position.set(2, 4, -3);
    scene.add(sun, obj);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    const box = new THREE.Box3().setFromObject(obj), mid = box.getCenter(new THREE.Vector3()), dim = box.getSize(new THREE.Vector3());
    const r = Math.max(dim.x, dim.y, dim.z) * 0.5 * 1.15, d = r / Math.tan((cam.fov * Math.PI) / 360);
    cam.position.set(mid.x + d * 0.45, mid.y + d * 0.28, mid.z - d * 0.85);
    cam.lookAt(mid);
    SNAP(scene, cam, rt, px);
    scene.remove(obj);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const src = ((size - 1 - y) * size + x) * 4, dst = (y * size + x) * 4, a = px[src + 3], k = a ? 255 / a : 0;
        for (let c = 0; c < 3; c++) img.data[dst + c] = toSrgb[Math.min(255, Math.round(px[src + c] * k))];
        img.data[dst + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  } catch (e) {
    console.warn('photo', e);
    return null;
  } finally {
    rt.dispose();
  }
}

/** À appeler une fois au démarrage : surveille tout ce que l'interface écrit et y remplace les émojis par des dessins. */
export function installIcons(snap: Snap): void {
  SNAP = snap;
  try {
    sweep(document.body);
    // Garde-fou : si quelque chose défait nos remplacements en boucle, on arrête de surveiller plutôt que de figer le jeu.
    let since = performance.now();
    let work = 0;
    const watcher = new MutationObserver((records) => {
      try {
        const now = performance.now();
        if (now - since > 1000) { since = now; work = 0; }
        work += records.length;
        if (work > 4000) { watcher.disconnect(); console.warn('icons: trop de changements, arrêt'); return; }
        for (const r of records) {
          if (r.type === 'characterData') sweep(r.target);
          else r.addedNodes.forEach(sweep);
        }
      } catch (e) { console.warn('icons', e); }
    });
    watcher.observe(document.body, { childList: true, subtree: true, characterData: true });
    portraits(snap);
  } catch (e) { console.warn('icons', e); }
}

/** Dessine une icône centrée en (x, y), dans un carré de côté `size` : pour les mini-jeux peints sur un canevas. */
export function drawIcon(c: CanvasRenderingContext2D, token: string, x: number, y: number, size: number, bare = false): void {
  const key = keyOf(token);
  if (!key) return;
  const shot = isShot(key) ? shots.get((bare ? 'q' : 'p') + key.slice(1)) : undefined;
  if (shot) { c.drawImage(shot, x - size / 2, y - size / 2, size, size); return; }
  const name = isShot(key) ? standIn(key) : key;
  let img = images.get(name);
  if (!img) { img = new Image(); img.src = 'data:image/svg+xml,' + encodeURIComponent(svg(ICONS[name])); images.set(name, img); }
  if (img.complete && img.naturalWidth) { c.drawImage(img, x - size / 2, y - size / 2, size, size); return; }
  // Dernier recours si l'image n'a pas pu se charger : une pastille de couleur.
  c.beginPath();
  c.arc(x, y, size * 0.32, 0, Math.PI * 2);
  c.fillStyle = '#8cc44e';
  c.fill();
  c.lineWidth = 2.5;
  c.strokeStyle = INK;
  c.stroke();
}
