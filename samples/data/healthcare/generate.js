#!/usr/bin/env node
//
// generate.js: Healthcare Clinic Management dataset generator
//
// Produces four CSV files:
//   patients.csv          1,000 patients with demographics, address, insurance, emergency contact
//   visits.csv            ~3,000 visits with polymorphic type-specific fields (sparse where N/A)
//   diagnoses.csv         ~7,500 diagnoses (1-4 per visit), real ICD-10-CM codes
//   prescriptions.csv     ~4,500 prescriptions (1-3 per visit), real generic medications
//
// Deterministic via a seeded RNG. Re-running produces the exact same output.
// USD-style en-US conventions throughout, US-only addresses, ISO-8601 dates.
//
// Visit types are polymorphic. Vaccination visits skip most vitals. Procedure
// visits add procedure_code and procedure_provider fields. Mental health
// visits skip most physical vitals. Annual physicals carry full vitals.
// All fields exist in the CSV but are blank where they do not apply.

'use strict';

const fs = require('fs');
const path = require('path');

// --- Seeded RNG (Mulberry32) -------------------------------------------------

function makeRng(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = makeRng(3147);

function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function pickWeighted(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = rand() * total;
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
  return pairs[pairs.length - 1][0];
}
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function randFloat(min, max, digits = 1) {
  const v = rand() * (max - min) + min;
  return Number(v.toFixed(digits));
}
function uuid() {
  const hex = () => Math.floor(rand() * 16).toString(16);
  let s = '';
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) s += '-';
    s += hex();
  }
  return s;
}
function pad(n, w) { return String(n).padStart(w, '0'); }
function isoDate(d) { return d.toISOString().slice(0, 10); }
function addDays(d, days) { const x = new Date(d); x.setDate(x.getDate() + days); return x; }

// --- CSV writer --------------------------------------------------------------

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
function writeCsv(filePath, header, rows) {
  const lines = [header.map(csvEscape).join(',')];
  for (const r of rows) lines.push(header.map(h => csvEscape(r[h])).join(','));
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
  console.log(`wrote ${filePath} (${rows.length} rows)`);
}

// --- Reference data ----------------------------------------------------------

const FIRST_NAMES = [
  'Aaliyah','Aiden','Alex','Amara','Andre','Aria','Asher','Aubrey','Ava','Avery',
  'Beatriz','Brandon','Brody','Caleb','Camila','Carlos','Charlotte','Chloe','Christian','Connor',
  'Daniela','Diego','Dmitri','Eduardo','Eli','Elena','Eliana','Elijah','Elise','Emma',
  'Ethan','Evan','Everly','Fatima','Felix','Finn','Gabriel','Gabriela','Grace','Hannah',
  'Harper','Henry','Hudson','Ibrahim','Imani','Isabella','Isaiah','Jackson','Jade','James',
  'Jasmine','Javier','Jayden','Jordan','Jose','Joseph','Joshua','Julia','Kai','Kaitlyn',
  'Kavya','Kenji','Kiara','Lailah','Layla','Leo','Levi','Liam','Lily','Logan',
  'Lucas','Luna','Maddox','Madeline','Maeve','Malia','Marcus','Maria','Mason','Mateo',
  'Maya','Mia','Micah','Miguel','Naomi','Natalie','Nina','Noah','Nora','Olivia',
  'Owen','Penelope','Priya','Quinn','Rafael','Rania','Reese','Riley','Robert','Ryan',
  'Sadie','Samira','Sebastian','Selene','Serena','Shreya','Simone','Sofia','Soren','Stella',
  'Tariq','Theo','Tomas','Valentina','Vihaan','Violet','Walter','Wesley','Wyatt','Xavier',
  'Yasmin','Yusuf','Zara','Zoe'
];

const LAST_NAMES = [
  'Aguilar','Anderson','Bauer','Bennett','Brooks','Bryant','Cabrera','Carter','Castro','Chen',
  'Cho','Cohen','Coleman','Cooper','Diaz','Dixon','Donovan','Edwards','Fischer','Fleming',
  'Foster','Gallagher','Garcia','Gibson','Goldberg','Gomez','Gonzalez','Graham','Greene','Hall',
  'Hamilton','Hassan','Hayes','Henderson','Hernandez','Hoffman','Howard','Hughes','Ito','Jackson',
  'Jacobs','James','Johnson','Jones','Kapoor','Kim','King','Klein','Kowalski','Lambert',
  'Lee','Lewis','Lin','Lopez','Martinez','Mason','McCarthy','McGuire','Mendez','Miller',
  'Mitchell','Moore','Morgan','Morris','Murphy','Nakamura','Nelson','Nguyen','Novak','Okafor',
  'Olsen','Ortega','Park','Parker','Patel','Patterson','Pena','Perez','Peters','Phillips',
  'Powell','Quinn','Ramirez','Reed','Reyes','Reynolds','Rivera','Roberts','Rodriguez','Rosen',
  'Russell','Saito','Sanders','Santos','Schwartz','Scott','Sharma','Shaw','Silva','Simmons',
  'Smith','Stewart','Suarez','Sullivan','Tanaka','Taylor','Thomas','Thompson','Torres','Tran',
  'Turner','Vargas','Vasquez','Wagner','Walker','Wang','Watson','White','Williams','Wilson',
  'Wong','Wright','Xu','Yamada','Young','Zhang'
];

const STREET_NAMES = [
  'Maple','Oak','Pine','Cedar','Elm','Walnut','Chestnut','Birch','Willow','Aspen',
  'Main','Park','Lake','River','Hill','Highland','Valley','Forest','Spring','Summer',
  'Madison','Jefferson','Lincoln','Washington','Adams','Monroe','Jackson','Franklin','Hamilton','Liberty'
];
const STREET_TYPES = ['St','Ave','Rd','Blvd','Ln','Dr','Ct','Way','Pl','Ter'];

