#!/usr/bin/env node
//
// generate.js: Retail Catalog & Orders dataset generator
//
// Produces five CSV files:
//   categories.csv        ~30 categories, hierarchical (department > category > subcategory)
//   products.csv          200 products, varied attributes by category
//   customers.csv         1,000 customers
//   orders.csv            ~3,000 orders, varied statuses and dates
//   order_items.csv       ~7,000 line items (1-5 per order, snapshotted at order time)
//
// Deterministic via a seeded RNG. Re-running produces the exact same output.
// USD currency, en-US date formats throughout.

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
const rand = makeRng(1742);

function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function pickWeighted(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = rand() * total;
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
  return pairs[pairs.length - 1][0];
}
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function randFloat(min, max, digits = 2) {
  const v = rand() * (max - min) + min;
  return Number(v.toFixed(digits));
}
function uuid() {
  // RFC4122-ish v4, deterministic from seeded RNG.
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

// US cities with state and a representative ZIP. Spread across regions.
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
  { city: 'Boston', state: 'MA', zip: '02110' },
  { city: 'Cambridge', state: 'MA', zip: '02138' },
  { city: 'Providence', state: 'RI', zip: '02903' },
  { city: 'Hartford', state: 'CT', zip: '06103' },
  { city: 'Anchorage', state: 'AK', zip: '99501' },
  { city: 'Honolulu', state: 'HI', zip: '96813' }
];

// --- Categories --------------------------------------------------------------
//
// Three departments → categories → subcategories. Each leaf category gets
// products. Top-level departments have null parent_category_id.

const CATEGORY_TREE = [
  {
    name: 'Apparel', children: [
      { name: 'Mens', children: [{ name: 'Shirts' }, { name: 'Pants' }, { name: 'Outerwear' }] },
      { name: 'Womens', children: [{ name: 'Tops' }, { name: 'Dresses' }, { name: 'Activewear' }] },
      { name: 'Accessories', children: [{ name: 'Bags' }, { name: 'Hats' }] }
    ]
  },
  {
    name: 'Electronics', children: [
      { name: 'Audio', children: [{ name: 'Headphones' }, { name: 'Speakers' }] },
      { name: 'Computing', children: [{ name: 'Laptops' }, { name: 'Monitors' }, { name: 'Keyboards' }] },
      { name: 'Mobile', children: [{ name: 'Phones' }, { name: 'Tablets' }] }
    ]
  },
  {
    name: 'Home', children: [
      { name: 'Kitchen', children: [{ name: 'Cookware' }, { name: 'Small Appliances' }] },
      { name: 'Bedroom', children: [{ name: 'Bedding' }, { name: 'Lighting' }] },
      { name: 'Living Room', children: [{ name: 'Seating' }, { name: 'Decor' }] }
    ]
  }
];

const categories = [];
function buildCategories(node, parentId) {
  const id = uuid();
  const slug = node.name.toLowerCase().replace(/\s+/g, '-');
  categories.push({
    category_id: id,
    name: node.name,
    slug,
    parent_category_id: parentId || ''
  });
  if (node.children) {
    for (const child of node.children) buildCategories(child, id);
  }
}
for (const dept of CATEGORY_TREE) buildCategories(dept, null);

// Map category names to ids for product generation lookups
const catByName = {};
for (const c of categories) catByName[c.name] = c;

// --- Products ----------------------------------------------------------------
//
// 200 products distributed across leaf categories. Per-category attribute
// schema captures the variant data the schema-design block uses to argue
// for polymorphic structures.

const APPAREL_BRANDS = ['Northwoods', 'Cedar Run', 'Studio 12', 'Field & Lane', 'Atlas', 'Mode Six', 'Driftwood'];
const ELECTRONICS_BRANDS = ['Volt', 'Chroma', 'Pinwheel', 'Helios', 'Kepler', 'Sextant', 'Lumin'];
const HOME_BRANDS = ['Hearth & Stone', 'North Hill', 'Plain & Sturdy', 'Quiet River', 'Tableau', 'Bramble', 'Olive Lane'];

const COLORS = ['Black','White','Charcoal','Navy','Olive','Burgundy','Forest','Camel','Stone','Slate','Cream','Sand'];
const SIZES = ['XS','S','M','L','XL','XXL'];
const MATERIALS = ['Cotton','Linen','Wool','Polyester','Cotton Blend','Recycled Polyester','Merino','Canvas','Denim','Leather'];

function attrsApparel() {
  return JSON.stringify({
    color: pick(COLORS),
    size: pick(SIZES),
    material: pick(MATERIALS),
    fit: pick(['slim','regular','relaxed']),
    care: 'machine wash cold'
  });
}