const CITIES = [
  { city: 'Seattle', state: 'WA', zip: '98101' },
  { city: 'Portland', state: 'OR', zip: '97201' },
  { city: 'San Francisco', state: 'CA', zip: '94102' },
  { city: 'Oakland', state: 'CA', zip: '94601' },
  { city: 'Los Angeles', state: 'CA', zip: '90012' },
  { city: 'San Diego', state: 'CA', zip: '92101' },
  { city: 'Las Vegas', state: 'NV', zip: '89101' },
  { city: 'Phoenix', state: 'AZ', zip: '85003' },
  { city: 'Tucson', state: 'AZ', zip: '85701' },
  { city: 'Salt Lake City', state: 'UT', zip: '84101' },
  { city: 'Denver', state: 'CO', zip: '80202' },
  { city: 'Boulder', state: 'CO', zip: '80302' },
  { city: 'Albuquerque', state: 'NM', zip: '87102' },
  { city: 'Austin', state: 'TX', zip: '78701' },
  { city: 'Houston', state: 'TX', zip: '77002' },
  { city: 'Dallas', state: 'TX', zip: '75201' },
  { city: 'San Antonio', state: 'TX', zip: '78205' },
  { city: 'Oklahoma City', state: 'OK', zip: '73102' },
  { city: 'Kansas City', state: 'MO', zip: '64101' },
  { city: 'St. Louis', state: 'MO', zip: '63101' },
  { city: 'Minneapolis', state: 'MN', zip: '55401' },
  { city: 'Chicago', state: 'IL', zip: '60601' },
  { city: 'Milwaukee', state: 'WI', zip: '53202' },
  { city: 'Detroit', state: 'MI', zip: '48201' },
  { city: 'Cleveland', state: 'OH', zip: '44101' },
  { city: 'Columbus', state: 'OH', zip: '43215' },
  { city: 'Cincinnati', state: 'OH', zip: '45202' },
  { city: 'Indianapolis', state: 'IN', zip: '46204' },
  { city: 'Nashville', state: 'TN', zip: '37203' },
  { city: 'Memphis', state: 'TN', zip: '38103' },
  { city: 'Atlanta', state: 'GA', zip: '30303' },
  { city: 'Charlotte', state: 'NC', zip: '28202' },
  { city: 'Raleigh', state: 'NC', zip: '27601' },
  { city: 'Charleston', state: 'SC', zip: '29401' },
  { city: 'Jacksonville', state: 'FL', zip: '32202' },
  { city: 'Orlando', state: 'FL', zip: '32801' },
  { city: 'Miami', state: 'FL', zip: '33130' },
  { city: 'Tampa', state: 'FL', zip: '33602' },
  { city: 'New Orleans', state: 'LA', zip: '70112' },
  { city: 'Birmingham', state: 'AL', zip: '35203' },
  { city: 'Pittsburgh', state: 'PA', zip: '15222' },
  { city: 'Philadelphia', state: 'PA', zip: '19102' },
  { city: 'Baltimore', state: 'MD', zip: '21201' },
  { city: 'Washington', state: 'DC', zip: '20001' },
  { city: 'Richmond', state: 'VA', zip: '23219' },
  { city: 'Norfolk', state: 'VA', zip: '23510' },
  { city: 'New York', state: 'NY', zip: '10001' },
  { city: 'Brooklyn', state: 'NY', zip: '11201' },
  { city: 'Buffalo', state: 'NY', zip: '14202' },
  { city: 'Newark', state: 'NJ', zip: '07102' },
  { city: 'Jersey City', state: 'NJ', zip: '07302' },
  { city: 'Boston', state: 'MA', zip: '02110' }
];

const INSURANCE_PROVIDERS = [
  'UnitedHealthcare','Anthem Blue Cross','Aetna','Cigna','Humana',
  'Kaiser Permanente','BlueCross BlueShield','Molina Healthcare',
  'Centene','Independence Blue Cross','Medicare','Medicaid','Self-pay'
];

// Clinicians, with specialty hint to influence which visit types they see.
// We deliberately keep the roster small (~12) to make per-clinician schedule
// queries meaningful when the data is loaded into MongoDB.
const CLINICIANS = [
  { name: 'Dr. Sarah Chen, MD',         types: ['annual_physical','acute_illness','follow_up','vaccination'] },
  { name: 'Dr. Michael Rodriguez, MD',  types: ['annual_physical','acute_illness','follow_up','vaccination'] },
  { name: 'Dr. Priya Patel, MD',        types: ['annual_physical','acute_illness','follow_up','vaccination'] },
  { name: 'Dr. James Williams, MD',     types: ['annual_physical','acute_illness','follow_up','vaccination'] },
  { name: 'Dr. Aisha Hassan, DO',       types: ['annual_physical','acute_illness','follow_up'] },
  { name: 'Dr. Robert Kim, MD',         types: ['procedure','follow_up'] },
  { name: 'Dr. Elena Vasquez, MD',      types: ['procedure','follow_up'] },
  { name: 'Dr. David Goldberg, PhD',    types: ['mental_health'] },
  { name: 'Dr. Maria Gonzalez, LCSW',   types: ['mental_health'] },
  { name: 'NP Jennifer Foster, FNP-BC', types: ['annual_physical','acute_illness','vaccination','follow_up'] },
  { name: 'NP Marcus Johnson, FNP-BC',  types: ['annual_physical','acute_illness','vaccination','follow_up'] },
  { name: 'PA Linh Tran, PA-C',         types: ['acute_illness','vaccination','follow_up'] }
];

// --- ICD-10-CM codes mapped to visit types ----------------------------------
//
// Real ICD-10-CM codes. Each entry tags which visit_types it commonly appears
// under so the dataset reflects clinical reality (you don't get a back-pain
// diagnosis at a vaccination visit). `chronic` flag drives diagnosis_type and
// status weighting.

const ICD10 = [
  // Respiratory and infectious (acute_illness, follow_up)
  { code: 'J06.9',   desc: 'Acute upper respiratory infection, unspecified',          contexts: ['acute_illness'] },
  { code: 'J20.9',   desc: 'Acute bronchitis, unspecified',                           contexts: ['acute_illness','follow_up'] },
  { code: 'J02.9',   desc: 'Acute pharyngitis, unspecified',                          contexts: ['acute_illness'] },
  { code: 'J01.90',  desc: 'Acute sinusitis, unspecified',                            contexts: ['acute_illness','follow_up'] },
  { code: 'J45.909', desc: 'Unspecified asthma, uncomplicated',                       contexts: ['annual_physical','acute_illness','follow_up'], chronic: true },
  { code: 'J44.9',   desc: 'Chronic obstructive pulmonary disease, unspecified',      contexts: ['annual_physical','follow_up'], chronic: true },
  { code: 'B34.9',   desc: 'Viral infection, unspecified',                            contexts: ['acute_illness'] },
  { code: 'A09',     desc: 'Infectious gastroenteritis and colitis, unspecified',     contexts: ['acute_illness'] },
  { code: 'N39.0',   desc: 'Urinary tract infection, site not specified',             contexts: ['acute_illness','follow_up'] },
  { code: 'H66.90',  desc: 'Otitis media, unspecified',                               contexts: ['acute_illness'] },

  // Chronic cardiometabolic (annual_physical, follow_up)
  { code: 'I10',     desc: 'Essential (primary) hypertension',                        contexts: ['annual_physical','follow_up'], chronic: true },
  { code: 'E11.9',   desc: 'Type 2 diabetes mellitus without complications',          contexts: ['annual_physical','follow_up'], chronic: true },
  { code: 'E11.65',  desc: 'Type 2 diabetes mellitus with hyperglycemia',             contexts: ['follow_up'], chronic: true },
  { code: 'E78.5',   desc: 'Hyperlipidemia, unspecified',                             contexts: ['annual_physical','follow_up'], chronic: true },
  { code: 'E78.00',  desc: 'Pure hypercholesterolemia, unspecified',                  contexts: ['annual_physical','follow_up'], chronic: true },
  { code: 'E66.9',   desc: 'Obesity, unspecified',                                    contexts: ['annual_physical','follow_up'], chronic: true },
  { code: 'E03.9',   desc: 'Hypothyroidism, unspecified',                             contexts: ['annual_physical','follow_up'], chronic: true },
  { code: 'I25.10',  desc: 'Atherosclerotic heart disease without angina pectoris',   contexts: ['annual_physical','follow_up'], chronic: true },
  { code: 'I48.91',  desc: 'Unspecified atrial fibrillation',                         contexts: ['annual_physical','follow_up'], chronic: true },
  { code: 'I50.9',   desc: 'Heart failure, unspecified',                              contexts: ['follow_up'], chronic: true },

  // Musculoskeletal (acute_illness, follow_up, procedure)
  { code: 'M54.5',   desc: 'Low back pain',                                           contexts: ['acute_illness','follow_up','procedure'], chronic: true },
  { code: 'M54.2',   desc: 'Cervicalgia',                                             contexts: ['acute_illness','follow_up'] },
  { code: 'M25.561', desc: 'Pain in right knee',                                      contexts: ['acute_illness','follow_up','procedure'] },
  { code: 'M25.562', desc: 'Pain in left knee',                                       contexts: ['acute_illness','follow_up','procedure'] },
  { code: 'M17.11',  desc: 'Unilateral primary osteoarthritis, right knee',           contexts: ['follow_up','procedure'], chronic: true },
  { code: 'M19.90',  desc: 'Unspecified osteoarthritis, unspecified site',            contexts: ['annual_physical','follow_up'], chronic: true },
  { code: 'M79.7',   desc: 'Fibromyalgia',                                            contexts: ['follow_up'], chronic: true },

  // Mental health (mental_health, annual_physical)
  { code: 'F41.9',   desc: 'Anxiety disorder, unspecified',                           contexts: ['mental_health','annual_physical','follow_up'], chronic: true },
  { code: 'F41.1',   desc: 'Generalized anxiety disorder',                            contexts: ['mental_health','follow_up'], chronic: true },
  { code: 'F32.9',   desc: 'Major depressive disorder, single episode, unspecified',  contexts: ['mental_health','annual_physical'], chronic: true },
  { code: 'F33.1',   desc: 'Major depressive disorder, recurrent, moderate',          contexts: ['mental_health','follow_up'], chronic: true },
  { code: 'F43.10',  desc: 'Post-traumatic stress disorder, unspecified',             contexts: ['mental_health'], chronic: true },
  { code: 'F51.01',  desc: 'Primary insomnia',                                        contexts: ['mental_health','annual_physical'] },
  { code: 'F90.9',   desc: 'Attention-deficit hyperactivity disorder, unspecified',   contexts: ['mental_health','annual_physical'], chronic: true },

  // Wellness and screening (annual_physical, vaccination)
  { code: 'Z00.00',  desc: 'Encounter for general adult medical examination without abnormal findings', contexts: ['annual_physical'] },
  { code: 'Z00.01',  desc: 'Encounter for general adult medical examination with abnormal findings',    contexts: ['annual_physical'] },
  { code: 'Z23',     desc: 'Encounter for immunization',                              contexts: ['vaccination'] },
  { code: 'Z51.81',  desc: 'Encounter for therapeutic drug level monitoring',         contexts: ['follow_up'] },
  { code: 'Z79.4',   desc: 'Long term (current) use of insulin',                      contexts: ['annual_physical','follow_up'], chronic: true },
  { code: 'Z79.899', desc: 'Other long term (current) drug therapy',                  contexts: ['annual_physical','follow_up'], chronic: true },

  // Other common
  { code: 'R51.9',   desc: 'Headache, unspecified',                                   contexts: ['acute_illness','follow_up'] },
  { code: 'G43.909', desc: 'Migraine, unspecified, not intractable, without status migrainosus', contexts: ['acute_illness','follow_up'], chronic: true },
  { code: 'R10.9',   desc: 'Unspecified abdominal pain',                              contexts: ['acute_illness'] },
  { code: 'K21.9',   desc: 'Gastro-esophageal reflux disease without esophagitis',    contexts: ['annual_physical','follow_up'], chronic: true },
  { code: 'L70.0',   desc: 'Acne vulgaris',                                           contexts: ['acute_illness','follow_up'], chronic: true },
  { code: 'H10.9',   desc: 'Unspecified conjunctivitis',                              contexts: ['acute_illness'] },
  { code: 'R05.9',   desc: 'Cough, unspecified',                                      contexts: ['acute_illness'] },
  { code: 'R50.9',   desc: 'Fever, unspecified',                                      contexts: ['acute_illness'] }
];

// --- Medications -------------------------------------------------------------
//
// Real generic and brand names. Each entry constrains which ICD-10 codes it
// commonly treats so prescriptions track the diagnoses for the visit. We use
// approximate, plausible defaults for dose/frequency/duration; nothing here
// is medical advice.