function attrsAudio() {
  return JSON.stringify({
    connectivity: pick(['Bluetooth 5.3','Bluetooth 5.0','Wired 3.5mm','USB-C','AirPlay','Wi-Fi']),
    battery_life_hours: randInt(8, 50),
    noise_cancellation: rand() < 0.5,
    color: pick(['Black','Silver','White','Navy','Beige']),
    weight_oz: randFloat(4.5, 18.0, 1)
  });
}
function attrsComputing() {
  return JSON.stringify({
    screen_size_in: pick([13.3, 14.0, 15.6, 16.0, 17.0, 24.0, 27.0, 32.0]),
    resolution: pick(['1920x1080','2560x1440','3840x2160','3024x1964']),
    refresh_rate_hz: pick([60, 90, 120, 144, 165]),
    processor: pick(['Apple M3','Apple M3 Pro','Intel i7-13700H','Intel i9-13900H','AMD Ryzen 9 7940HS']),
    ram_gb: pick([8, 16, 32, 64]),
    storage_gb: pick([256, 512, 1024, 2048])
  });
}
function attrsMobile() {
  return JSON.stringify({
    screen_size_in: pick([6.1, 6.7, 6.8, 11.0, 12.9]),
    storage_gb: pick([128, 256, 512, 1024]),
    color: pick(['Black','Silver','Blue','Pink','Graphite','Gold']),
    connectivity: pick(['5G','LTE','Wi-Fi only']),
    battery_mah: randInt(3000, 7500)
  });
}
function attrsCookware() {
  return JSON.stringify({
    material: pick(['Cast Iron','Stainless Steel','Carbon Steel','Anodized Aluminum','Ceramic']),
    diameter_in: pick([8, 10, 12, 14]),
    induction_compatible: rand() < 0.7,
    oven_safe_f: pick([400, 450, 500, 600]),
    dishwasher_safe: rand() < 0.4
  });
}
function attrsSmallAppliances() {
  return JSON.stringify({
    wattage: pick([800, 1000, 1200, 1500, 1800]),
    capacity_qt: pick([2, 4, 6, 8, 10]),
    color: pick(['White','Black','Stainless','Cream','Sage']),
    voltage: '120V'
  });
}
function attrsBedding() {
  return JSON.stringify({
    size: pick(['Twin','Full','Queen','King','California King']),
    material: pick(['Cotton','Linen','Bamboo','Cotton Sateen','Microfiber']),
    thread_count: pick([200, 300, 400, 600, 800, 1000]),
    color: pick(['White','Cream','Sage','Slate','Navy','Blush'])
  });
}
function attrsLighting() {
  return JSON.stringify({
    bulb_type: pick(['LED','Incandescent','Halogen','Smart LED']),
    wattage: pick([40, 60, 75, 100]),
    finish: pick(['Brass','Black','Brushed Nickel','Matte Black','Antique Bronze']),
    height_in: randInt(8, 40)
  });
}
function attrsSeating() {
  return JSON.stringify({
    seats: pick([1, 2, 3]),
    upholstery: pick(['Linen','Velvet','Leather','Performance Fabric','Boucle']),
    color: pick(['Cream','Charcoal','Navy','Camel','Forest','Slate']),
    width_in: randInt(28, 96),
    depth_in: randInt(28, 42)
  });
}
function attrsDecor() {
  return JSON.stringify({
    style: pick(['Modern','Minimal','Vintage','Mid-century','Coastal','Industrial']),
    material: pick(['Ceramic','Brass','Wood','Glass','Stone']),
    height_in: randInt(4, 30),
    color: pick(['Natural','White','Black','Brass','Terracotta'])
  });
}