const MEDICATIONS = [
  // Antihypertensives
  { brand: 'Lisinopril',     generic: 'lisinopril',                    doses: [10, 20, 40],     unit: 'mg',  freqs: ['once_daily'],            duration: [30, 90], refills: [3, 5], for: ['I10','I50.9','I25.10'] },
  { brand: 'Amlodipine',     generic: 'amlodipine besylate',           doses: [5, 10],          unit: 'mg',  freqs: ['once_daily'],            duration: [30, 90], refills: [3, 5], for: ['I10','I25.10'] },
  { brand: 'Losartan',       generic: 'losartan potassium',            doses: [25, 50, 100],    unit: 'mg',  freqs: ['once_daily'],            duration: [30, 90], refills: [3, 5], for: ['I10','I50.9'] },
  { brand: 'Metoprolol',     generic: 'metoprolol succinate',          doses: [25, 50, 100],    unit: 'mg',  freqs: ['once_daily','twice_daily'], duration: [30, 90], refills: [3, 5], for: ['I10','I48.91','I50.9','I25.10'] },
  { brand: 'Hydrochlorothiazide', generic: 'hydrochlorothiazide',      doses: [12.5, 25],       unit: 'mg',  freqs: ['once_daily'],            duration: [30, 90], refills: [3, 5], for: ['I10','I50.9'] },

  // Diabetes
  { brand: 'Metformin',      generic: 'metformin hydrochloride',       doses: [500, 850, 1000], unit: 'mg',  freqs: ['twice_daily'],           duration: [30, 90], refills: [3, 5], for: ['E11.9','E11.65','E66.9'] },
  { brand: 'Glipizide',      generic: 'glipizide',                     doses: [5, 10],          unit: 'mg',  freqs: ['once_daily','twice_daily'], duration: [30, 90], refills: [3, 5], for: ['E11.9','E11.65'] },
  { brand: 'Lantus',         generic: 'insulin glargine',              doses: [10, 20, 30, 40], unit: 'units', freqs: ['once_daily'],          duration: [30, 90], refills: [2, 5], for: ['E11.9','E11.65','Z79.4'] },
  { brand: 'Ozempic',        generic: 'semaglutide',                   doses: [0.5, 1, 2],      unit: 'mg',  freqs: ['weekly'],                duration: [28, 84], refills: [2, 5], for: ['E11.9','E11.65','E66.9'] },

  // Lipids
  { brand: 'Atorvastatin',   generic: 'atorvastatin calcium',          doses: [10, 20, 40, 80], unit: 'mg',  freqs: ['once_daily'],            duration: [30, 90], refills: [3, 5], for: ['E78.5','E78.00','I25.10'] },
  { brand: 'Rosuvastatin',   generic: 'rosuvastatin calcium',          doses: [5, 10, 20, 40],  unit: 'mg',  freqs: ['once_daily'],            duration: [30, 90], refills: [3, 5], for: ['E78.5','E78.00','I25.10'] },
  { brand: 'Simvastatin',    generic: 'simvastatin',                   doses: [10, 20, 40],     unit: 'mg',  freqs: ['once_daily'],            duration: [30, 90], refills: [3, 5], for: ['E78.5','E78.00'] },

  // Thyroid
  { brand: 'Levothyroxine',  generic: 'levothyroxine sodium',          doses: [25, 50, 75, 100, 125], unit: 'mcg', freqs: ['once_daily'],     duration: [30, 90], refills: [3, 5], for: ['E03.9'] },

  // Antibiotics
  { brand: 'Amoxicillin',    generic: 'amoxicillin',                   doses: [500, 875],       unit: 'mg',  freqs: ['twice_daily','every_8_hours'], duration: [7, 10], refills: [0, 0], for: ['J06.9','J20.9','J02.9','J01.90','H66.90'] },
  { brand: 'Augmentin',      generic: 'amoxicillin/clavulanate',       doses: [500, 875],       unit: 'mg',  freqs: ['twice_daily'],           duration: [7, 10], refills: [0, 0], for: ['J01.90','H66.90'] },
  { brand: 'Azithromycin',   generic: 'azithromycin',                  doses: [250, 500],       unit: 'mg',  freqs: ['once_daily'],            duration: [5, 5],   refills: [0, 0], for: ['J20.9','J02.9'] },
  { brand: 'Doxycycline',    generic: 'doxycycline hyclate',           doses: [100],            unit: 'mg',  freqs: ['twice_daily'],           duration: [7, 14], refills: [0, 1], for: ['L70.0'] },
  { brand: 'Ciprofloxacin',  generic: 'ciprofloxacin hydrochloride',   doses: [250, 500],       unit: 'mg',  freqs: ['twice_daily'],           duration: [7, 14], refills: [0, 0], for: ['N39.0'] },
  { brand: 'Bactrim',        generic: 'sulfamethoxazole/trimethoprim', doses: [800],            unit: 'mg',  freqs: ['twice_daily'],           duration: [7, 14], refills: [0, 0], for: ['N39.0'] },

  // Asthma and COPD
  { brand: 'Albuterol HFA',  generic: 'albuterol sulfate',             doses: [90],             unit: 'mcg', freqs: ['as_needed'],             duration: [30, 90], refills: [3, 5], for: ['J45.909','J44.9','J20.9'] },
  { brand: 'Advair Diskus',  generic: 'fluticasone/salmeterol',        doses: [250],            unit: 'mcg', freqs: ['twice_daily'],           duration: [30, 90], refills: [3, 5], for: ['J45.909','J44.9'] },
  { brand: 'Symbicort',      generic: 'budesonide/formoterol',         doses: [160],            unit: 'mcg', freqs: ['twice_daily'],           duration: [30, 90], refills: [3, 5], for: ['J45.909','J44.9'] },

  // Mental health
  { brand: 'Sertraline',     generic: 'sertraline hydrochloride',      doses: [25, 50, 100, 200], unit: 'mg', freqs: ['once_daily'],           duration: [30, 90], refills: [3, 5], for: ['F41.9','F41.1','F32.9','F33.1','F43.10'] },
  { brand: 'Escitalopram',   generic: 'escitalopram oxalate',          doses: [5, 10, 20],      unit: 'mg',  freqs: ['once_daily'],            duration: [30, 90], refills: [3, 5], for: ['F41.9','F41.1','F32.9','F33.1'] },
  { brand: 'Fluoxetine',     generic: 'fluoxetine hydrochloride',      doses: [10, 20, 40],     unit: 'mg',  freqs: ['once_daily'],            duration: [30, 90], refills: [3, 5], for: ['F32.9','F33.1','F41.1'] },
  { brand: 'Bupropion XL',   generic: 'bupropion hydrochloride XL',    doses: [150, 300],       unit: 'mg',  freqs: ['once_daily'],            duration: [30, 90], refills: [3, 5], for: ['F32.9','F33.1'] },
  { brand: 'Trazodone',      generic: 'trazodone hydrochloride',       doses: [50, 100],        unit: 'mg',  freqs: ['once_daily'],            duration: [30, 90], refills: [2, 5], for: ['F51.01','F32.9','F41.9'] },
  { brand: 'Adderall XR',    generic: 'amphetamine/dextroamphetamine', doses: [10, 20, 30],     unit: 'mg',  freqs: ['once_daily'],            duration: [30, 30], refills: [0, 2], for: ['F90.9'] },

  // Pain / NSAIDs / muscle
  { brand: 'Ibuprofen',      generic: 'ibuprofen',                     doses: [400, 600, 800],  unit: 'mg',  freqs: ['every_8_hours','as_needed'], duration: [7, 14], refills: [0, 1], for: ['M54.5','M54.2','M25.561','M25.562','R51.9','M79.7'] },
  { brand: 'Naproxen',       generic: 'naproxen sodium',               doses: [250, 500],       unit: 'mg',  freqs: ['twice_daily'],           duration: [7, 30], refills: [0, 2], for: ['M54.5','M54.2','M25.561','M25.562','M19.90','M17.11'] },
  { brand: 'Cyclobenzaprine', generic: 'cyclobenzaprine hydrochloride', doses: [5, 10],         unit: 'mg',  freqs: ['every_8_hours'],         duration: [7, 14], refills: [0, 0], for: ['M54.5','M54.2'] },
  { brand: 'Gabapentin',     generic: 'gabapentin',                    doses: [100, 300, 600],  unit: 'mg',  freqs: ['every_8_hours'],         duration: [30, 90], refills: [3, 5], for: ['M54.5','M79.7'] },

  // GI
  { brand: 'Omeprazole',     generic: 'omeprazole',                    doses: [20, 40],         unit: 'mg',  freqs: ['once_daily'],            duration: [30, 90], refills: [3, 5], for: ['K21.9','R10.9'] },
  { brand: 'Pantoprazole',   generic: 'pantoprazole sodium',           doses: [20, 40],         unit: 'mg',  freqs: ['once_daily'],            duration: [30, 90], refills: [3, 5], for: ['K21.9'] },
  { brand: 'Ondansetron',    generic: 'ondansetron',                   doses: [4, 8],           unit: 'mg',  freqs: ['every_8_hours','as_needed'], duration: [3, 7], refills: [0, 0], for: ['A09','R10.9'] },

  // Migraine
  { brand: 'Sumatriptan',    generic: 'sumatriptan succinate',         doses: [25, 50, 100],    unit: 'mg',  freqs: ['as_needed'],             duration: [30, 30], refills: [2, 5], for: ['G43.909','R51.9'] }
];

// --- Vaccines (for vaccination visits) --------------------------------------