const PRODUCT_TEMPLATES = [
  { cat: 'Shirts',           brands: APPAREL_BRANDS,    nameTpl: ['Oxford Button-Up','Heavyweight Tee','Linen Camp Shirt','Henley','Pocket Tee','Flannel'], attrs: attrsApparel, price: [28, 89] },
  { cat: 'Pants',            brands: APPAREL_BRANDS,    nameTpl: ['Selvedge Denim','Pleated Trouser','Field Pant','Joggers','Five-Pocket Chino'], attrs: attrsApparel, price: [48, 168] },
  { cat: 'Outerwear',        brands: APPAREL_BRANDS,    nameTpl: ['Waxed Field Jacket','Wool Topcoat','Down Puffer','Trucker Jacket','Anorak'], attrs: attrsApparel, price: [98, 398] },
  { cat: 'Tops',             brands: APPAREL_BRANDS,    nameTpl: ['Boxy Tee','Cropped Sweater','Cardigan','Silk Blouse','Tank Top'], attrs: attrsApparel, price: [32, 128] },
  { cat: 'Dresses',          brands: APPAREL_BRANDS,    nameTpl: ['Slip Dress','Wrap Dress','Linen Sundress','Knit Midi','Tiered Maxi'], attrs: attrsApparel, price: [78, 248] },
  { cat: 'Activewear',       brands: APPAREL_BRANDS,    nameTpl: ['Compression Tight','Performance Tee','Trail Short','Quarter-zip','Cross-trainer'], attrs: attrsApparel, price: [38, 118] },
  { cat: 'Bags',             brands: APPAREL_BRANDS,    nameTpl: ['Weekender','Field Tote','Roll-top Backpack','Crossbody','Belt Bag'], attrs: attrsApparel, price: [58, 268] },
  { cat: 'Hats',             brands: APPAREL_BRANDS,    nameTpl: ['Six-panel Cap','Wool Beanie','Wide-brim','Bucket Hat','Trucker Cap'], attrs: attrsApparel, price: [22, 78] },
  { cat: 'Headphones',       brands: ELECTRONICS_BRANDS,nameTpl: ['Over-ear Wireless','In-ear Pro','Studio Reference','Sport Earbuds','Open-ear'], attrs: attrsAudio, price: [49, 449] },
  { cat: 'Speakers',         brands: ELECTRONICS_BRANDS,nameTpl: ['Bookshelf Speaker','Portable Speaker','Soundbar','Subwoofer','Smart Speaker'], attrs: attrsAudio, price: [79, 1299] },
  { cat: 'Laptops',          brands: ELECTRONICS_BRANDS,nameTpl: ['Ultraportable','Performance Laptop','Workstation','Convertible','Studio Laptop'], attrs: attrsComputing, price: [799, 3499] },
  { cat: 'Monitors',         brands: ELECTRONICS_BRANDS,nameTpl: ['Curved Display','4K UHD Monitor','Studio Reference','Gaming Display','Portable Monitor'], attrs: attrsComputing, price: [199, 1599] },
  { cat: 'Keyboards',        brands: ELECTRONICS_BRANDS,nameTpl: ['Mechanical Keyboard','Compact Wireless','Ergonomic Split','Low-profile','Gaming TKL'], attrs: attrsComputing, price: [69, 329] },
  { cat: 'Phones',           brands: ELECTRONICS_BRANDS,nameTpl: ['Pro Smartphone','Compact Smartphone','Ultra Camera Phone','Foldable','Standard Smartphone'], attrs: attrsMobile, price: [499, 1599] },
  { cat: 'Tablets',          brands: ELECTRONICS_BRANDS,nameTpl: ['Pro Tablet','Standard Tablet','Mini Tablet','Stylus Tablet','Cellular Tablet'], attrs: attrsMobile, price: [299, 1499] },
  { cat: 'Cookware',         brands: HOME_BRANDS,       nameTpl: ['Cast Iron Skillet','Saucepan','Dutch Oven','Wok','Sauté Pan','Stockpot'], attrs: attrsCookware, price: [38, 449] },
  { cat: 'Small Appliances', brands: HOME_BRANDS,       nameTpl: ['Stand Mixer','Blender','Espresso Machine','Air Fryer','Pour-over Kettle'], attrs: attrsSmallAppliances, price: [49, 599] },
  { cat: 'Bedding',          brands: HOME_BRANDS,       nameTpl: ['Sateen Sheet Set','Linen Duvet','Quilted Coverlet','Down Pillow','Wool Blanket'], attrs: attrsBedding, price: [49, 389] },
  { cat: 'Lighting',         brands: HOME_BRANDS,       nameTpl: ['Table Lamp','Floor Lamp','Pendant Light','Sconce','Reading Lamp'], attrs: attrsLighting, price: [69, 549] },
  { cat: 'Seating',          brands: HOME_BRANDS,       nameTpl: ['Lounge Chair','Sofa','Loveseat','Accent Chair','Ottoman'], attrs: attrsSeating, price: [299, 2499] },
  { cat: 'Decor',            brands: HOME_BRANDS,       nameTpl: ['Ceramic Vase','Brass Bookend','Framed Print','Throw Pillow','Wool Rug'], attrs: attrsDecor, price: [29, 599] }
];