const VACCINES = [
  // minAge / maxAge are inclusive bounds (US adult/pediatric guidance, simplified).
  { name: 'Influenza vaccine, quadrivalent',        cvx: '171', cpt: '90686', minAge: 0,  maxAge: 120 },
  { name: 'COVID-19 vaccine, mRNA',                 cvx: '208', cpt: '91300', minAge: 6,  maxAge: 120 },
  { name: 'Tdap (tetanus, diphtheria, pertussis)',  cvx: '115', cpt: '90715', minAge: 7,  maxAge: 120 },
  { name: 'Pneumococcal polysaccharide (PPSV23)',   cvx: '33',  cpt: '90732', minAge: 65, maxAge: 120 },
  { name: 'Pneumococcal conjugate (PCV20)',         cvx: '316', cpt: '90671', minAge: 65, maxAge: 120 },
  { name: 'Shingrix (zoster recombinant)',          cvx: '187', cpt: '90750', minAge: 50, maxAge: 120 },
  { name: 'Hepatitis B (Engerix-B)',                cvx: '43',  cpt: '90746', minAge: 0,  maxAge: 120 },
  { name: 'MMR (measles, mumps, rubella)',          cvx: '03',  cpt: '90707', minAge: 1,  maxAge: 49  },
  { name: 'HPV9 (Gardasil 9)',                      cvx: '165', cpt: '90651', minAge: 9,  maxAge: 45  }
];

function pickVaccineForAge(age) {
  const eligible = VACCINES.filter(v => age >= v.minAge && age <= v.maxAge);
  return eligible.length > 0 ? pick(eligible) : pick(VACCINES.filter(v => v.name.startsWith('Influenza')));
}

// --- Procedures (for procedure visits) --------------------------------------

const PROCEDURES = [
  { name: 'Skin lesion biopsy',                cpt: '11102' },
  { name: 'Joint injection, knee',             cpt: '20610' },
  { name: 'Joint injection, shoulder',         cpt: '20610' },
  { name: 'Trigger point injection',           cpt: '20552' },
  { name: 'Cerumen removal',                   cpt: '69210' },
  { name: 'Laceration repair, simple',         cpt: '12001' },
  { name: 'Laceration repair, intermediate',   cpt: '12031' },
  { name: 'Cryotherapy, benign skin lesion',   cpt: '17110' },
  { name: 'Endometrial biopsy',                cpt: '58100' },
  { name: 'Colposcopy with biopsy',            cpt: '57454' },
  { name: 'Spirometry',                        cpt: '94010' },
  { name: 'EKG, 12-lead',                      cpt: '93000' }
];

// --- Chief complaints by visit type -----------------------------------------

const CHIEF_COMPLAINTS = {
  annual_physical: [
    'Annual wellness exam',
    'Routine physical, asymptomatic',
    'Annual exam, medication review',
    'Wellness visit, lab follow-up'
  ],
  acute_illness: [
    'Sore throat and cough x 4 days',
    'Fever and body aches',
    'Headache, worsening over 2 days',
    'Painful urination',
    'Lower back pain after lifting',
    'Right ear pain and pressure',
    'Productive cough and chest tightness',
    'Stomach pain and nausea',
    'Sinus pressure and congestion',
    'Right knee pain after fall',
    'Rash on forearms, itchy'
  ],
  follow_up: [
    'Follow-up: hypertension management',
    'Follow-up: diabetes management',
    'Follow-up: post-antibiotic course',
    'Follow-up: lipid panel review',
    'Follow-up: medication titration',
    'Follow-up: chronic back pain',
    'Follow-up: thyroid labs',
    'Follow-up: post-procedure check'
  ],
  vaccination: [
    'Annual flu vaccination',
    'COVID-19 booster',
    'Tdap booster',
    'Travel vaccination',
    'Catch-up vaccination',
    'Shingles vaccination'
  ],
  mental_health: [
    'Anxiety, increased over past month',
    'Depressive symptoms, medication check',
    'Sleep disturbance and rumination',
    'Therapy session: ongoing',
    'Medication management visit',
    'PTSD symptom review',
    'ADHD medication review'
  ],
  procedure: [
    'Scheduled biopsy',
    'Scheduled joint injection',
    'Scheduled minor surgical procedure',
    'In-office diagnostic procedure'
  ]
};

// --- Note templates ---------------------------------------------------------

const VISIT_NOTES = {
  annual_physical: 'Patient seen for annual exam. Reviewed history, medications, and screenings. Vitals stable. Plan: continue current management, recheck in 12 months unless symptoms develop.',
  acute_illness:   'Patient presents with above complaint. Exam findings consistent with diagnosis. Treatment plan discussed including medications, expected course, and return precautions.',
  follow_up:       'Interval history reviewed. Patient reports response to current regimen. Labs and exam findings noted. Plan adjusted as documented.',
  vaccination:     'Vaccine administered per protocol. Patient observed 15 minutes post-injection without adverse reaction. VIS provided.',
  mental_health:   'Patient seen for ongoing care. Mood, sleep, and function reviewed. Medication tolerance discussed. Plan: continue current treatment and follow up as scheduled.',
  procedure:       'Procedure performed as planned. Sterile technique. Patient tolerated well. Post-procedure instructions provided. Pathology pending where applicable.'
};

// --- Helper: random phone, email, address -----------------------------------

function randomPhone() {
  const area = randInt(200, 989);
  const exch = randInt(200, 989);
  const num = randInt(0, 9999);
  return `(${area}) ${pad(exch, 3)}-${pad(num, 4)}`;
}
function randomDOB() {
  // Ages 0-92 with bias toward adults. Visits will exclude pediatrics-only filtering.
  const age = pickWeighted([
    [randInt(1, 17),  10],
    [randInt(18, 35), 30],
    [randInt(36, 55), 30],
    [randInt(56, 75), 22],
    [randInt(76, 92), 8]
  ]);
  const today = new Date('2026-01-01');
  const dob = new Date(today);
  dob.setFullYear(today.getFullYear() - age);
  dob.setMonth(randInt(0, 11));
  dob.setDate(randInt(1, 28));
  return dob;
}
function ageAt(dob, asOf) {
  let age = asOf.getFullYear() - dob.getFullYear();
  const m = asOf.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < dob.getDate())) age--;
  return age;
}
function emailFromName(first, last, salt) {
  const f = first.toLowerCase().replace(/[^a-z]/g, '');
  const l = last.toLowerCase().replace(/[^a-z]/g, '');
  const domains = ['example.com','example.net','example.org','mail.example.com'];
  const styles = [
    () => `${f}.${l}@${pick(domains)}`,
    () => `${f}${l}${randInt(1,99)}@${pick(domains)}`,
    () => `${f[0]}${l}@${pick(domains)}`,
    () => `${f}.${l}${salt}@${pick(domains)}`
  ];
  return pick(styles)();
}
function streetAddress() {
  return `${randInt(100, 9999)} ${pick(STREET_NAMES)} ${pick(STREET_TYPES)}`;
}

// --- Patients ---------------------------------------------------------------

console.log('generating patients...');

const patients = [];
for (let i = 1; i <= 1000; i++) {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const dob = randomDOB();
  const cityRow = pick(CITIES);
  const ec_first = pick(FIRST_NAMES);
  const ec_last = pick([last, pick(LAST_NAMES)]); // sometimes same surname (family), sometimes different
  patients.push({
    patient_id: `pat_${pad(i, 5)}`,
    first_name: first,
    last_name: last,
    date_of_birth: isoDate(dob),
    gender: pickWeighted([['female', 49], ['male', 49], ['nonbinary', 1], ['unspecified', 1]]),
    email: emailFromName(first, last, i),
    phone: randomPhone(),
    address_line1: streetAddress(),
    city: cityRow.city,
    state: cityRow.state,
    postal_code: cityRow.zip,
    country: 'US',
    insurance_provider: pickWeighted([
      ['UnitedHealthcare', 18], ['Anthem Blue Cross', 12], ['Aetna', 10], ['Cigna', 9],
      ['Humana', 7], ['Kaiser Permanente', 7], ['BlueCross BlueShield', 13],
      ['Molina Healthcare', 4], ['Centene', 4], ['Independence Blue Cross', 4],
      ['Medicare', 7], ['Medicaid', 4], ['Self-pay', 1]
    ]),
    insurance_member_id: `${pick(['M','U','A','C','H','K','B'])}${randInt(1000000, 9999999)}`,
    emergency_contact_name: `${ec_first} ${ec_last}`,
    emergency_contact_phone: randomPhone(),
    _dob: dob // private, used for visit-time vitals only
  });
}

// --- Visits, diagnoses, prescriptions ---------------------------------------

console.log('generating visits, diagnoses, prescriptions...');

const visits = [];
const diagnoses = [];
const prescriptions = [];

let diagSeq = 1;
let rxSeq = 1;
let visitSeq = 1;

// Date window: roughly the past year and a bit into the near future for
// scheduled visits (so the clinician schedule view in the workshop has data).
const WINDOW_START = new Date('2025-04-01');
const WINDOW_END = new Date('2026-05-31'); // ~13 months
const WINDOW_DAYS = Math.round((WINDOW_END - WINDOW_START) / (1000 * 60 * 60 * 24));

function chronicCarryover(patientChronics, currentVisitDate, currentVisitType) {
  // Carry chronic diagnoses forward to subsequent visits with appropriate
  // contexts. This is what makes the dataset clinically realistic: a diabetic
  // patient shows E11.9 across follow-up visits, not just at the first one.
  const out = [];
  for (const c of patientChronics) {
    if (!c.contexts.includes(currentVisitType)) continue;
    out.push(c);
  }
  return out;
}

// Per-patient visit count distribution. Most patients have 1-3 visits; a long
// tail has many (chronic conditions, frequent flyers).
function visitsForPatient() {
  return pickWeighted([
    [0, 5],   // some patients have no visits in window (5%)
    [1, 25],
    [2, 25],
    [3, 18],
    [4, 12],
    [5, 8],
    [6, 4],
    [7, 2],
    [8, 1]
  ]);
}

// Assign clinicians who can see this visit type
function clinicianFor(visitType) {
  const eligible = CLINICIANS.filter(c => c.types.includes(visitType));
  return pick(eligible).name;
}

function durationFor(visitType) {
  switch (visitType) {
    case 'annual_physical': return randInt(25, 45);
    case 'acute_illness':   return randInt(15, 25);
    case 'follow_up':       return randInt(10, 20);
    case 'vaccination':     return randInt(10, 15);
    case 'mental_health':   return randInt(45, 60);
    case 'procedure':       return randInt(20, 60);
    default: return 20;
  }
}

function vitalsFor(patient, visitType, visitDate) {
  // Returns vitals object with sparse fields by visit_type. Vaccination
  // and mental_health visits skip most vitals; annual physicals carry all.
  const age = ageAt(patient._dob, visitDate);
  const adult = age >= 18;
  const baseHr = adult ? randInt(58, 92) : randInt(70, 110);

  const fullVitals = {
    bp_systolic:    adult ? randInt(105, 158) : randInt(95, 120),
    bp_diastolic:   adult ? randInt(62, 95)   : randInt(58, 78),
    heart_rate:     baseHr,
    temperature_f:  randFloat(97.4, 99.6),
    weight_lbs:     adult ? randInt(105, 285) : randInt(35, 145),
    height_in:      adult ? randInt(58, 76)   : randInt(36, 72)
  };

  const ill = {
    bp_systolic:    fullVitals.bp_systolic,
    bp_diastolic:   fullVitals.bp_diastolic,
    heart_rate:     baseHr + randInt(0, 18),       // elevated when sick
    temperature_f:  randFloat(98.0, 102.4),         // sometimes febrile
    weight_lbs:     fullVitals.weight_lbs,
    height_in:      fullVitals.height_in
  };

  const minimal = {
    bp_systolic:    '',
    bp_diastolic:   '',
    heart_rate:     '',
    temperature_f:  '',
    weight_lbs:     '',
    height_in:      ''
  };

  // Some intermediate visits capture only BP + HR (med checks, follow-ups).
  const partial = {
    bp_systolic:    fullVitals.bp_systolic,
    bp_diastolic:   fullVitals.bp_diastolic,
    heart_rate:     fullVitals.heart_rate,
    temperature_f:  '',
    weight_lbs:     '',
    height_in:      ''
  };

  switch (visitType) {
    case 'annual_physical': return fullVitals;
    case 'acute_illness':   return ill;
    case 'follow_up':       return rand() < 0.7 ? partial : fullVitals;
    case 'vaccination':     return rand() < 0.3 ? { ...minimal, temperature_f: randFloat(97.6, 99.4) } : minimal;
    case 'mental_health':   return rand() < 0.2 ? partial : minimal;
    case 'procedure':       return partial;
    default: return minimal;
  }
}

// Per-patient chronic profile. About 35% of adults have at least one chronic
// condition. This drives chronic diagnosis carryover and mental_health/follow_up
// frequency.
function chronicProfileFor(patient) {
  const age = ageAt(patient._dob, WINDOW_END);
  if (age < 18) return [];
  const profile = [];
  // Adult chronic prevalence, loosely matched to US epidemiology
  if (rand() < (age > 50 ? 0.45 : 0.18)) profile.push(ICD10.find(d => d.code === 'I10'));        // HTN
  if (rand() < (age > 50 ? 0.20 : 0.08)) profile.push(ICD10.find(d => d.code === 'E11.9'));      // T2DM
  if (rand() < 0.30)                     profile.push(ICD10.find(d => d.code === 'E78.5'));      // hyperlipidemia
  if (rand() < 0.10)                     profile.push(ICD10.find(d => d.code === 'E03.9'));      // hypothyroidism
  if (rand() < 0.18)                     profile.push(ICD10.find(d => d.code === 'F41.9'));      // anxiety
  if (rand() < 0.12)                     profile.push(ICD10.find(d => d.code === 'F32.9'));      // depression
  if (rand() < 0.08)                     profile.push(ICD10.find(d => d.code === 'J45.909'));    // asthma
  if (rand() < 0.10)                     profile.push(ICD10.find(d => d.code === 'M54.5'));      // chronic LBP
  if (rand() < 0.12)                     profile.push(ICD10.find(d => d.code === 'K21.9'));      // GERD
  return profile.filter(Boolean);
}

function pickVisitType(chronics, age) {
  // Visit-type weighting depends on chronicity and age.
  const hasMentalHealth = chronics.some(c => c.code.startsWith('F'));
  const w = [
    ['acute_illness',  35],
    ['follow_up',      chronics.length > 0 ? 30 : 12],
    ['annual_physical', 18],
    ['vaccination',     12],
    ['mental_health',   hasMentalHealth ? 18 : 3],
    ['procedure',        5]
  ];
  if (age < 18) {
    // Pediatrics: more vaccinations, fewer follow-ups, no mental_health (adults only here).
    w[0][1] = 30; w[1][1] = 6; w[2][1] = 18; w[3][1] = 30; w[4][1] = 0; w[5][1] = 4;
  }
  return pickWeighted(w);
}