const products = [];
const PRODUCT_COUNT = 200;
let pIdx = 1;
while (products.length < PRODUCT_COUNT) {
  const tpl = pick(PRODUCT_TEMPLATES);
  const cat = catByName[tpl.cat];
  if (!cat) continue;
  const baseName = pick(tpl.nameTpl);
  const brand = pick(tpl.brands);
  const sku = `SKU-${pad(pIdx, 5)}`;
  const name = `${brand} ${baseName}`;
  products.push({
    product_id: uuid(),
    sku,
    name,
    description: `${name}: quality ${baseName.toLowerCase()} for everyday use.`,
    category_id: cat.category_id,
    brand,
    base_price: randFloat(tpl.price[0], tpl.price[1], 2),
    currency: 'USD',
    inventory_count: randInt(0, 500),
    weight_oz: randFloat(2.0, 320.0, 1),
    attributes: tpl.attrs()
  });
  pIdx++;
}

// --- Customers ---------------------------------------------------------------

const customers = [];
for (let i = 1; i <= 1000; i++) {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const city = pick(CITIES);
  const street = `${randInt(100, 9999)} ${pick(STREET_NAMES)} ${pick(STREET_TYPES)}`;
  const line2 = rand() < 0.18 ? `Apt ${randInt(1, 50)}${pick(['','A','B','C'])}` : '';
  // Account creation in the last 4 years
  const daysAgo = randInt(30, 4 * 365);
  const created = new Date(Date.now() - daysAgo * 86400000);
  customers.push({
    customer_id: uuid(),
    email: `${first.toLowerCase()}.${last.toLowerCase()}${randInt(1, 999)}@example.com`,
    first_name: first,
    last_name: last,
    created_at: isoDate(created),
    phone: `(${randInt(200, 999)}) ${randInt(200, 999)}-${pad(randInt(0, 9999), 4)}`,
    address_line1: street,
    address_line2: line2,
    city: city.city,
    state: city.state,
    postal_code: city.zip,
    country: 'US'
  });
}

// --- Orders & order items ----------------------------------------------------

const ORDER_STATUSES = [
  ['delivered', 60],
  ['shipped', 12],
  ['confirmed', 8],
  ['pending', 5],
  ['cancelled', 8],
  ['returned', 7]
];
const PAYMENT_METHODS = [
  ['credit_card', 55],
  ['debit_card', 18],
  ['paypal', 15],
  ['apple_pay', 12]
];

const orders = [];
const orderItems = [];