function pickDiagnosesFor(visitType, chronics, visitDate) {
  // Returns array of {icd10_code, description, diagnosis_type, status}
  const out = [];
  const used = new Set();

  // Vaccination visits are clean: Z23 plus optional chronic carryover.
  if (visitType === 'vaccination') {
    const z23 = ICD10.find(d => d.code === 'Z23');
    out.push({ icd10: z23, type: 'primary', status: 'active' });
    used.add(z23.code);
    // Sometimes capture an immunization note alongside chronic carryover
    const carry = chronicCarryover(chronics, visitDate, visitType);
    for (const c of carry) {
      if (used.has(c.code)) continue;
      out.push({ icd10: c, type: 'chronic', status: 'active' });
      used.add(c.code);
      if (out.length >= 2) break;
    }
    return out;
  }

  // Annual physical: optional Z00.0x primary, plus chronic carryover.
  if (visitType === 'annual_physical') {
    const abnormal = chronics.length > 0 && rand() < 0.35;
    const wellness = abnormal ? ICD10.find(d => d.code === 'Z00.01') : ICD10.find(d => d.code === 'Z00.00');
    out.push({ icd10: wellness, type: 'primary', status: 'active' });
    used.add(wellness.code);
    const carry = chronicCarryover(chronics, visitDate, visitType);
    for (const c of carry) {
      if (used.has(c.code)) continue;
      out.push({ icd10: c, type: 'chronic', status: 'active' });
      used.add(c.code);
      if (out.length >= 4) break;
    }
    return out;
  }

  // Mental health: pull from F-codes; carry chronic mental health forward.
  if (visitType === 'mental_health') {
    const fCodes = ICD10.filter(d => d.contexts.includes('mental_health'));
    const primary = pick(fCodes);
    out.push({ icd10: primary, type: 'primary', status: 'active' });
    used.add(primary.code);
    if (rand() < 0.4) {
      // Add an insomnia or secondary anxiety/depression code
      const candidates = fCodes.filter(c => !used.has(c.code));
      if (candidates.length > 0) {
        const sec = pick(candidates);
        out.push({ icd10: sec, type: 'secondary', status: 'active' });
        used.add(sec.code);
      }
    }
    return out;
  }

  // Procedure: pull from procedure-context codes.
  if (visitType === 'procedure') {
    const pcodes = ICD10.filter(d => d.contexts.includes('procedure'));
    const primary = pick(pcodes);
    out.push({ icd10: primary, type: 'primary', status: 'active' });
    used.add(primary.code);
    return out;
  }

  // Acute illness or follow_up: pick from appropriate context, possibly with
  // a differential or secondary, plus chronic carryover.
  const acuteCodes = ICD10.filter(d => d.contexts.includes(visitType) && !d.chronic);
  const primary = pick(acuteCodes);
  out.push({ icd10: primary, type: 'primary', status: rand() < 0.85 ? 'active' : 'resolved' });
  used.add(primary.code);

  // Sometimes a differential
  if (rand() < 0.18) {
    const cands = acuteCodes.filter(c => !used.has(c.code));
    if (cands.length > 0) {
      const diff = pick(cands);
      out.push({ icd10: diff, type: 'differential', status: 'ruled_out' });
      used.add(diff.code);
    }
  }

  // Chronic carryover (1-2)
  const carry = chronicCarryover(chronics, visitDate, visitType);
  let added = 0;
  for (const c of carry) {
    if (used.has(c.code)) continue;
    out.push({ icd10: c, type: 'chronic', status: 'active' });
    used.add(c.code);
    added++;
    if (added >= 2) break;
  }

  return out;
}

function pickPrescriptionsFor(diagnosesForVisit, visitType, visitDate, age) {
  // Prescriptions match the diagnoses where possible. Vaccination visits
  // produce the vaccine "prescription". Mental health visits commonly issue
  // psychiatric meds. Acute visits produce antibiotics or symptomatic care.
  const out = [];

  if (visitType === 'vaccination') {
    const v = pickVaccineForAge(age);
    out.push({
      medication_name: v.name,
      generic_name: v.name.toLowerCase(),
      dose: 1,
      dose_unit: 'units',
      frequency: 'once_only',
      duration_days: 1,
      refills: 0,
      start_date: isoDate(visitDate)
    });
    return out;
  }

  // Look up meds whose `for` list intersects this visit's ICD10 codes
  const codes = new Set(diagnosesForVisit.map(d => d.icd10.code));
  const candidates = MEDICATIONS.filter(m => m.for.some(c => codes.has(c)));

  // Visit-type baseline likelihood of prescribing
  const baseProb = (() => {
    switch (visitType) {
      case 'acute_illness': return 0.85;
      case 'follow_up':     return 0.70;
      case 'mental_health': return 0.75;
      case 'annual_physical': return 0.45;
      case 'procedure':     return 0.55;
      default: return 0.5;
    }
  })();

  if (candidates.length === 0 || rand() > baseProb) return out;

  // Number of meds: usually 1, sometimes 2-3
  const count = pickWeighted([[1, 65], [2, 25], [3, 10]]);
  const used = new Set();
  for (let i = 0; i < count; i++) {
    const remaining = candidates.filter(m => !used.has(m.brand));
    if (remaining.length === 0) break;
    const med = pick(remaining);
    used.add(med.brand);

    out.push({
      medication_name: med.brand,
      generic_name: med.generic,
      dose: pick(med.doses),
      dose_unit: med.unit,
      frequency: pick(med.freqs),
      duration_days: randInt(med.duration[0], med.duration[1]),
      refills: randInt(med.refills[0], med.refills[1]),
      start_date: isoDate(visitDate)
    });
  }

  return out;
}

// Build per-patient visit timeline. We sort visits by date so chronic
// carryover behaves correctly across time.