// 1000 customers, each averaging 3 orders => ~3000 orders. Distribution
// is skewed: most customers have a few, some have many.
for (const c of customers) {
  const orderCount = pickWeighted([[0,15],[1,30],[2,25],[3,15],[4,8],[5,4],[8,2],[12,1]]);
  for (let n = 0; n < orderCount; n++) {
    const status = pickWeighted(ORDER_STATUSES);
    const payment = pickWeighted(PAYMENT_METHODS);
    const daysAgo = randInt(1, 24 * 30); // last ~2 years
    const orderDate = new Date(Date.now() - daysAgo * 86400000);
    const orderId = uuid();

    // Optionally use a different shipping address than the customer's profile.
    const useDifferentAddr = rand() < 0.18;
    const shipCity = useDifferentAddr ? pick(CITIES) : { city: c.city, state: c.state, zip: c.postal_code };
    const shipAddr = {
      address_line1: useDifferentAddr ? `${randInt(100, 9999)} ${pick(STREET_NAMES)} ${pick(STREET_TYPES)}` : c.address_line1,
      address_line2: useDifferentAddr ? '' : c.address_line2,
      city: shipCity.city,
      state: shipCity.state,
      postal_code: shipCity.zip,
      country: 'US'
    };

    // 1-5 line items per order
    const lineItemCount = pickWeighted([[1,30],[2,30],[3,20],[4,12],[5,8]]);
    let subtotal = 0;
    for (let li = 0; li < lineItemCount; li++) {
      const product = pick(products);
      const qty = pickWeighted([[1, 70], [2, 18], [3, 7], [4, 3], [5, 2]]);
      // Capture a snapshot price near (but possibly differing from) the current base_price,
      // simulating sales/markdowns at order time.
      const priceSnapshot = randFloat(
        Math.max(1, product.base_price * 0.8),
        product.base_price * 1.05,
        2
      );
      const lineTotal = Number((priceSnapshot * qty).toFixed(2));
      subtotal += lineTotal;
      orderItems.push({
        line_item_id: uuid(),
        order_id: orderId,
        product_id: product.product_id,
        product_name: product.name,
        sku: product.sku,
        quantity: qty,
        unit_price: priceSnapshot,
        line_total: lineTotal
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    const tax = Number((subtotal * randFloat(0.04, 0.095, 4)).toFixed(2));
    const shippingCost = subtotal > 75 ? 0 : randFloat(4.99, 14.99, 2);
    const total = Number((subtotal + tax + shippingCost).toFixed(2));

    orders.push({
      order_id: orderId,
      customer_id: c.customer_id,
      order_date: isoDate(orderDate),
      order_status: status,
      subtotal,
      tax,
      shipping_cost: shippingCost,
      total,
      payment_method: payment,
      ship_address_line1: shipAddr.address_line1,
      ship_address_line2: shipAddr.address_line2,
      ship_city: shipAddr.city,
      ship_state: shipAddr.state,
      ship_postal_code: shipAddr.postal_code,
      ship_country: shipAddr.country
    });
  }
}

// --- Audit log ---------------------------------------------------------------
//
// Append-only record of meaningful state changes on the customer (the
// primary subject entity for this scenario). Universal across all three
// workshop scenarios so attendees can reason about it generically:
// fields are identical; only the event_type values are scenario-flavored.

const AUDIT_EVENT_TYPES = [
  ['email_updated', 18],
  ['address_updated', 14],
  ['phone_updated', 10],
  ['password_reset', 12],
  ['payment_method_added', 8],
  ['payment_method_removed', 4],
  ['shipping_address_changed', 10],
  ['subscription_started', 6],
  ['subscription_cancelled', 4],
  ['marketing_opt_in_changed', 6],
  ['login_failed', 8]
];
const AUDIT_ACTORS = [['user', 65], ['system', 25], ['admin', 10]];

function makeAuditDetails(eventType) {
  switch (eventType) {
    case 'email_updated':            return 'email address updated';
    case 'address_updated':          return 'default address updated';
    case 'phone_updated':            return 'phone number updated';
    case 'password_reset':           return 'password reset completed';
    case 'payment_method_added':     return `payment method added (${pick(['credit_card','debit_card','paypal','apple_pay'])})`;
    case 'payment_method_removed':   return 'payment method removed';
    case 'shipping_address_changed': return 'default shipping address changed';
    case 'subscription_started':     return 'email subscription started';
    case 'subscription_cancelled':   return 'email subscription cancelled';
    case 'marketing_opt_in_changed': return `marketing opt-in set to ${pick(['true','false'])}`;
    case 'login_failed':             return 'login attempt failed';
    default:                         return eventType;
  }
}

const auditLog = [];
for (const c of customers) {
  const eventCount = randInt(3, 25);
  for (let i = 0; i < eventCount; i++) {
    const eventType = pickWeighted(AUDIT_EVENT_TYPES);
    const actor = pickWeighted(AUDIT_ACTORS);
    const daysAgo = randInt(1, 3 * 365);
    const eventDate = new Date(Date.now() - daysAgo * 86400000);
    eventDate.setHours(randInt(0, 23), randInt(0, 59), 0, 0);
    auditLog.push({
      log_id: uuid(),
      subject_id: c.customer_id,
      subject_type: 'customer',
      event_type: eventType,
      actor,
      event_date: eventDate.toISOString(),
      details: makeAuditDetails(eventType)
    });
  }
}

// --- Write outputs -----------------------------------------------------------

const OUT_DIR = path.resolve(__dirname);

writeCsv(
  path.join(OUT_DIR, 'categories.csv'),
  ['category_id','name','slug','parent_category_id'],
  categories
);
writeCsv(
  path.join(OUT_DIR, 'products.csv'),
  ['product_id','sku','name','description','category_id','brand','base_price','currency','inventory_count','weight_oz','attributes'],
  products
);
writeCsv(
  path.join(OUT_DIR, 'customers.csv'),
  ['customer_id','email','first_name','last_name','created_at','phone','address_line1','address_line2','city','state','postal_code','country'],
  customers
);
writeCsv(
  path.join(OUT_DIR, 'orders.csv'),
  ['order_id','customer_id','order_date','order_status','subtotal','tax','shipping_cost','total','payment_method','ship_address_line1','ship_address_line2','ship_city','ship_state','ship_postal_code','ship_country'],
  orders
);
writeCsv(
  path.join(OUT_DIR, 'order_items.csv'),
  ['line_item_id','order_id','product_id','product_name','sku','quantity','unit_price','line_total'],
  orderItems
);
writeCsv(
  path.join(OUT_DIR, 'audit_log.csv'),
  ['log_id','subject_id','subject_type','event_type','actor','event_date','details'],
  auditLog
);

console.log('---');
console.log(`categories:  ${categories.length}`);
console.log(`products:    ${products.length}`);
console.log(`customers:   ${customers.length}`);
console.log(`orders:      ${orders.length}`);
console.log(`order_items: ${orderItems.length}`);
console.log(`audit_log:   ${auditLog.length}`);