for (const p of patients) {
  const chronics = chronicProfileFor(p);
  const n = visitsForPatient();
  if (n === 0) continue;

  // Generate distinct visit dates in window, sorted ascending
  const days = new Set();
  while (days.size < n) {
    days.add(randInt(0, WINDOW_DAYS));
  }
  const visitDates = [...days].sort((a, b) => a - b).map(d => addDays(WINDOW_START, d));

  for (const vd of visitDates) {
    const age = ageAt(p._dob, vd);
    const visitType = pickVisitType(chronics, age);
    const visit_id = `vis_${pad(visitSeq, 6)}`;
    visitSeq++;

    const v = vitalsFor(p, visitType, vd);
    const cliniciansEligible = CLINICIANS.filter(c => c.types.includes(visitType));
    const clinician = cliniciansEligible.length > 0
      ? pick(cliniciansEligible).name
      : pick(CLINICIANS).name;

    const visitRow = {
      visit_id,
      patient_id: p.patient_id,
      visit_date: isoDate(vd),
      visit_type: visitType,
      attending_clinician: clinician,
      chief_complaint: pick(CHIEF_COMPLAINTS[visitType]),
      bp_systolic:    v.bp_systolic,
      bp_diastolic:   v.bp_diastolic,
      heart_rate:     v.heart_rate,
      temperature_f:  v.temperature_f,
      weight_lbs:     v.weight_lbs,
      height_in:      v.height_in,
      notes: VISIT_NOTES[visitType],
      duration_minutes: durationFor(visitType),
      // Procedure-only fields (sparse for everything else)
      procedure_code: '',
      procedure_provider: '',
      // Vaccine-only fields (sparse for everything else)
      vaccine_name: '',
      vaccine_cvx: '',
      vaccine_lot: ''
    };

    if (visitType === 'procedure') {
      const proc = pick(PROCEDURES);
      visitRow.procedure_code = proc.cpt;
      visitRow.procedure_provider = clinician;
    }
    if (visitType === 'vaccination') {
      const vac = pickVaccineForAge(age);
      visitRow.vaccine_name = vac.name;
      visitRow.vaccine_cvx = vac.cvx;
      visitRow.vaccine_lot = `LOT-${pad(randInt(1000, 99999), 5)}`;
    }

    visits.push(visitRow);

    // Diagnoses for this visit
    const dxList = pickDiagnosesFor(visitType, chronics, vd);
    for (const dx of dxList) {
      diagnoses.push({
        diagnosis_id: `dx_${pad(diagSeq++, 6)}`,
        visit_id,
        patient_id: p.patient_id,
        icd10_code: dx.icd10.code,
        description: dx.icd10.desc,
        diagnosis_type: dx.type,
        status: dx.status
      });
    }

    // Prescriptions for this visit
    const rxList = pickPrescriptionsFor(dxList, visitType, vd, age);
    for (const rx of rxList) {
      prescriptions.push({
        prescription_id: `rx_${pad(rxSeq++, 6)}`,
        visit_id,
        patient_id: p.patient_id,
        medication_name: rx.medication_name,
        generic_name: rx.generic_name,
        dose: rx.dose,
        dose_unit: rx.dose_unit,
        frequency: rx.frequency,
        duration_days: rx.duration_days,
        refills: rx.refills,
        start_date: rx.start_date
      });
    }
  }
}

// --- Audit log ---------------------------------------------------------------
//
// Append-only record of meaningful state changes on the patient (the
// primary subject entity for this scenario). Universal across all three
// workshop scenarios so attendees can reason about it generically:
// fields are identical; only the event_type values are scenario-flavored.

const AUDIT_EVENT_TYPES = [
  ['insurance_updated', 10],
  ['address_updated', 12],
  ['phone_updated', 10],
  ['emergency_contact_updated', 6],
  ['consent_signed', 8],
  ['consent_withdrawn', 2],
  ['appointment_scheduled', 18],
  ['appointment_cancelled', 6],
  ['appointment_no_show', 3],
  ['portal_message_sent', 10],
  ['chart_accessed', 12],
  ['prescription_refill_requested', 8]
];
const AUDIT_ACTORS = [['user', 35], ['clinician', 30], ['admin', 15], ['system', 20]];

function makeAuditDetails(eventType) {
  switch (eventType) {
    case 'insurance_updated':            return `insurance carrier updated`;
    case 'address_updated':              return 'address updated';
    case 'phone_updated':                return 'phone number updated';
    case 'emergency_contact_updated':    return 'emergency contact updated';
    case 'consent_signed':               return `consent signed (${pick(['telehealth','records_release','treatment','financial_responsibility'])})`;
    case 'consent_withdrawn':            return 'consent withdrawn';
    case 'appointment_scheduled':        return `appointment scheduled (${pick(['annual_physical','follow_up','vaccination','mental_health','procedure'])})`;
    case 'appointment_cancelled':        return 'appointment cancelled';
    case 'appointment_no_show':          return 'appointment no-show recorded';
    case 'portal_message_sent':          return 'portal message sent to patient';
    case 'chart_accessed':               return 'chart accessed by clinical staff';
    case 'prescription_refill_requested':return 'prescription refill requested';
    default:                             return eventType;
  }
}

const auditWindowEnd = WINDOW_END.getTime();
const auditLog = [];
for (const p of patients) {
  const eventCount = randInt(3, 22);
  for (let i = 0; i < eventCount; i++) {
    const eventType = pickWeighted(AUDIT_EVENT_TYPES);
    const actor = pickWeighted(AUDIT_ACTORS);
    const daysAgo = randInt(1, 2 * 365);
    const eventDate = new Date(auditWindowEnd - daysAgo * 86400000);
    eventDate.setHours(randInt(0, 23), randInt(0, 59), 0, 0);
    auditLog.push({
      log_id: uuid(),
      subject_id: p.patient_id,
      subject_type: 'patient',
      event_type: eventType,
      actor,
      event_date: eventDate.toISOString(),
      details: makeAuditDetails(eventType)
    });
  }
}

// --- Write CSVs --------------------------------------------------------------

console.log('writing CSVs...');

const outDir = __dirname;

// Strip private _dob from patient rows
const patientHeader = [
  'patient_id','first_name','last_name','date_of_birth','gender','email','phone',
  'address_line1','city','state','postal_code','country',
  'insurance_provider','insurance_member_id',
  'emergency_contact_name','emergency_contact_phone'
];
writeCsv(path.join(outDir, 'patients.csv'), patientHeader, patients);

const visitHeader = [
  'visit_id','patient_id','visit_date','visit_type','attending_clinician','chief_complaint',
  'bp_systolic','bp_diastolic','heart_rate','temperature_f','weight_lbs','height_in',
  'notes','duration_minutes',
  'procedure_code','procedure_provider',
  'vaccine_name','vaccine_cvx','vaccine_lot'
];
writeCsv(path.join(outDir, 'visits.csv'), visitHeader, visits);

const diagnosesHeader = [
  'diagnosis_id','visit_id','patient_id','icd10_code','description','diagnosis_type','status'
];
writeCsv(path.join(outDir, 'diagnoses.csv'), diagnosesHeader, diagnoses);

const prescriptionsHeader = [
  'prescription_id','visit_id','patient_id','medication_name','generic_name',
  'dose','dose_unit','frequency','duration_days','refills','start_date'
];
writeCsv(path.join(outDir, 'prescriptions.csv'), prescriptionsHeader, prescriptions);

const auditLogHeader = [
  'log_id','subject_id','subject_type','event_type','actor','event_date','details'
];
writeCsv(path.join(outDir, 'audit_log.csv'), auditLogHeader, auditLog);

// --- Summary -----------------------------------------------------------------

console.log('---');
console.log(`patients:      ${patients.length}`);
console.log(`visits:        ${visits.length}`);
console.log(`diagnoses:     ${diagnoses.length}`);
console.log(`prescriptions: ${prescriptions.length}`);
console.log(`audit_log:     ${auditLog.length}`);

// Visit type breakdown
const byType = {};
for (const v of visits) byType[v.visit_type] = (byType[v.visit_type] || 0) + 1;
console.log('visit type breakdown:', byType);

// Top ICD-10 codes
const byCode = {};
for (const d of diagnoses) byCode[d.icd10_code] = (byCode[d.icd10_code] || 0) + 1;
const topCodes = Object.entries(byCode).sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('top ICD-10 codes:', topCodes);
